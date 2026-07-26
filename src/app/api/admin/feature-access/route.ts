import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/server/firebase-admin';
import { MAIN_ADMIN_EMAIL, normalizeEmail } from '@/lib/auth-config';

export const runtime = 'nodejs';
type Feature = 'expensesAccess' | 'utilityAccess';

function bearerToken(request: NextRequest) {
  return request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] || '';
}

export async function POST(request: NextRequest) {
  try {
    const token = bearerToken(request);
    if (!token) return NextResponse.json({ error: 'Missing admin token.' }, { status: 401 });
    const actor = await getAdminAuth().verifyIdToken(token);
    const body = await request.json();
    const tenantId = String(body.tenantId || '');
    const uid = String(body.uid || '');
    const feature = body.feature as Feature;
    const enabled = Boolean(body.enabled);

    if (!tenantId || !uid || !['expensesAccess', 'utilityAccess'].includes(feature)) {
      return NextResponse.json({ error: 'Workspace, account, and feature are required.' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const tenantRef = db.collection('tenants').doc(tenantId);
    const tenantSnap = await tenantRef.get();
    if (!tenantSnap.exists) return NextResponse.json({ error: 'Workspace was not found.' }, { status: 404 });

    const actorIsMainAdmin = normalizeEmail(actor.email) === MAIN_ADMIN_EMAIL;
    if (!actorIsMainAdmin) {
      const actorMember = await tenantRef.collection('members').doc(actor.uid).get();
      if (!actorMember.exists || actorMember.data()?.status !== 'active' || !['schoolAdmin', 'soloInstructor'].includes(actorMember.data()?.role)) {
        return NextResponse.json({ error: 'Only a workspace administrator can manage feature access.' }, { status: 403 });
      }
    }

    const targetMemberRef = tenantRef.collection('members').doc(uid);
    const targetMember = await targetMemberRef.get();
    if (!targetMember.exists || targetMember.data()?.status !== 'active') {
      return NextResponse.json({ error: 'The selected account is not an active workspace member.' }, { status: 400 });
    }

    await targetMemberRef.set({ [feature]: enabled, updatedAt: new Date().toISOString() }, { merge: true });
    return NextResponse.json({ tenantId, uid, feature, enabled });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not update feature access.' }, { status: 500 });
  }
}
