import type { Firestore } from "firebase-admin/firestore";
import { isValidEmail, maskEmail, sendEmail } from "@/lib/server/email";
import { type EmailBranding, verificationCodeEmail } from "@/lib/server/email-templates";
import { RequestSecurityError } from "@/lib/server/request-security";

/**
 * Emails a student portal verification code to the address on the student record.
 * Returns the masked address for the "code sent to …" notice.
 */
export async function sendStudentPortalCode(
  db: Firestore,
  tenantId: string,
  student: FirebaseFirestore.DocumentData,
  code: string,
) {
  const to = String(student.email || "").trim();
  if (!isValidEmail(to)) {
    throw new RequestSecurityError(
      "No email address is saved for this student. Ask your instructor to add one, then try again.",
      400,
    );
  }
  const tenantSnap = await db.collection("tenants").doc(tenantId).get();
  const message = verificationCodeEmail((tenantSnap.data() || {}) as EmailBranding, {
    studentName: String(student.name || "there"),
    code,
  });
  await sendEmail({ ...message, to });
  return maskEmail(to);
}
