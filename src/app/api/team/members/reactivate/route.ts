import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { MAIN_ADMIN_EMAIL, normalizeEmail, type Tenant, type TenantMember } from '@/lib/auth-config';
import { PLAN_DETAILS } from '@/lib/billing';
import { getAdminFirestore } from '@/lib/server/firebase-admin';
import { RequestSecurityError, requireRateLimitedUser } from '@/lib/server/request-security';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const actor = await requireRateLimitedUser(request, 'team-reactivate', 20);
    const body = await request.json();
    const tenantId = String(body.tenantId || '');
    const memberUid = String(body.memberUid || '');
    if (!tenantId || !memberUid) return NextResponse.json({ error: 'Missing school or instructor.' }, { status: 400 });

    const db = getAdminFirestore();
    const tenantRef = db.collection('tenants').doc(tenantId);
    const memberRef = tenantRef.collection('members').doc(memberUid);
    const isMainAdmin = normalizeEmail(actor.email) === MAIN_ADMIN_EMAIL;
    const result = await db.runTransaction(async transaction => {
      const [tenantSnap, actorMemberSnap, memberSnap, activeMembersSnap, pendingInvitesSnap] = await Promise.all([
        transaction.get(tenantRef),
        transaction.get(tenantRef.collection('members').doc(actor.uid)),
        transaction.get(memberRef),
        transaction.get(tenantRef.collection('members').where('status', '==', 'active')),
        transaction.get(tenantRef.collection('invites').where('status', '==', 'pending')),
      ]);
      if (!tenantSnap.exists || !memberSnap.exists) return { error: 'School or instructor was not found.', status: 404 };
      const tenant = tenantSnap.data() as Tenant;
      const actorMember = actorMemberSnap.exists ? actorMemberSnap.data() as TenantMember : null;
      const member = memberSnap.data() as TenantMember;
      const canManage = isMainAdmin || (actorMember?.role === 'schoolAdmin' && actorMember.status === 'active');
      if (!canManage || tenant.type !== 'school' || tenant.status !== 'active' || tenant.billingLocked === true) {
        return { error: 'Only an active school admin can reactivate instructors.', status: 403 };
      }
      if (member.role !== 'schoolInstructor' || member.status === 'active') return { error: 'This instructor is already active.', status: 400 };

      const now = Date.now();
      const activeEmails = new Set(activeMembersSnap.docs.map(item => normalizeEmail(item.data().email)));
      const validPendingInvites = pendingInvitesSnap.docs.filter(item => {
        const expiresAt = item.data().expiresAt as { toMillis?: () => number } | undefined;
        return !expiresAt?.toMillis || expiresAt.toMillis() > now;
      });
      const pendingSeatCount = validPendingInvites.filter(item => !activeEmails.has(normalizeEmail(item.data().email))).length;
      const seatLimit = Math.max(PLAN_DETAILS.school.includedSeats, Number(tenant.seatLimit || 0));
      if (activeMembersSnap.size + pendingSeatCount >= seatLimit) {
        return { error: `Seat limit reached: ${activeMembersSnap.size} of ${seatLimit} seats are already active or invited.`, status: 409 };
      }

      transaction.update(memberRef, {
        status: 'active',
        disabledAt: FieldValue.delete(),
        updatedAt: new Date(now).toISOString(),
      });
      return { ok: true };
    });

    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not reactivate the instructor.';
    const status = error instanceof RequestSecurityError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
