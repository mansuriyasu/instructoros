import { getAdminFirestore } from '@/lib/server/firebase-admin';
import { RequestSecurityError } from '@/lib/server/request-security';

export async function getStudentPortalContext(uid: string) {
  const db = getAdminFirestore();
  const mapping = await db.collection('users').doc(uid).collection('studentPortal').doc('link').get();
  if (!mapping.exists) throw new RequestSecurityError('This account is not linked to a student portal.', 403);
  const mappingData = mapping.data() || {};
  const tenantId = String(mappingData.tenantId || '');
  const studentId = String(mappingData.studentId || '');
  if (!tenantId || !studentId) throw new RequestSecurityError('Student portal link is incomplete.', 409);
  const tenantRef = db.collection('tenants').doc(tenantId);
  const account = tenantRef.collection('studentAccounts').doc(uid);
  const accountSnap = await account.get();
  const data = accountSnap.data() || {};
  if (data.status !== 'active' || data.studentId !== studentId) throw new RequestSecurityError('Student portal access has been revoked.', 403);
  const tenant = await tenantRef.get();
  const student = await tenantRef.collection('students').doc(studentId).get();
  if (!tenant.exists || tenant.data()?.status !== 'active' || !student.exists) {
    throw new RequestSecurityError('Student workspace is no longer available.', 403);
  }
  await account.update({ lastLoginAt: new Date().toISOString() });
  return { db, tenantRef, tenant: tenant.data() || {}, studentRef: student.ref, student: student.data() || {}, accountRef: account, account: data };
}

export function publicStudent(student: Record<string, any>) {
  const safe = { ...student };
  delete safe.portalClaimTokenHash;
  delete safe.portalClaimExpiresAt;
  return safe;
}
