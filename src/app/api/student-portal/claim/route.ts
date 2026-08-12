import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/server/firebase-admin";
import {
  RequestSecurityError,
  requireRateLimitedUser,
} from "@/lib/server/request-security";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const actor = await requireRateLimitedUser(
      request,
      "student-portal-claim",
      8,
    );
    const body = await request.json().catch(() => ({}));
    const token =
      typeof body.claimToken === "string" ? body.claimToken.trim() : "";
    if (!token)
      return NextResponse.json(
        { error: "Account activation token is required." },
        { status: 400 },
      );
    const hash = crypto.createHash("sha256").update(token).digest("hex");
    const db = getAdminFirestore();
    const claimRef = db.collection("studentPortalClaims").doc(hash);
    const claimSnap = await claimRef.get();
    if (!claimSnap.exists)
      return NextResponse.json(
        { error: "This activation link is invalid or expired." },
        { status: 404 },
      );
    const claim = claimSnap.data() || {};
    if (
      claim.status !== "active" ||
      (claim.expiresAt && Date.parse(String(claim.expiresAt)) <= Date.now())
    ) {
      return NextResponse.json(
        { error: "This activation link is invalid or expired." },
        { status: 410 },
      );
    }
    if (
      !claim.otpVerifiedAt ||
      Date.parse(String(claim.otpVerifiedAt)) < Date.now() - 15 * 60 * 1000
    ) {
      return NextResponse.json(
        { error: "Verify the SMS code before activating your student portal." },
        { status: 403 },
      );
    }
    const tenantRef = db.collection("tenants").doc(String(claim.tenantId));
    const studentRef = tenantRef
      .collection("students")
      .doc(String(claim.studentId));
    const studentSnap = await studentRef.get();
    if (!studentSnap.exists)
      return NextResponse.json(
        { error: "The registered student record could not be found." },
        { status: 404 },
      );
    const student = studentSnap.data() || {};
    if (student.portalUid && student.portalUid !== actor.uid)
      return NextResponse.json(
        { error: "This student portal is already linked." },
        { status: 409 },
      );
    if (
      student.portalClaimExpiresAt &&
      Date.parse(String(student.portalClaimExpiresAt)) <= Date.now()
    )
      return NextResponse.json(
        { error: "This activation link is expired." },
        { status: 410 },
      );
    if (
      String(student.email || "").toLowerCase() !==
      String(actor.email || "").toLowerCase()
    )
      return NextResponse.json(
        { error: "Use the same email address used during registration." },
        { status: 403 },
      );
    const existingLink = await db
      .collection("users")
      .doc(actor.uid)
      .collection("studentPortal")
      .doc("link")
      .get();
    if (existingLink.exists) {
      const existing = existingLink.data() || {};
      if (
        existing.tenantId !== tenantRef.id ||
        existing.studentId !== studentRef.id
      ) {
        return NextResponse.json(
          { error: "This account is already linked to a different student." },
          { status: 409 },
        );
      }
    }
    const now = new Date().toISOString();
    await db.runTransaction(async (transaction) => {
      transaction.set(
        tenantRef.collection("studentAccounts").doc(actor.uid),
        {
          uid: actor.uid,
          tenantId: tenantRef.id,
          studentId: studentRef.id,
          email: actor.email,
          status: "active",
          createdAt: now,
          lastLoginAt: now,
        },
        { merge: true },
      );
      transaction.set(
        db
          .collection("users")
          .doc(actor.uid)
          .collection("studentPortal")
          .doc("link"),
        {
          uid: actor.uid,
          tenantId: tenantRef.id,
          studentId: studentRef.id,
          email: actor.email,
          status: "active",
          updatedAt: now,
        },
      );
      transaction.update(studentRef, {
        portalUid: actor.uid,
        portalEmail: actor.email,
        portalStatus: "active",
        portalClaimTokenHash: null,
        portalClaimExpiresAt: null,
        updatedAt: now,
        updatedByUid: actor.uid,
      });
      transaction.update(claimRef, {
        status: "claimed",
        claimedByUid: actor.uid,
        claimedAt: now,
      });
    });
    await getAdminAuth().updateUser(actor.uid, {
      displayName: student.name || actor.email,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = error instanceof RequestSecurityError ? error.status : 500;
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
