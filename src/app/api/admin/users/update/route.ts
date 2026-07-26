import { NextRequest, NextResponse } from 'next/server';
import { MAIN_ADMIN_EMAIL, normalizeEmail } from '@/lib/auth-config';
import { getAdminAuth, getAdminFirestore } from '@/lib/server/firebase-admin';
import { RequestSecurityError, requireRateLimitedUser } from '@/lib/server/request-security';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const actor = await requireRateLimitedUser(request, 'admin-user-update', 20);
    if (normalizeEmail(actor.email) !== MAIN_ADMIN_EMAIL) {
      throw new RequestSecurityError('Only the main administrator can edit account profiles.', 403);
    }

    const body = await request.json().catch(() => ({}));
    const uid = String(body.uid || '').trim();
    const displayName = String(body.displayName || '').trim().slice(0, 120);
    const email = normalizeEmail(body.email);
    const password = String(body.password || '');
    if (!uid || !displayName || !email.includes('@')) {
      return NextResponse.json({ error: 'User ID, name, and a valid email are required.' }, { status: 400 });
    }
    if (password && password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
    }

    const auth = getAdminAuth();
    const current = await auth.getUser(uid);
    const authUpdate: { displayName: string; email?: string; password?: string } = { displayName };
    if (email !== normalizeEmail(current.email)) authUpdate.email = email;
    if (password) authUpdate.password = password;
    await auth.updateUser(uid, authUpdate);

    const db = getAdminFirestore();
    const now = new Date().toISOString();
    const profileRef = db.collection('users').doc(uid);
    await profileRef.set({ uid, email, displayName, updatedAt: now }, { merge: true });

    const memberSnapshots = await db.collectionGroup('members').where('uid', '==', uid).get();
    const batch = db.batch();
    memberSnapshots.docs.forEach(snapshot => batch.update(snapshot.ref, { email, displayName, updatedAt: now }));
    const ownedTenants = await db.collection('tenants').where('ownerUid', '==', uid).get();
    ownedTenants.docs.forEach(snapshot => batch.update(snapshot.ref, { ownerEmail: email, updatedAt: now }));
    if (!memberSnapshots.empty || !ownedTenants.empty) await batch.commit();

    return NextResponse.json({ ok: true, uid, email, displayName });
  } catch (error) {
    const status = error instanceof RequestSecurityError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not update account profile.' }, { status });
  }
}
