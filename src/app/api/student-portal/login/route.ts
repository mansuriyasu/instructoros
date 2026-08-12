import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/server/firebase-admin";
import { enforceRateLimit, RequestSecurityError } from "@/lib/server/request-security";
import { normalizeStudentMobile, verifyStudentPin } from "@/lib/server/student-portal";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const mobileNumber = typeof body.mobileNumber === "string" ? body.mobileNumber.trim() : "";
    const pin = typeof body.pin === "string" ? body.pin.trim() : "";
    const mobile = normalizeStudentMobile(mobileNumber);
    if (mobile.length !== 10 || !/^\d{6}$/.test(pin)) {
      return NextResponse.json({ error: "Enter your 10-digit mobile number and 6-digit PIN." }, { status: 400 });
    }
    const clientKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    enforceRateLimit(`student-portal-login:${clientKey}:${mobile}`, 8, 15 * 60 * 1000);
    const db = getAdminFirestore();
    const accounts = await db.collectionGroup("studentAccounts")
      .where("mobileNumberNormalized", "==", mobile)
      .limit(3)
      .get();
    const matches = accounts.docs.filter((doc) => {
      const data = doc.data();
      return data.status === "active" && typeof data.uid === "string" && typeof data.pinSalt === "string" && typeof data.pinHash === "string" && verifyStudentPin(pin, data.pinSalt, data.pinHash);
    });
    if (matches.length !== 1) {
      throw new RequestSecurityError("Mobile number or PIN is not correct.", 401);
    }
    const account = matches[0].data();
    const uid = String(account.uid || matches[0].id);
    const customToken = await getAdminAuth().createCustomToken(uid, { studentPortal: true });
    return NextResponse.json({ ok: true, customToken });
  } catch (error) {
    const status = error instanceof RequestSecurityError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not sign in to the student portal." }, { status });
  }
}
