import { NextRequest, NextResponse } from 'next/server';
import { getIncludedSeats, getPlanForTenantType } from '@/lib/billing';
import { normalizeEmail, type TenantType } from '@/lib/auth-config';
import { getAdminAuth, getAdminFirestore } from '@/lib/server/firebase-admin';

export const runtime = 'nodejs';

function getBearerToken(request: NextRequest) {
  const header = request.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || '';
}

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) return NextResponse.json({ error: 'Please sign in before creating a workspace.' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const type = body.type === 'school' || body.type === 'solo' ? body.type as TenantType : null;
    const displayName = String(body.displayName || '').trim().slice(0, 120);
    const schoolName = String(body.schoolName || '').trim().slice(0, 160);
    if (!type) return NextResponse.json({ error: 'Choose a school or individual instructor workspace.' }, { status: 400 });
    if (displayName.length < 2) return NextResponse.json({ error: 'Enter your name.' }, { status: 400 });
    if (type === 'school' && schoolName.length < 2) return NextResponse.json({ error: 'Enter the school name first.' }, { status: 400 });

    const decoded = await getAdminAuth().verifyIdToken(token);
    const ownerEmail = normalizeEmail(decoded.email);
    if (!ownerEmail) return NextResponse.json({ error: 'Your account email could not be verified.' }, { status: 400 });

    const db = getAdminFirestore();
    const tenantRef = db.collection('tenants').doc();
    const userRef = db.collection('users').doc(decoded.uid);
    const memberRef = tenantRef.collection('members').doc(decoded.uid);
    const now = new Date().toISOString();
    const tenantName = type === 'school' ? schoolName : `${displayName}'s Workspace`;
    const plan = getPlanForTenantType(type);
    const role = type === 'school' ? 'schoolAdmin' : 'soloInstructor';

    await db.runTransaction(async transaction => {
      const existingProfile = await transaction.get(userRef);
      const existing = existingProfile.exists ? existingProfile.data() : null;
      const tenantIds = Array.isArray(existing?.tenantIds) ? existing.tenantIds.filter(Boolean) : [];

      transaction.set(tenantRef, {
        name: tenantName,
        type,
        status: 'active',
        plan,
        seatLimit: getIncludedSeats(plan),
        extraSeats: 0,
        subscriptionStatus: 'not_started',
        billingLocked: true,
        receiptBusinessName: tenantName,
        receiptEmail: ownerEmail,
        messageSenderName: tenantName,
        ownerUid: decoded.uid,
        ownerEmail,
        createdAt: now,
        updatedAt: now,
      });
      transaction.set(userRef, {
        uid: decoded.uid,
        email: ownerEmail,
        displayName,
        activeTenantId: tenantRef.id,
        tenantIds: Array.from(new Set([...tenantIds, tenantRef.id])),
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      }, { merge: true });
      transaction.set(memberRef, {
        uid: decoded.uid,
        email: ownerEmail,
        displayName,
        role,
        status: 'active',
        tenantId: tenantRef.id,
        createdAt: now,
        updatedAt: now,
      });
    });

    return NextResponse.json({ ok: true, tenantId: tenantRef.id, type });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not create the workspace.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
