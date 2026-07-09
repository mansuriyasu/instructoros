import { NextRequest, NextResponse } from 'next/server';
import { MAIN_ADMIN_EMAIL, normalizeEmail, type Tenant, type TenantMember } from '@/lib/auth-config';
import { PLAN_DETAILS } from '@/lib/billing';
import { getAdminFirestore } from '@/lib/server/firebase-admin';
import { RequestSecurityError, requireRateLimitedUser } from '@/lib/server/request-security';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const actor = await requireRateLimitedUser(request, 'team-invite', 20);
    const body = await request.json();
    const tenantId = String(body.tenantId || '');
    const email = normalizeEmail(body.email);
    if (!tenantId || !email.includes('@')) {
      return NextResponse.json({ error: 'Enter a valid instructor email.' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const tenantRef = db.collection('tenants').doc(tenantId);
    const tenantSnap = await tenantRef.get();
    if (!tenantSnap.exists) return NextResponse.json({ error: 'School workspace was not found.' }, { status: 404 });

    const tenant = tenantSnap.data() as Tenant;
    const isMainAdmin = normalizeEmail(actor.email) === MAIN_ADMIN_EMAIL;
    const actorMember = await tenantRef.collection('members').doc(actor.uid).get();
    const canInvite = isMainAdmin || (actorMember.exists && (actorMember.data() as TenantMember).role === 'schoolAdmin' && (actorMember.data() as TenantMember).status === 'active');
    if (!canInvite || tenant.type !== 'school' || tenant.status !== 'active') {
      return NextResponse.json({ error: 'Only an active school admin can invite instructors.' }, { status: 403 });
    }
    if (tenant.billingLocked === true) {
      return NextResponse.json({ error: 'Activate billing before inviting another instructor.' }, { status: 403 });
    }

    const [membersSnap, invitesSnap] = await Promise.all([
      tenantRef.collection('members').where('status', '==', 'active').get(),
      tenantRef.collection('invites').where('status', '==', 'pending').get(),
    ]);
    const activeEmails = new Set(membersSnap.docs.map(item => normalizeEmail(item.data().email)));
    if (activeEmails.has(email)) {
      return NextResponse.json({ error: 'This person is already an active team member.' }, { status: 409 });
    }

    const existingInvite = invitesSnap.docs.find(item => normalizeEmail(item.data().email) === email);
    if (existingInvite) {
      return NextResponse.json({ inviteId: existingInvite.id, existing: true });
    }

    const pendingInvites = invitesSnap.docs.filter(item => !activeEmails.has(normalizeEmail(item.data().email)));
    const seatLimit = Math.max(PLAN_DETAILS.school.includedSeats, Number(tenant.seatLimit || 0));
    if (membersSnap.size + pendingInvites.length >= seatLimit) {
      return NextResponse.json({ error: `Seat limit reached: ${membersSnap.size} of ${seatLimit} seats are already active or invited.` }, { status: 409 });
    }

    const now = new Date().toISOString();
    const inviteRef = await tenantRef.collection('invites').add({
      email,
      role: 'schoolInstructor',
      status: 'pending',
      tenantId,
      createdByUid: actor.uid,
      createdAt: now,
      updatedAt: now,
    });
    return NextResponse.json({ inviteId: inviteRef.id, existing: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not create the invite.';
    const status = error instanceof RequestSecurityError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
