import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/server/firebase-admin";
import {
  enforceRateLimit,
  RequestSecurityError,
  requireAuthenticatedUser,
} from "@/lib/server/request-security";
import { sendTwilioSms } from "@/lib/server/twilio";

export const runtime = "nodejs";

function hash(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function clean(value: unknown, max = 240) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAuthenticatedUser(request);
    const body = await request.json().catch(() => ({}));
    const claimToken = clean(body.claimToken, 200);
    const code = clean(body.code, 10).replace(/\D/g, "");
    const action = body.action === "verify" ? "verify" : "send";
    if (!claimToken)
      return NextResponse.json(
        { error: "Activation token is required." },
        { status: 400 },
      );
    enforceRateLimit(
      `student-portal-otp:${actor.uid}`,
      action === "send" ? 3 : 10,
      15 * 60 * 1000,
    );

    const db = getAdminFirestore();
    const claimRef = db.collection("studentPortalClaims").doc(hash(claimToken));
    const claimSnap = await claimRef.get();
    if (!claimSnap.exists)
      return NextResponse.json(
        { error: "This activation request is invalid or expired." },
        { status: 404 },
      );
    const claim = claimSnap.data() || {};
    if (
      claim.status !== "active" ||
      (claim.expiresAt && Date.parse(String(claim.expiresAt)) <= Date.now())
    ) {
      return NextResponse.json(
        { error: "This activation request is invalid or expired." },
        { status: 410 },
      );
    }
    const studentRef = db
      .collection("tenants")
      .doc(String(claim.tenantId))
      .collection("students")
      .doc(String(claim.studentId));
    const studentSnap = await studentRef.get();
    if (!studentSnap.exists)
      return NextResponse.json(
        { error: "The student record could not be found." },
        { status: 404 },
      );
    const student = studentSnap.data() || {};
    if (
      String(student.email || "").toLowerCase() !==
      String(actor.email || "").toLowerCase()
    ) {
      return NextResponse.json(
        { error: "Use the account created with the registration email." },
        { status: 403 },
      );
    }

    if (action === "send") {
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

    if (code.length !== 6)
      return NextResponse.json(
        { error: "Enter the 6-digit code sent by text message." },
        { status: 400 },
      );
    if (
      !claim.otpHash ||
      !claim.otpExpiresAt ||
      Date.parse(String(claim.otpExpiresAt)) <= Date.now()
    )
      return NextResponse.json(
        { error: "That code has expired. Request a new code." },
        { status: 410 },
      );
    const attempts = Number(claim.otpAttempts || 0) + 1;
    if (attempts > 5)
      return NextResponse.json(
        { error: "Too many incorrect codes. Request a new code." },
        { status: 429 },
      );
    if (hash(code) !== String(claim.otpHash)) {
      await claimRef.update({ otpAttempts: attempts });
      return NextResponse.json(
        { error: "That code is not correct." },
        { status: 401 },
      );
    }
    await claimRef.update({
      otpVerifiedAt: new Date().toISOString(),
      otpHash: null,
      otpExpiresAt: null,
      otpAttempts: 0,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = error instanceof RequestSecurityError ? error.status : 502;
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not complete SMS verification.",
      },
      { status },
    );
  }
}
