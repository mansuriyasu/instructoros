import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/server/firebase-admin";
import {
  enforceRateLimit,
  RequestSecurityError,
} from "@/lib/server/request-security";
import {
  hashStudentPin,
  normalizeStudentMobile,
} from "@/lib/server/student-portal";
import { sendTwilioSms } from "@/lib/server/twilio";

export const runtime = "nodejs";

function hash(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function clean(value: unknown, max = 240) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function clientKey(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function deterministicStudentUid(tenantId: string, studentId: string) {
  return `student_${hash(`${tenantId}:${studentId}`).slice(0, 24)}`;
}

async function ensureAuthUser(uid: string, displayName: string) {
  const auth = getAdminAuth();
  try {
    await auth.createUser({ uid, displayName: displayName || "Student" });
  } catch (error: any) {
    if (error?.code !== "auth/uid-already-exists") throw error;
    await auth
      .updateUser(uid, { displayName: displayName || "Student" })
      .catch(() => undefined);
  }
}

async function loadActiveClaim(claimToken: string) {
  if (!claimToken) {
    throw new RequestSecurityError("Activation token is required.", 400);
  }
  const db = getAdminFirestore();
  const claimRef = db.collection("studentPortalClaims").doc(hash(claimToken));
  const claimSnap = await claimRef.get();
  if (!claimSnap.exists) {
    throw new RequestSecurityError("This activation request is invalid or expired.", 404);
  }
  const claim = claimSnap.data() || {};
  if (
    claim.status !== "active" ||
    (claim.expiresAt && Date.parse(String(claim.expiresAt)) <= Date.now())
  ) {
    throw new RequestSecurityError("This activation request is invalid or expired.", 410);
  }
  const tenantId = String(claim.tenantId || "");
  const studentId = String(claim.studentId || "");
  if (!tenantId || !studentId) {
    throw new RequestSecurityError("Activation request is incomplete.", 409);
  }
  const tenantRef = db.collection("tenants").doc(tenantId);
  const studentRef = tenantRef.collection("students").doc(studentId);
  const studentSnap = await studentRef.get();
  if (!studentSnap.exists) {
    throw new RequestSecurityError("The student record could not be found.", 404);
  }
  return {
    db,
    claimRef,
    claim,
    tenantRef,
    studentRef,
    student: studentSnap.data() || {},
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action === "verify" ? "verify" : "send";
    const claimToken = clean(body.claimToken, 220);
    const code = clean(body.code, 10).replace(/\D/g, "");
    const pin = clean(body.pin, 10).replace(/\D/g, "");
    enforceRateLimit(
      `student-portal-claim-otp:${clientKey(request)}:${hash(claimToken)}:${action}`,
      action === "send" ? 4 : 10,
      15 * 60 * 1000,
    );

    const { db, claimRef, claim, tenantRef, studentRef, student } =
      await loadActiveClaim(claimToken);

    if (student.portalStatus === "revoked") {
      return NextResponse.json(
        { error: "Student portal access has been revoked. Please contact your instructor." },
        { status: 403 },
      );
    }

    if (action === "send") {
      const mobile = normalizeStudentMobile(student.mobileNumber);
      if (mobile.length !== 10) {
        return NextResponse.json(
          { error: "The student record does not have a valid mobile number for SMS verification." },
          { status: 400 },
        );
      }
      const otp = String(crypto.randomInt(100000, 1000000));
      await sendTwilioSms(
        student.mobileNumber,
        `InstructorOS verification code: ${otp}. It expires in 10 minutes. Do not share this code.`,
      );
      await claimRef.update({
        otpHash: hash(otp),
        otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        otpAttempts: 0,
        otpSentAt: new Date().toISOString(),
        otpVerifiedAt: null,
      });
      return NextResponse.json({
        ok: true,
        message: "A verification code was sent by text message.",
      });
    }

    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: "Enter the 6-digit code sent by text message." },
        { status: 400 },
      );
    }
    if (!/^\d{6}$/.test(pin)) {
      return NextResponse.json(
        { error: "Create a 6-digit PIN for future student portal login." },
        { status: 400 },
      );
    }
    if (
      !claim.otpHash ||
      !claim.otpExpiresAt ||
      Date.parse(String(claim.otpExpiresAt)) <= Date.now()
    ) {
      return NextResponse.json(
        { error: "That code has expired. Request a new code." },
        { status: 410 },
      );
    }
    const attempts = Number(claim.otpAttempts || 0) + 1;
    if (attempts > 5) {
      return NextResponse.json(
        { error: "Too many incorrect codes. Request a new code." },
        { status: 429 },
      );
    }
    if (hash(code) !== String(claim.otpHash)) {
      await claimRef.update({ otpAttempts: attempts });
      return NextResponse.json({ error: "That code is not correct." }, { status: 401 });
    }

    const tenantId = tenantRef.id;
    const studentId = studentRef.id;
    const existingUid = typeof student.portalUid === "string" ? student.portalUid : "";
    const uid = existingUid || deterministicStudentUid(tenantId, studentId);
    const pinSalt = crypto.randomBytes(16).toString("hex");
    const now = new Date().toISOString();
    await ensureAuthUser(uid, String(student.name || "Student"));

    await db.runTransaction(async (transaction) => {
      transaction.set(
        tenantRef.collection("studentAccounts").doc(uid),
        {
          uid,
          tenantId,
          studentId,
          email: student.email || null,
          mobileNumberNormalized: normalizeStudentMobile(student.mobileNumber),
          pinSalt,
          pinHash: hashStudentPin(pin, pinSalt),
          status: "active",
          createdAt: now,
          updatedAt: now,
          lastLoginAt: now,
        },
        { merge: true },
      );
      transaction.set(
        db.collection("users").doc(uid).collection("studentPortal").doc("link"),
        {
          uid,
          tenantId,
          studentId,
          email: student.email || null,
          status: "active",
          updatedAt: now,
        },
        { merge: true },
      );
      transaction.update(studentRef, {
        portalUid: uid,
        portalEmail: student.email || null,
        portalStatus: "active",
        portalClaimTokenHash: null,
        portalClaimExpiresAt: null,
        mobileNumberNormalized: normalizeStudentMobile(student.mobileNumber),
        updatedAt: now,
        updatedByUid: uid,
      });
      transaction.update(claimRef, {
        status: "claimed",
        claimedByUid: uid,
        claimedAt: now,
        otpVerifiedAt: now,
        otpHash: null,
        otpExpiresAt: null,
        otpAttempts: 0,
      });
    });

    const customToken = await getAdminAuth().createCustomToken(uid, {
      studentPortal: true,
    });
    return NextResponse.json({ ok: true, customToken });
  } catch (error) {
    const status = error instanceof RequestSecurityError ? error.status : 502;
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not activate the student portal.",
      },
      { status },
    );
  }
}
