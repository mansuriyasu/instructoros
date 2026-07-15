import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { normalizeEmail } from '@/lib/auth-config';
import { getAdminFirestore } from '@/lib/server/firebase-admin';
import { recordWorkspaceActivity } from '@/lib/server/activity';
import { RequestSecurityError, requireRateLimitedUser } from '@/lib/server/request-security';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const actor = await requireRateLimitedUser(request, 'team-invite-accept', 10);
    const body = await request.json();
    const tenantId = String(body.tenantId || '');
    const inviteId = String(body.inviteId || '');
    const displayName = String(body.displayName || actor.name || actor.email || '').trim().slice(0, 120);
    if (!tenantId || !inviteId) return NextResponse.json({ error: 'This invite link is incomplete.' }, { status: 400 });

    const db = getAdminFirestore();
    const tenantRef = db.collection('tenants').doc(tenantId);
    const inviteRef = tenantRef.collection('invites').doc(inviteId);
    const memberRef = tenantRef.collection('members').doc(actor.uid);
    const userRef = db.collection('users').doc(actor.uid);
    const email = normalizeEmail(actor.email);
    const result = await db.runTransaction(async transaction => {
      const [tenantSnap, inviteSnap, memberSnap] = await Promise.all([
        transaction.get(tenantRef),
        transaction.get(inviteRef),
        transaction.get(memberRef),
      ]);
      if (!tenantSnap.exists || !inviteSnap.exists) return { error: 'This invite was not found.', status: 404 };
      const tenant = tenantSnap.data() as { status?: string };
      const invite = inviteSnap.data() as { email?: string; status?: string; expiresAt?: Timestamp; acceptedByUid?: string };
      if (tenant.status !== 'active') return { error: 'This school workspace is not active.', status: 403 };
      const isAcceptedForThisUser = invite.status === 'accepted' && invite.acceptedByUid === actor.uid;
      if (invite.status !== 'pending' && !isAcceptedForThisUser) return { error: 'This invite is no longer available.', status: 409 };
      if (normalizeEmail(invite.email) !== email) return { error: 'This invite is for a different email address.', status: 403 };
      if (!isAcceptedForThisUser && invite.expiresAt?.toMillis && invite.expiresAt.toMillis() <= Date.now()) {
        return { error: 'This invite link has expired. Ask the school admin to send a new one.', status: 410 };
      }
      if (memberSnap.exists && memberSnap.data()?.status === 'active') {
        return { alreadyMember: true };
      }

      const now = new Date().toISOString();
      transaction.set(userRef, {
        uid: actor.uid,
        email,
        displayName,
        activeTenantId: tenantId,
        tenantIds: [tenantId],
        createdAt: now,
        updatedAt: now,
      }, { merge: true });
      transaction.set(memberRef, {
        uid: actor.uid,
        email,
        displayName,
        role: 'schoolInstructor',
        status: 'active',
        tenantId,
        inviteId,
        createdAt: now,
        updatedAt: now,
      }, { merge: true });
      if (!isAcceptedForThisUser) {
        transaction.update(inviteRef, {
          status: 'accepted',
          acceptedAt: now,
          acceptedByUid: actor.uid,
          updatedAt: now,
        });
      }
      return { alreadyMember: false };
    });

    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
    if (!result.alreadyMember) {
      await recordWorkspaceActivity({
        tenantId,
        actorUid: actor.uid,
        actorEmail: actor.email,
        actorRole: 'schoolInstructor',
        action: 'invite_accepted',
        entityType: 'invite',
        entityId: inviteId,
      }).catch(() => undefined);
    }
    return NextResponse.json({ ok: true, alreadyMember: result.alreadyMember });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not accept this invite.';
    const status = error instanceof RequestSecurityError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
