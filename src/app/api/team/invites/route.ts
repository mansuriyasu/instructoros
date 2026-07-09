import { NextRequest, NextResponse } from 'next/server';
import { MAIN_ADMIN_EMAIL, normalizeEmail, type Tenant, type TenantMember } from '@/lib/auth-config';
import { PLAN_DETAILS } from '@/lib/billing';
import { getAdminFirestore } from '@/lib/server/firebase-admin';
import { RequestSecurityError, requireRateLimitedUser } from '@/lib/server/request-security';
import { Timestamp } from 'firebase-admin/firestore';

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
    const isMainAdmin = normalizeEmail(actor.email) === MAIN_ADMIN_EMAIL;
    const tenantRef = db.collection('tenants').doc(tenantId);
    const inviteRef = tenantRef.collection('invites').doc();
    const result = await db.runTransaction(async transaction => {
      const [tenantSnap, actorMemberSnap, membersSnap, invitesSnap] = await Promise.all([
        transaction.get(tenantRef),
        transaction.get(tenantRef.collection('members').doc(actor.uid)),
        transaction.get(tenantRef.collection('members').where('status', '==', 'active')),
        transaction.get(tenantRef.collection('invites').where('status', '==', 'pending')),
      ]);
      if (!tenantSnap.exists) return { error: 'School workspace was not found.', status: 404 };

      const tenant = tenantSnap.data() as Tenant;
      const actorMember = actorMemberSnap.exists ? actorMemberSnap.data() as TenantMember : null;
      const canInvite = isMainAdmin || (actorMember?.role === 'schoolAdmin' && actorMember.status === 'active');
      if (!canInvite || tenant.type !== 'school' || tenant.status !== 'active') {
        return { error: 'Only an active school admin can invite instructors.', status: 403 };
      }
      if (tenant.billingLocked === true) {
        return { error: 'Activate billing before inviting another instructor.', status: 403 };
      }

      const now = Date.now();
      const activeEmails = new Set(membersSnap.docs.map(item => normalizeEmail(item.data().email)));
      if (activeEmails.has(email)) {
        return { error: 'This person is already an active team member.', status: 409 };
      }

      const validPendingInvites = invitesSnap.docs.filter(item => {
        const expiresAt = item.data().expiresAt as { toMillis?: () => number } | undefined;
        return !expiresAt?.toMillis || expiresAt.toMillis() > now;
      });
      const existingInvite = validPendingInvites.find(item => normalizeEmail(item.data().email) === email);
      if (existingInvite) return { inviteId: existingInvite.id, existing: true };

      const pendingInvites = validPendingInvites.filter(item => !activeEmails.has(normalizeEmail(item.data().email)));
      const seatLimit = Math.max(PLAN_DETAILS.school.includedSeats, Number(tenant.seatLimit || 0));
      if (membersSnap.size + pendingInvites.length >= seatLimit) {
        return { error: `Seat limit reached: ${membersSnap.size} of ${seatLimit} seats are already active or invited.`, status: 409 };
      }

      const createdAt = new Date(now).toISOString();
      transaction.set(inviteRef, {
        email,
        role: 'schoolInstructor',
        status: 'pending',
        tenantId,
        createdByUid: actor.uid,
        createdAt,
        expiresAt: Timestamp.fromMillis(now + 7 * 24 * 60 * 60 * 1000),
        updatedAt: createdAt,
      });
      return { inviteId: inviteRef.id, existing: false };
    });

    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not create the invite.';
    const status = error instanceof RequestSecurityError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
