import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { MAIN_ADMIN_EMAIL, normalizeEmail, type Tenant, type TenantMember } from '@/lib/auth-config';
import { getAdminAuth, getAdminFirestore } from '@/lib/server/firebase-admin';
import { getStripe } from '@/lib/server/stripe';

export const runtime = 'nodejs';

function getBearerToken(request: NextRequest) {
  const header = request.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || '';
}

async function cancelStripeSubscription(subscriptionId?: string) {
  if (!subscriptionId) return null;

  try {
    const subscription = await getStripe().subscriptions.cancel(subscriptionId);
    return { ok: true, id: subscription.id };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not cancel Stripe subscription.',
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Please sign in before deleting data.' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const tenantId = String(body.tenantId || '');
    const confirmationText = String(body.confirmationText || '');

    if (!tenantId) {
      return NextResponse.json({ error: 'Missing workspace.' }, { status: 400 });
    }

    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(token);
    const email = normalizeEmail(decoded.email);
    const db = getAdminFirestore();
    const tenantRef = db.collection('tenants').doc(tenantId);
    const tenantSnap = await tenantRef.get();

    if (!tenantSnap.exists) {
      return NextResponse.json({ error: 'Workspace was not found.' }, { status: 404 });
    }

    const tenant = { ...(tenantSnap.data() as Omit<Tenant, 'id'>), id: tenantSnap.id } as Tenant;
    const requiredConfirmation = `DELETE ${tenant.name}`;
    if (confirmationText !== requiredConfirmation) {
      return NextResponse.json({ error: `Type ${requiredConfirmation} to confirm deletion.` }, { status: 400 });
    }

    const isMainAdmin = email === MAIN_ADMIN_EMAIL;
    const memberSnap = await tenantRef.collection('members').doc(decoded.uid).get();
    const member = memberSnap.exists ? (memberSnap.data() as TenantMember) : null;
    const canDelete = isMainAdmin || (member?.status === 'active' && tenant.ownerUid === decoded.uid);

    if (!canDelete) {
      return NextResponse.json({ error: 'Only the workspace owner/admin can delete this workspace.' }, { status: 403 });
    }

    const membersSnap = await tenantRef.collection('members').get();
    const memberUids = Array.from(new Set([decoded.uid, ...membersSnap.docs.map(item => item.id)]));
    const stripeCancellation = await cancelStripeSubscription(tenant.stripeSubscriptionId);
    let requesterRemainingTenantIds: string[] = [];

    for (const uid of memberUids) {
      const userRef = db.collection('users').doc(uid);
      const userSnap = await userRef.get();
      if (!userSnap.exists) continue;

      const userData = userSnap.data() as { activeTenantId?: string; tenantIds?: string[] };
      const remainingTenantIds = (userData.tenantIds || []).filter(id => id && id !== tenantId);

      if (uid === decoded.uid) {
        requesterRemainingTenantIds = remainingTenantIds;
      }

      if (remainingTenantIds.length === 0) {
        await userRef.delete();
      } else {
        await userRef.set({
          tenantIds: remainingTenantIds,
          activeTenantId: userData.activeTenantId === tenantId ? remainingTenantIds[0] : userData.activeTenantId,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      }
    }

    await db.recursiveDelete(tenantRef);

    let authDeleted = false;
    if (!isMainAdmin && requesterRemainingTenantIds.length === 0) {
      await auth.deleteUser(decoded.uid);
      authDeleted = true;
    } else if (requesterRemainingTenantIds.length > 0) {
      await db.collection('users').doc(decoded.uid).set({
        activeTenantId: requesterRemainingTenantIds[0],
        tenantIds: FieldValue.arrayUnion(...requesterRemainingTenantIds),
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    }

    return NextResponse.json({
      ok: true,
      authDeleted,
      stripeCancellation,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not delete this workspace.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
