import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/server/firebase-admin';
import { normalizeEmail } from '@/lib/auth-config';
import { RequestSecurityError, requireRateLimitedUser } from '@/lib/server/request-security';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const actor = await requireRateLimitedUser(request, 'session-repair', 5);
    const db = getAdminFirestore();
    const email = normalizeEmail(actor.email);
    const userRef = db.collection('users').doc(actor.uid);
    const userSnap = await userRef.get();
    const existingProfile = userSnap.exists ? userSnap.data() || {} : {};
    const existingTenantIds = Array.isArray(existingProfile.tenantIds)
      ? existingProfile.tenantIds.filter((value): value is string => typeof value === 'string' && value.length > 0)
      : [];

    const memberSnapshots = await db.collectionGroup('members').where('uid', '==', actor.uid).get();
    const activeMemberships = [] as Array<{ tenantId: string; role: string; displayName: string }>;
    for (const memberSnapshot of memberSnapshots.docs) {
      const member = memberSnapshot.data();
      if (member.status !== 'active') continue;
      const tenantId = member.tenantId || memberSnapshot.ref.parent.parent?.id;
      if (!tenantId) continue;
      const tenantSnapshot = await db.collection('tenants').doc(tenantId).get();
      if (!tenantSnapshot.exists || tenantSnapshot.data()?.status !== 'active') continue;
      activeMemberships.push({
        tenantId,
        role: String(member.role || ''),
        displayName: String(member.displayName || actor.name || email),
      });
    }

    const acceptedInviteSnapshots = await db.collectionGroup('invites').where('acceptedByUid', '==', actor.uid).get();
    const acceptedInvites = acceptedInviteSnapshots.docs.filter(snapshot => {
      const invite = snapshot.data();
      return invite.status === 'accepted' && normalizeEmail(invite.email) === email;
    });

    let repairedTenantId = activeMemberships.find(item => item.tenantId === existingProfile.activeTenantId)?.tenantId
      || activeMemberships[0]?.tenantId
      || null;
    let repairedRole = activeMemberships.find(item => item.tenantId === repairedTenantId)?.role || null;
    let repairedDisplayName = activeMemberships.find(item => item.tenantId === repairedTenantId)?.displayName || actor.name || email;

    if (!repairedTenantId && acceptedInvites.length > 0) {
      const invite = acceptedInvites[0].data();
      const tenantId = acceptedInvites[0].ref.parent.parent?.id;
      if (tenantId) {
        const tenantSnapshot = await db.collection('tenants').doc(tenantId).get();
        if (tenantSnapshot.exists && tenantSnapshot.data()?.status === 'active') {
          repairedTenantId = tenantId;
          repairedRole = 'schoolInstructor';
          repairedDisplayName = actor.name || email;
          const memberRef = db.collection('tenants').doc(tenantId).collection('members').doc(actor.uid);
          await memberRef.set({
            uid: actor.uid,
            email,
            displayName: repairedDisplayName,
            role: repairedRole,
            status: 'active',
            tenantId,
            inviteId: acceptedInvites[0].id,
            createdAt: invite.acceptedAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        }
      }
    }

    if (!repairedTenantId) return NextResponse.json({ repaired: false });

    const tenantIds = Array.from(new Set([...existingTenantIds, repairedTenantId]));
    const needsProfileRepair = existingProfile.activeTenantId !== repairedTenantId
      || JSON.stringify(existingTenantIds) !== JSON.stringify(tenantIds);
    if (needsProfileRepair || !userSnap.exists) {
      await userRef.set({
        uid: actor.uid,
        email,
        displayName: repairedDisplayName,
        activeTenantId: repairedTenantId,
        tenantIds,
        createdAt: existingProfile.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    }

    return NextResponse.json({ repaired: needsProfileRepair || acceptedInvites.length > 0, tenantId: repairedTenantId, role: repairedRole });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not repair the workspace session.';
    const status = error instanceof RequestSecurityError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
