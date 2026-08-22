import { createHash, randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/server/firebase-admin";
import {
  enforceRateLimit,
  RequestSecurityError,
  requireRateLimitedUser,
} from "@/lib/server/request-security";
import {
  MAIN_ADMIN_EMAIL,
  normalizeEmail,
  type Tenant,
  type TenantMember,
} from "@/lib/auth-config";
import { getWorkspaceAccess } from "@/lib/workspace-access";

export const runtime = "nodejs";

const PERMANENT_LINK_TYPE = "workspace-permanent";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 54);
}

function buildSlugBase(tenant: Tenant, actorEmail?: string | null) {
  const emailName = clean(actorEmail, 160).split("@")[0] || "";
  return (
    slugify(
      tenant.receiptBusinessName ||
        tenant.name ||
        tenant.messageSenderName ||
        tenant.ownerEmail ||
        emailName ||
        "instructor",
    ) || "instructor"
  );
}

function normalizePhone(value: unknown) {
  return clean(value, 60).replace(/\D/g, "").slice(-10);
}

function clean(value: unknown, max = 240) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function loadForm(token: string) {
  if (!token || token.length < 3) return null;
  const db = getAdminFirestore();
  let form;
  const tokenParts = token.split(".");
  if (tokenParts.length === 2 && /^[A-Za-z0-9_-]+$/.test(tokenParts[0])) {
    const tenantRef = db.collection("tenants").doc(tokenParts[0]);
    const formRef = tenantRef
      .collection("studentIntakeForms")
      .doc(hashToken(token));
    const formSnap = await formRef.get();
    if (!formSnap.exists) return null;
    form = formSnap;
  } else if (/^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$/.test(token)) {
    const slugSnap = await db.collection("studentIntakeSlugs").doc(token).get();
    if (!slugSnap.exists) return null;
    const slugData = slugSnap.data() as Record<string, unknown>;
    if (slugData.status !== "active") return null;
    const tenantId = clean(slugData.tenantId, 160);
    const tokenHash = clean(slugData.tokenHash, 120);
    if (!tenantId || !tokenHash) return null;
    const formSnap = await db
      .collection("tenants")
      .doc(tenantId)
      .collection("studentIntakeForms")
      .doc(tokenHash)
      .get();
    if (!formSnap.exists) return null;
    form = formSnap;
  } else {
    // Legacy links created before direct tenant lookups were introduced.
    const snapshot = await db
      .collectionGroup("studentIntakeForms")
      .where("tokenHash", "==", hashToken(token))
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    form = snapshot.docs[0];
  }
  const data = form.data() as Record<string, unknown>;
  const expiresAt =
    typeof data.expiresAt === "string" ? Date.parse(data.expiresAt) : null;
  if (data.status !== "active") return null;
  if (expiresAt && expiresAt <= Date.now()) return null;
  const tenantRef = form.ref.parent.parent;
  if (!tenantRef) return null;
  const tenantSnap = await tenantRef.get();
  if (!tenantSnap.exists) return null;
  return { form, data, tenantRef, tenant: tenantSnap.data() as Tenant };
}

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token") || "";
    const result = await loadForm(token);
    if (!result)
      return NextResponse.json(
        { error: "This student form link is invalid or inactive." },
        { status: 404 },
      );
    return NextResponse.json({
      workspaceName:
        result.tenant.receiptBusinessName ||
        result.tenant.name ||
        "Driving school",
      logoDataUrl: result.tenant.receiptLogoDataUrl || null,
      expiresAt: result.data.expiresAt || null,
    });
  } catch {
    return NextResponse.json(
      { error: "Could not load this student form." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireRateLimitedUser(
      request,
      "student-intake-link",
      20,
    );
    const body = await request.json();
    const tenantId = clean(body.tenantId, 160);
    if (!tenantId)
      return NextResponse.json(
        { error: "Workspace is required." },
        { status: 400 },
      );

    const db = getAdminFirestore();
    const tenantRef = db.collection("tenants").doc(tenantId);
    const [tenantSnap, memberSnap] = await Promise.all([
      tenantRef.get(),
      tenantRef.collection("members").doc(actor.uid).get(),
    ]);
    if (!tenantSnap.exists)
      return NextResponse.json(
        { error: "Workspace was not found." },
        { status: 404 },
      );
    const tenant = tenantSnap.data() as Tenant;
    const tenantRecord = tenant as Tenant & {
      studentIntakeToken?: string;
      studentIntakeSlug?: string;
      studentIntakeCreatedByUid?: string;
      studentIntakeCreatedAt?: string;
    };
    const member = memberSnap.exists
      ? (memberSnap.data() as TenantMember)
      : null;
    const isMainAdmin = normalizeEmail(actor.email) === MAIN_ADMIN_EMAIL;
    const canManage =
      isMainAdmin ||
      (member?.status === "active" &&
        ["schoolAdmin", "soloInstructor"].includes(member.role));
    if (!canManage)
      return NextResponse.json(
        {
          error:
            "Only the workspace owner or school admin can create this link.",
        },
        { status: 403 },
      );
    if (!getWorkspaceAccess(tenant).canWrite)
      return NextResponse.json(
        {
          error:
            "Activate billing or free access before accepting student forms.",
        },
        { status: 403 },
      );

    const existingToken =
      typeof tenantRecord.studentIntakeToken === "string"
        ? tenantRecord.studentIntakeToken
        : "";
    const token = existingToken.startsWith(`${tenantId}.`)
      ? existingToken
      : `${tenantId}.${randomBytes(32).toString("base64url")}`;
    const now = new Date();
    const existingSlug =
      typeof tenantRecord.studentIntakeSlug === "string"
        ? tenantRecord.studentIntakeSlug
        : "";
    let slug = existingSlug;
    const slugRef = slug
      ? db.collection("studentIntakeSlugs").doc(slug)
      : null;
    const slugSnap = slugRef ? await slugRef.get() : null;
    if (!slug || !slugSnap?.exists || slugSnap.data()?.tenantId !== tenantId) {
      const base = buildSlugBase(tenant, actor.email);
      for (let attempt = 0; attempt < 25; attempt += 1) {
        const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
        const candidateSnap = await db
          .collection("studentIntakeSlugs")
          .doc(candidate)
          .get();
        if (!candidateSnap.exists || candidateSnap.data()?.tenantId === tenantId) {
          slug = candidate;
          break;
        }
      }
    }
    if (!slug) {
      slug = `${buildSlugBase(tenant, actor.email)}-${randomBytes(3).toString("hex")}`;
    }
    await tenantRef
      .collection("studentIntakeForms")
      .doc(hashToken(token))
      .set({
        tokenHash: hashToken(token),
        token,
        linkType: PERMANENT_LINK_TYPE,
        status: "active",
        tenantId,
        createdByUid: existingToken
          ? tenantRecord.studentIntakeCreatedByUid || actor.uid
          : actor.uid,
        createdAt: tenantRecord.studentIntakeCreatedAt || now.toISOString(),
        updatedAt: now.toISOString(),
        expiresAt: null,
      }, { merge: true });
    await db.collection("studentIntakeSlugs").doc(slug).set({
      slug,
      tenantId,
      tokenHash: hashToken(token),
      linkType: PERMANENT_LINK_TYPE,
      status: "active",
      updatedAt: now.toISOString(),
      createdAt: tenantRecord.studentIntakeCreatedAt || now.toISOString(),
    }, { merge: true });
    if (token !== existingToken) {
      await tenantRef.update({
        studentIntakeToken: token,
        studentIntakeTokenHash: hashToken(token),
        studentIntakeSlug: slug,
        studentIntakeCreatedByUid: actor.uid,
        studentIntakeCreatedAt: now.toISOString(),
        studentIntakeUpdatedAt: now.toISOString(),
      });
    } else if (slug !== existingSlug) {
      await tenantRef.update({
        studentIntakeSlug: slug,
        studentIntakeUpdatedAt: now.toISOString(),
      });
    }
    return NextResponse.json({
      token,
      slug,
      path: `/register/${slug}`,
      permanent: true,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not create the student form link.";
    const status = error instanceof RequestSecurityError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const forwardedFor =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
    enforceRateLimit(
      `student-intake-submit:${forwardedFor}`,
      12,
      15 * 60 * 1000,
    );
    const body = await request.json();
    const token = clean(body.token, 200);
    const result = await loadForm(token);
    if (!result)
      return NextResponse.json(
        { error: "This student form link is invalid or inactive." },
        { status: 404 },
      );
    if (!getWorkspaceAccess(result.tenant).canWrite)
      return NextResponse.json(
        { error: "This workspace is not currently accepting new students." },
        { status: 403 },
      );

    const name = clean(body.name, 160);
    if (name.length < 2)
      return NextResponse.json(
        { error: "Please enter your full name." },
        { status: 400 },
      );
    const email = clean(body.email, 160).toLowerCase();
    if (!email || !/^\S+@\S+\.\S+$/.test(email))
      return NextResponse.json(
        {
          error:
            "Please enter a valid email. It is required to create your student account.",
        },
        { status: 400 },
      );

    const mobileNumber = clean(body.mobileNumber, 60);
    const phoneKey = normalizePhone(mobileNumber);
    const licenseNumber = clean(body.licenseNumber, 40).toUpperCase();
    const licenseImageData = clean(body.licenseImageData, 1_900_000);
    if (
      licenseImageData &&
      !/^data:image\/(jpeg|jpg|png|webp|heic);base64,/i.test(licenseImageData)
    ) {
      return NextResponse.json(
        { error: "The licence image format is not supported." },
        { status: 400 },
      );
    }
    const existingByPhone = phoneKey
      ? await result.tenantRef
          .collection("students")
          .where("mobileNumberNormalized", "==", phoneKey)
          .limit(1)
          .get()
      : ({ empty: true } as const);
    const existingByLicense = licenseNumber
      ? await result.tenantRef
          .collection("students")
          .where("licenseNumber", "==", licenseNumber)
          .limit(1)
          .get()
      : ({ empty: true } as const);
    const possibleDuplicate =
      !existingByPhone.empty || !existingByLicense.empty;
    const claimToken = randomBytes(32).toString("base64url");
    const claimHash = hashToken(claimToken);
    const claimExpiresAt = new Date(
      Date.now() + 24 * 60 * 60 * 1000,
    ).toISOString();

    const studentRef = result.tenantRef.collection("students").doc();
    const now = new Date().toISOString();
    await studentRef.create({
      name,
      email,
      mobileNumber,
      mobileNumberNormalized: phoneKey,
      address: clean(body.address, 240),
      birthdate: clean(body.birthdate, 20),
      licenseNumber,
      licenseExpiry: clean(body.licenseExpiry, 20),
      licenseType: ["G1", "G2", "G", "Other"].includes(body.licenseType)
        ? body.licenseType
        : "G2",
      licenseImageUrl: licenseImageData || "",
      drivingGoal: [
        "beginner",
        "g2-prep",
        "g-prep",
        "refresher",
        "other",
      ].includes(body.drivingGoal)
        ? body.drivingGoal
        : "beginner",
      experienceLevel: ["none", "beginner", "some", "experienced"].includes(
        body.experienceLevel,
      )
        ? body.experienceLevel
        : "none",
      studentSubmittedNotes: clean(body.studentSubmittedNotes, 2000),
      comments: clean(body.comments, 1000),
      guardianContact:
        clean(body.guardianName, 160) || clean(body.guardianPhone, 60)
          ? {
              name: clean(body.guardianName, 160),
              phone: clean(body.guardianPhone, 60),
              relationship: clean(body.guardianRelationship, 80),
            }
          : null,
      emergencyContact:
        clean(body.emergencyName, 160) || clean(body.emergencyPhone, 60)
          ? {
              name: clean(body.emergencyName, 160),
              phone: clean(body.emergencyPhone, 60),
              relationship: clean(body.emergencyRelationship, 80),
            }
          : null,
      status: possibleDuplicate ? "on-hold" : "active",
      registrationDate: now,
      tags: ["Self-submitted"],
      createdVia: "student-intake",
      portalClaimTokenHash: claimHash,
      portalClaimExpiresAt: claimExpiresAt,
      portalStatus: "not-activated",
      registrationReview: possibleDuplicate ? "possible-duplicate" : null,
    });
    const availabilityToken = `${result.tenantRef.id}.${randomBytes(32).toString("hex")}`;
    await result.tenantRef
      .collection("studentAvailability")
      .doc(studentRef.id)
      .set({
        tenantId: result.tenantRef.id,
        studentId: studentRef.id,
        timezone: "America/Toronto",
        weeklyWindows: [],
        overrides: [],
        tokenHash: hashToken(availabilityToken),
        tokenCreatedAt: now,
        tokenEnabled: true,
        updatedAt: now,
      });
    await getAdminFirestore()
      .collection("studentPortalClaims")
      .doc(claimHash)
      .set({
        tenantId: result.tenantRef.id,
        studentId: studentRef.id,
        email,
        expiresAt: claimExpiresAt,
        status: "active",
        createdAt: now,
      });
    await result.tenantRef.collection("notifications").add({
      type: "student-registration",
      status: "unread",
      title: possibleDuplicate
        ? "New student needs review"
        : "New student registered",
      message: possibleDuplicate
        ? `${name} submitted the registration form and may match an existing student.`
        : `${name} submitted the registration form.`,
      studentId: studentRef.id,
      studentName: name,
      createdAt: now,
      createdVia: "student-intake",
      severity: possibleDuplicate ? "warning" : "info",
      registrationReview: possibleDuplicate ? "possible-duplicate" : null,
    });
    await result.form.ref.update({
      submissionCount: (Number(result.data.submissionCount) || 0) + 1,
      lastSubmittedAt: now,
    });
    return NextResponse.json({
      ok: true,
      studentId: studentRef.id,
      claimToken,
      availabilityToken,
      possibleDuplicate,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not submit your information.";
    const status = error instanceof RequestSecurityError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
