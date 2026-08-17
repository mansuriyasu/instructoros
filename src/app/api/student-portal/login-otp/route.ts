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

function clientKey(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function clean(value: unknown, max = 240) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function studentPortalUid(tenantId: string, studentId: string) {
  return `student_${hash(`${tenantId}:${studentId}`).slice(0, 24)}`;
}

async function ensureAuthUser(uid: string, displayName: string) {
  const auth = getAdminAuth();
  try {
    await auth.createUser({ uid, displayName: displayName || "Student" });
  } catch (error: any) {
    if (error?.code !== "auth/uid-already-exists") throw error;
    await auth.updateUser(uid, { displayName: displayName || "Student" }).catch(() => undefined);
  }
}

async function resolveStudentByMobile(mobile: string) {
  const db = getAdminFirestore();
  const accountMatches = await db
    .collectionGroup("studentAccounts")
    .where("mobileNumberNormalized", "==", mobile)
    .limit(4)
    .get();
  const activeAccounts = accountMatches.docs.filter((doc) => {
    const data = doc.data();
    return data.status === "active" && typeof data.uid === "string";
  });
  if (activeAccounts.length > 1) {
    throw new RequestSecurityError(
      "More than one student portal uses this mobile number. Please ask your instructor to clean duplicate records.",
      409,
    );
  }
  if (activeAccounts.length === 1) {
    const account = activeAccounts[0].data();
    return {
      tenantId: String(account.tenantId || activeAccounts[0].ref.parent.parent?.id || ""),
      studentId: String(account.studentId || ""),
      uid: String(account.uid || activeAccounts[0].id),
      accountExists: true,
    };
  }

  const normalizedMatches = await db
    .collectionGroup("students")
    .where("mobileNumberNormalized", "==", mobile)
    .limit(4)
    .get();
  let studentDocs = normalizedMatches.docs;

  if (studentDocs.length === 0) {
    const allStudents = await db.collectionGroup("students").get();
    studentDocs = allStudents.docs.filter(
      (doc) => normalizeStudentMobile(doc.data().mobileNumber) === mobile,
    );
  }

  const eligibleStudents = studentDocs.filter((doc) => {
    const data = doc.data();
    return data.status !== "deactivated" && data.portalStatus !== "revoked";
  });
  if (eligibleStudents.length !== 1) {
    throw new RequestSecurityError(
      eligibleStudents.length > 1
        ? "More than one student record uses this mobile number. Please ask your instructor to merge or update duplicates first."
        : "We could not find an active student record with that mobile number.",
      eligibleStudents.length > 1 ? 409 : 404,
    );
  }

  const studentRef = eligibleStudents[0].ref;
  const tenantId = studentRef.parent.parent?.id || "";
  const studentId = studentRef.id;
  if (!tenantId || !studentId) {
    throw new RequestSecurityError("Student portal record is incomplete.", 409);
  }
  const student = eligibleStudents[0].data();
  return {
    tenantId,
    studentId,
    uid: String(student.portalUid || studentPortalUid(tenantId, studentId)),
    accountExists: false,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action === "verify" ? "verify" : "send";
    const mobile = normalizeStudentMobile(clean(body.mobileNumber, 80));
    const code = clean(body.code, 10).replace(/\D/g, "");
    const pin = clean(body.pin, 10).replace(/\D/g, "");

    if (mobile.length !== 10) {
      return NextResponse.json(
        { error: "Enter the 10-digit mobile number on the student record." },
        { status: 400 },
      );
    }
    enforceRateLimit(
      `student-portal-login-otp:${clientKey(request)}:${mobile}:${action}`,
      action === "send" ? 3 : 10,
      15 * 60 * 1000,
    );

    const db = getAdminFirestore();
    const challengeRef = db.collection("studentPortalOtpLogins").doc(hash(mobile));

    if (action === "send") {
      const resolved = await resolveStudentByMobile(mobile);
      const tenantRef = db.collection("tenants").doc(resolved.tenantId);
      const studentRef = tenantRef.collection("students").doc(resolved.studentId);
      const studentSnap = await studentRef.get();
      if (!studentSnap.exists) {
        return NextResponse.json(
          { error: "The student record could not be found." },
          { status: 404 },
        );
      }
      const student = studentSnap.data() || {};
      if (student.portalStatus === "revoked") {
        return NextResponse.json(
          { error: "Student portal access has been revoked. Please contact your instructor." },
          { status: 403 },
        );
      }

      const otp = String(crypto.randomInt(100000, 1000000));
      await sendTwilioSms(
        student.mobileNumber,
        `InstructorOS student portal code: ${otp}. It expires in 10 minutes. Do not share this code.`,
      );
      await challengeRef.set({
        tenantId: resolved.tenantId,
        studentId: resolved.studentId,
        uid: resolved.uid,
        mobileNumberNormalized: mobile,
        codeHash: hash(otp),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        attempts: 0,
        createdAt: new Date().toISOString(),
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

    const challengeSnap = await challengeRef.get();
    if (!challengeSnap.exists) {
      return NextResponse.json(
        { error: "Request a new verification code first." },
        { status: 404 },
      );
    }
    const challenge = challengeSnap.data() || {};
    if (
      !challenge.codeHash ||
      !challenge.expiresAt ||
      Date.parse(String(challenge.expiresAt)) <= Date.now()
    ) {
      return NextResponse.json(
        { error: "That code has expired. Request a new code." },
        { status: 410 },
      );
    }
    const attempts = Number(challenge.attempts || 0) + 1;
    if (attempts > 5) {
      return NextResponse.json(
        { error: "Too many incorrect codes. Request a new code." },
        { status: 429 },
      );
    }
    if (hash(code) !== String(challenge.codeHash)) {
      await challengeRef.update({ attempts });
      return NextResponse.json({ error: "That code is not correct." }, { status: 401 });
    }

    const tenantId = String(challenge.tenantId || "");
    const studentId = String(challenge.studentId || "");
    const uid = String(challenge.uid || "");
    if (!tenantId || !studentId || !uid) {
      throw new RequestSecurityError("Student portal activation is incomplete.", 409);
    }
    const tenantRef = db.collection("tenants").doc(tenantId);
    const studentRef = tenantRef.collection("students").doc(studentId);
    const studentSnap = await studentRef.get();
    if (!studentSnap.exists) {
      return NextResponse.json(
        { error: "The student record could not be found." },
        { status: 404 },
      );
    }
    const student = studentSnap.data() || {};
    if (student.portalStatus === "revoked") {
      return NextResponse.json(
        { error: "Student portal access has been revoked. Please contact your instructor." },
        { status: 403 },
      );
    }
    if (student.portalUid && student.portalUid !== uid) {
      return NextResponse.json(
        { error: "This student portal is linked to another account. Please contact your instructor." },
        { status: 409 },
      );
    }

    await ensureAuthUser(uid, String(student.name || "Student"));
    const now = new Date().toISOString();
    const pinSalt = crypto.randomBytes(16).toString("hex");
    await db.runTransaction(async (transaction) => {
      transaction.set(
        tenantRef.collection("studentAccounts").doc(uid),
        {
          uid,
          tenantId,
          studentId,
          email: student.email || null,
          mobileNumberNormalized: mobile,
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
      transaction.set(
        studentRef,
        {
          portalUid: uid,
          portalEmail: student.email || null,
          portalStatus: "active",
          mobileNumberNormalized: mobile,
          updatedAt: now,
          updatedByUid: uid,
        },
        { merge: true },
      );
      transaction.delete(challengeRef);
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
            : "Could not complete student portal OTP login.",
      },
      { status },
    );
  }
}
