import { NextRequest, NextResponse } from 'next/server';
import { MAIN_ADMIN_EMAIL, normalizeEmail, type Tenant } from '@/lib/auth-config';
import { getAdminAuth, getAdminFirestore } from '@/lib/server/firebase-admin';
import { recordWorkspaceActivity } from '@/lib/server/activity';
import { Timestamp } from 'firebase-admin/firestore';

export const runtime = 'nodejs';

function bearerToken(request: NextRequest) {
  const value = request.headers.get('authorization') || '';
  return value.match(/^Bearer\s+(.+)$/i)?.[1] || '';
}

export async function POST(request: NextRequest) {
  try {
    const token = bearerToken(request);
    if (!token) return NextResponse.json({ error: 'Missing admin token.' }, { status: 401 });
    const actor = await getAdminAuth().verifyIdToken(token);
    if (normalizeEmail(actor.email) !== MAIN_ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Only the main admin can grant free access.' }, { status: 403 });
    }

    const body = await request.json();
    const tenantId = String(body.tenantId || '');
    const days = Math.min(3650, Math.max(1, Math.round(Number(body.days || 0))));
    if (!tenantId || !days) return NextResponse.json({ error: 'Workspace and access duration are required.' }, { status: 400 });

    const tenantRef = getAdminFirestore().collection('tenants').doc(tenantId);
    const tenantSnap = await tenantRef.get();
    if (!tenantSnap.exists) return NextResponse.json({ error: 'Workspace was not found.' }, { status: 404 });

    const now = new Date();
    const accessUntil = new Date(now);
    accessUntil.setUTCDate(accessUntil.getUTCDate() + days);
    const tenant = tenantSnap.data() as Tenant;
    await tenantRef.set({
      status: 'active',
      subscriptionStatus: 'active',
      billingLocked: false,
      freeAccessUntil: accessUntil.toISOString(),
      freeAccessUntilAt: Timestamp.fromDate(accessUntil),
      freeAccessReason: `Admin granted ${days} days free access`,
      updatedAt: now.toISOString(),
    }, { merge: true });

    await recordWorkspaceActivity({
      tenantId,
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: 'mainAdmin',
      action: 'free_access_granted',
      entityType: 'tenant',
      entityId: tenantId,
      metadata: { days, previousStatus: tenant.subscriptionStatus || 'not_started' },
    });

    return NextResponse.json({ tenantId, freeAccessUntil: accessUntil.toISOString() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not grant free access.' }, { status: 500 });
  }
}
