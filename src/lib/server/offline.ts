import type { NextRequest } from 'next/server';
import { createHash } from 'node:crypto';
import { getAdminFirestore } from './firebase-admin';
import { requireRateLimitedUser, RequestSecurityError } from './request-security';
import { getWorkspaceAccess } from '@/lib/workspace-access';
import type { Tenant } from '@/lib/auth-config';

export function documentId(value: unknown) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,160}$/.test(value)) throw new RequestSecurityError('Invalid record identifier.', 400);
  return value;
}
export function assigned(student: Record<string, any>, uid: string) {
  return student.instructorId === uid || (Array.isArray(student.assignedInstructorIds) && student.assignedInstructorIds.includes(uid));
}
export function currentStudent(student: Record<string, any>) {
  return ['active', 'booked'].includes(student.status) && !student.mergedIntoStudentId;
}
export function revision(snapshot: { updateTime?: { seconds: number; nanoseconds: number } }) {
  return snapshot.updateTime ? `${snapshot.updateTime.seconds}:${snapshot.updateTime.nanoseconds}` : '';
}
export function phoneKey(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
}
export function fingerprint(value: unknown) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
export async function offlineActor(request: NextRequest, tenantId: string, write = false) {
  const actor = await requireRateLimitedUser(request, write ? 'offline-sync' : 'offline-download', write ? 120 : 60);
  const db = getAdminFirestore();
  const tenantRef = db.collection('tenants').doc(documentId(tenantId));
  const [tenantSnap, memberSnap] = await Promise.all([tenantRef.get(), tenantRef.collection('members').doc(actor.uid).get()]);
  assertAccess(tenantSnap.data(), memberSnap.data(), write);
  return { actor, db, tenantRef, tenant: tenantSnap.data()!, member: memberSnap.data()! };
}
export function assertAccess(tenant: Record<string, any> | undefined, member: Record<string, any> | undefined, write: boolean) {
  if (tenant?.status !== 'active' || member?.status !== 'active' || !['schoolAdmin', 'soloInstructor', 'schoolInstructor'].includes(member.role)) throw new RequestSecurityError('An active staff membership is required. Your offline data must be refreshed.', 403);
  if (write && !getWorkspaceAccess(tenant as Tenant).canWrite) throw new RequestSecurityError('This workspace is read-only. Drafts remain on this phone until access is restored.', 403);
}
