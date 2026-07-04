import { type NextRequest } from 'next/server';
import { type DocumentReference, type DocumentData } from 'firebase-admin/firestore';
import { MAIN_ADMIN_EMAIL, normalizeEmail, type Tenant, type TenantMember } from '@/lib/auth-config';
import { getAdminAuth, getAdminFirestore } from '@/lib/server/firebase-admin';

function getBearerToken(request: NextRequest) {
  const header = request.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || '';
}

export async function getBillingActor(request: NextRequest, tenantId: string) {
  const token = getBearerToken(request);
  if (!token) {
    throw new Error('Please sign in before managing billing.');
  }

  const decoded = await getAdminAuth().verifyIdToken(token);
  const email = normalizeEmail(decoded.email);
  const db = getAdminFirestore();
  const tenantRef = db.collection('tenants').doc(tenantId) as DocumentReference<DocumentData>;
  const tenantSnap = await tenantRef.get();

  if (!tenantSnap.exists) {
    throw new Error('Workspace was not found.');
  }

  const tenant = { ...(tenantSnap.data() as Omit<Tenant, 'id'>), id: tenantSnap.id } as Tenant;
  const isMainAdmin = email === MAIN_ADMIN_EMAIL;

  if (!isMainAdmin) {
    const memberSnap = await tenantRef.collection('members').doc(decoded.uid).get();
    const member = memberSnap.exists ? (memberSnap.data() as TenantMember) : null;
    const canManageBilling = member?.status === 'active' && ['schoolAdmin', 'soloInstructor'].includes(member.role);

    if (!canManageBilling) {
      throw new Error('Only a workspace admin can manage billing.');
    }
  }

  return {
    uid: decoded.uid,
    email,
    tenant,
    tenantRef,
    isMainAdmin,
  };
}
