import { NextRequest, NextResponse } from 'next/server';
import type { Firestore } from 'firebase-admin/firestore';
import { MAIN_ADMIN_EMAIL, normalizeEmail, type Tenant } from '@/lib/auth-config';
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
    return { ok: false, error: error instanceof Error ? error.message : 'Could not cancel Stripe subscription.' };
  }
}

async function removeTenantFromUser(db: Firestore, uid: string, tenantId: string) {
  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) return [];

  const data = userSnap.data() as { tenantIds?: string[]; activeTenantId?: string };
  const remainingTenantIds = (data.tenantIds || []).filter(id => id && id !== tenantId);
  if (remainingTenantIds.length === 0) {
    await userRef.delete();
  } else {
    await userRef.set({
      tenantIds: remainingTenantIds,
      activeTenantId: data.activeTenantId === tenantId ? remainingTenantIds[0] : data.activeTenantId,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  }
  return remainingTenantIds;
}

async function deleteTenant(db: Firestore, tenant: Tenant) {
  const tenantRef = db.collection('tenants').doc(tenant.id);
  const membersSnap = await tenantRef.collection('members').get();
  const memberUids = Array.from(new Set([tenant.ownerUid, ...membersSnap.docs.map(item => item.id)]));
  const stripeCancellation = await cancelStripeSubscription(tenant.stripeSubscriptionId);

  for (const uid of memberUids) {
    await removeTenantFromUser(db, uid, tenant.id);
  }

  // recursiveDelete removes every nested tenant collection, including records
  // not currently surfaced in the UI (for example, invites and audit records).
  await db.recursiveDelete(tenantRef);
  return { tenantId: tenant.id, stripeCancellation, memberUids };
}

async function removeUserFromAllMemberships(db: Firestore, uid: string) {
  const tenantsSnap = await db.collection('tenants').get();
  for (const tenantDoc of tenantsSnap.docs) {
    const memberRef = tenantDoc.ref.collection('members').doc(uid);
    if ((await memberRef.get()).exists) await memberRef.delete();
  }
}

async function deleteAuthUserIfAllowed(auth: ReturnType<typeof getAdminAuth>, uid: string, isMainAdmin: boolean) {
  if (isMainAdmin) return false;
  try {
    await auth.deleteUser(uid);
    return true;
  } catch (error) {
    // Firebase returns this when a repeated request arrives after the account
    // was already removed. Treat it as idempotent.
    if (error && typeof error === 'object' && 'code' in error && error.code === 'auth/user-not-found') return true;
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) return NextResponse.json({ error: 'Please sign in before deleting data.' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const confirmationText = String(body.confirmationText || '');
    const requestedTenantId = String(body.tenantId || '');
    const requestedUserId = String(body.userId || '');

    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(token);
    const email = normalizeEmail(decoded.email);
    const isMainAdmin = email === MAIN_ADMIN_EMAIL;
    const db = getAdminFirestore();

    if (requestedUserId && !isMainAdmin) {
      return NextResponse.json({ error: 'Only the main admin can delete another account.' }, { status: 403 });
    }
    if (isMainAdmin && requestedUserId === decoded.uid) {
      return NextResponse.json({ error: 'The main admin account cannot be deleted from this control.' }, { status: 400 });
    }

    // Admin deletion is explicit and removes the selected workspace and its
    // owner account when that owner has no remaining workspaces.
    if (isMainAdmin && requestedTenantId) {
      const tenantRef = db.collection('tenants').doc(requestedTenantId);
      const tenantSnap = await tenantRef.get();
      if (!tenantSnap.exists) return NextResponse.json({ error: 'Workspace was not found.' }, { status: 404 });
      const tenant = { ...(tenantSnap.data() as Omit<Tenant, 'id'>), id: tenantSnap.id } as Tenant;
      const requiredConfirmation = `DELETE TENANT ${tenant.id}`;
      if (confirmationText !== requiredConfirmation) {
        return NextResponse.json({ error: `Type ${requiredConfirmation} to confirm deletion.` }, { status: 400 });
      }
      const result = await deleteTenant(db, tenant);
      const ownerProfile = await db.collection('users').doc(tenant.ownerUid).get();
      const remaining = ownerProfile.exists ? ((ownerProfile.data()?.tenantIds || []) as string[]) : [];
      let ownerAuthDeleted = false;
      if (remaining.length === 0 && tenant.ownerUid !== decoded.uid) {
        await db.collection('users').doc(tenant.ownerUid).delete().catch(() => undefined);
        ownerAuthDeleted = await deleteAuthUserIfAllowed(auth, tenant.ownerUid, false);
      }
      return NextResponse.json({ ok: true, scope: 'tenant', ...result, authDeleted: ownerAuthDeleted });
    }

    if (isMainAdmin && requestedUserId) {
      const requiredConfirmation = `DELETE USER ${requestedUserId}`;
      if (confirmationText !== requiredConfirmation) {
        return NextResponse.json({ error: `Type ${requiredConfirmation} to confirm deletion.` }, { status: 400 });
      }
      const ownedQuery = await db.collection('tenants').where('ownerUid', '==', requestedUserId).get();
      const deletedTenants = [];
      for (const tenantSnap of ownedQuery.docs) {
        deletedTenants.push(await deleteTenant(db, { ...(tenantSnap.data() as Omit<Tenant, 'id'>), id: tenantSnap.id } as Tenant));
      }
      await removeUserFromAllMemberships(db, requestedUserId);
      await db.collection('users').doc(requestedUserId).delete().catch(() => undefined);
      const authDeleted = await deleteAuthUserIfAllowed(auth, requestedUserId, false);
      return NextResponse.json({ ok: true, scope: 'user', authDeleted, deletedTenants });
    }

    if (confirmationText !== 'DELETE MY ACCOUNT') {
      return NextResponse.json({ error: 'Type DELETE MY ACCOUNT to confirm account deletion.' }, { status: 400 });
    }
    if (isMainAdmin) {
      return NextResponse.json({ error: 'The main admin account cannot be deleted from the account screen.' }, { status: 400 });
    }

    const targetUid = requestedUserId || decoded.uid;
    if (targetUid !== decoded.uid && !isMainAdmin) {
      return NextResponse.json({ error: 'You can only delete your own account.' }, { status: 403 });
    }

    const profileSnap = await db.collection('users').doc(targetUid).get();
    const profile = profileSnap.exists ? profileSnap.data() as { tenantIds?: string[] } : {};
    const tenantIds = Array.from(new Set(profile.tenantIds || []));
    const ownedTenants: Tenant[] = [];
    for (const tenantId of tenantIds) {
      const tenantSnap = await db.collection('tenants').doc(tenantId).get();
      if (tenantSnap.exists && (tenantSnap.data()?.ownerUid === targetUid || isMainAdmin)) {
        ownedTenants.push({ ...(tenantSnap.data() as Omit<Tenant, 'id'>), id: tenantSnap.id } as Tenant);
      }
    }
    // Recover owned workspaces even if an old profile has stale tenantIds.
    const ownedQuery = await db.collection('tenants').where('ownerUid', '==', targetUid).get();
    for (const tenantSnap of ownedQuery.docs) {
      if (!ownedTenants.some(item => item.id === tenantSnap.id)) {
        ownedTenants.push({ ...(tenantSnap.data() as Omit<Tenant, 'id'>), id: tenantSnap.id } as Tenant);
      }
    }

    const deletedTenants = [];
    for (const tenant of ownedTenants) deletedTenants.push(await deleteTenant(db, tenant));
    await removeUserFromAllMemberships(db, targetUid);
    await db.collection('users').doc(targetUid).delete().catch(() => undefined);
    const authDeleted = await deleteAuthUserIfAllowed(auth, targetUid, false);

    return NextResponse.json({ ok: true, scope: 'account', authDeleted, deletedTenants });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not delete the account or data.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
