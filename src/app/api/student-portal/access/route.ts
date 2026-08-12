import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/server/firebase-admin';
import { MAIN_ADMIN_EMAIL, normalizeEmail } from '@/lib/auth-config';
import { getWorkspaceAccess } from '@/lib/workspace-access';
import { RequestSecurityError, requireRateLimitedUser } from '@/lib/server/request-security';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const actor = await requireRateLimitedUser(request, 'student-portal-access', 20);
    const body = await request.json().catch(() => ({}));
    const tenantId = typeof body.tenantId === 'string' ? body.tenantId.trim() : '';
    const studentId = typeof body.studentId === 'string' ? body.studentId.trim() : '';
    const action = body.action === 'revoke' || body.action === 'restore' ? body.action : '';
    if (!tenantId || !studentId || !action) return NextResponse.json({ error: 'Workspace, student, and action are required.' }, { status: 400 });
    const db = getAdminFirestore();
    const tenantRef = db.collection('tenants').doc(tenantId);
    const [tenantSnap, memberSnap] = await Promise.all([tenantRef.get(), tenantRef.collection('members').doc(actor.uid).get()]);
    if (!tenantSnap.exists) return NextResponse.json({ error: 'Workspace not found.' }, { status: 404 });
    const tenant = tenantSnap.data() || {};
    const member = memberSnap.data() || {};
    const allowed = normalizeEmail(actor.email) === MAIN_ADMIN_EMAIL || (member.status === 'active' && ['schoolAdmin', 'soloInstructor'].includes(String(member.role)));
    if (!allowed || !getWorkspaceAccess(tenant as any).canWrite) return NextResponse.json({ error: 'Only an active workspace owner can manage portal access.' }, { status: 403 });
    const studentRef = tenantRef.collection('students').doc(studentId);
    const studentSnap = await studentRef.get();
    if (!studentSnap.exists) return NextResponse.json({ error: 'Student not found.' }, { status: 404 });
    const student = studentSnap.data() || {};
    const now = new Date().toISOString();
    const uid = typeof student.portalUid === 'string' ? student.portalUid : '';
    await studentRef.update({ portalStatus: action === 'revoke' ? 'revoked' : 'active', updatedAt: now, updatedByUid: actor.uid });
    if (uid) await tenantRef.collection('studentAccounts').doc(uid).set({ status: action === 'revoke' ? 'revoked' : 'active', updatedAt: now }, { merge: true });
    return NextResponse.json({ ok: true, status: action === 'revoke' ? 'revoked' : 'active' });
  } catch (error) {
    const status = error instanceof RequestSecurityError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not update portal access.' }, { status });
  }
}
