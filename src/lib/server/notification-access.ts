import { requireAuthenticatedUser, RequestSecurityError } from './request-security';
import { getAdminFirestore } from './firebase-admin';
import { access, key } from './notification-service';
import { Timestamp } from 'firebase-admin/firestore';

export async function notificationActor(request: Request) {
  const user = await requireAuthenticatedUser(request);
  const db = getAdminFirestore();
  const profile = (await db.doc(`users/${user.uid}`).get()).data();
  const tenantId = profile?.activeTenantId;
  if (typeof tenantId !== 'string' || !/^[\w-]+$/.test(tenantId) || !await access(tenantId, user.uid)) throw new RequestSecurityError('An active instructor workspace is required.', 403);
  return { uid: user.uid, tenantId, db };
}
export async function notificationRateLimit(uid: string, feature: string, limit = 5) {
  const ref = getAdminFirestore().doc(`notificationRateLimits/${key(uid, feature)}`);
  await getAdminFirestore().runTransaction(async tx => {
    const record = (await tx.get(ref)).data();
    const reset = record?.expiresAt?.toMillis() || 0;
    const count = reset > Date.now() ? record!.count : 0;
    if (count >= limit) throw new RequestSecurityError('Please wait a few minutes before trying again.', 429);
    tx.set(ref, { count: count + 1, expiresAt: Timestamp.fromMillis(reset > Date.now() ? reset : Date.now() + 15 * 60000) });
  });
}
