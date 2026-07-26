import { createHash, randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/server/firebase-admin';
import { enforceRateLimit, RequestSecurityError, requireRateLimitedUser } from '@/lib/server/request-security';
import { MAIN_ADMIN_EMAIL, normalizeEmail, type Tenant, type TenantMember } from '@/lib/auth-config';
import { getWorkspaceAccess } from '@/lib/workspace-access';

export const runtime = 'nodejs';

const MAX_AGE_DAYS = 30;

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function clean(value: unknown, max = 240) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

async function loadForm(token: string) {
  if (!token || token.length < 32) return null;
  const db = getAdminFirestore();
  const snapshot = await db.collectionGroup('studentIntakeForms').where('tokenHash', '==', hashToken(token)).limit(1).get();
  if (snapshot.empty) return null;
  const form = snapshot.docs[0];
  const data = form.data() as Record<string, unknown>;
  const expiresAt = typeof data.expiresAt === 'string' ? Date.parse(data.expiresAt) : 0;
  if (!expiresAt || expiresAt <= Date.now() || data.status !== 'active') return null;
  const tenantRef = form.ref.parent.parent;
  if (!tenantRef) return null;
  const tenantSnap = await tenantRef.get();
  if (!tenantSnap.exists) return null;
  return { form, data, tenantRef, tenant: tenantSnap.data() as Tenant };
}

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token') || '';
    const result = await loadForm(token);
    if (!result) return NextResponse.json({ error: 'This student form link is invalid or expired.' }, { status: 404 });
    return NextResponse.json({
      workspaceName: result.tenant.receiptBusinessName || result.tenant.name || 'Driving school',
      logoDataUrl: result.tenant.receiptLogoDataUrl || null,
      expiresAt: result.data.expiresAt,
    });
  } catch {
    return NextResponse.json({ error: 'Could not load this student form.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireRateLimitedUser(request, 'student-intake-link', 20);
    const body = await request.json();
    const tenantId = clean(body.tenantId, 160);
    if (!tenantId) return NextResponse.json({ error: 'Workspace is required.' }, { status: 400 });

    const db = getAdminFirestore();
    const tenantRef = db.collection('tenants').doc(tenantId);
    const [tenantSnap, memberSnap] = await Promise.all([
      tenantRef.get(),
      tenantRef.collection('members').doc(actor.uid).get(),
    ]);
    if (!tenantSnap.exists) return NextResponse.json({ error: 'Workspace was not found.' }, { status: 404 });
    const tenant = tenantSnap.data() as Tenant;
    const member = memberSnap.exists ? memberSnap.data() as TenantMember : null;
    const isMainAdmin = normalizeEmail(actor.email) === MAIN_ADMIN_EMAIL;
    const canManage = isMainAdmin || member?.status === 'active' && ['schoolAdmin', 'soloInstructor'].includes(member.role);
    if (!canManage) return NextResponse.json({ error: 'Only the workspace owner or school admin can create this link.' }, { status: 403 });
    if (!getWorkspaceAccess(tenant).canWrite) return NextResponse.json({ error: 'Activate billing or free access before accepting student forms.' }, { status: 403 });

    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
    await tenantRef.collection('studentIntakeForms').add({
      tokenHash: hashToken(token),
      status: 'active',
      tenantId,
      createdByUid: actor.uid,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });
    return NextResponse.json({ token, expiresAt: expiresAt.toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not create the student form link.';
    const status = error instanceof RequestSecurityError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    enforceRateLimit(`student-intake-submit:${forwardedFor}`, 12, 15 * 60 * 1000);
    const body = await request.json();
    const token = clean(body.token, 200);
    const result = await loadForm(token);
    if (!result) return NextResponse.json({ error: 'This student form link is invalid or expired.' }, { status: 404 });
    if (!getWorkspaceAccess(result.tenant).canWrite) return NextResponse.json({ error: 'This workspace is not currently accepting new students.' }, { status: 403 });

    const name = clean(body.name, 160);
    if (name.length < 2) return NextResponse.json({ error: 'Please enter your full name.' }, { status: 400 });
    const email = clean(body.email, 160).toLowerCase();
    if (email && !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: 'Please enter a valid email.' }, { status: 400 });

    const studentRef = result.tenantRef.collection('students').doc();
    const now = new Date().toISOString();
    await studentRef.create({
      name,
      email,
      mobileNumber: clean(body.mobileNumber, 60),
      address: clean(body.address, 240),
      birthdate: clean(body.birthdate, 20),
      licenseNumber: clean(body.licenseNumber, 40).toUpperCase(),
      licenseExpiry: clean(body.licenseExpiry, 20),
      licenseType: body.licenseType === 'G' ? 'G' : 'G2',
      comments: clean(body.comments, 1000),
      status: 'active',
      registrationDate: now,
      tags: ['Self-submitted'],
      createdVia: 'student-intake',
    });
    await result.form.ref.update({ submissionCount: (Number(result.data.submissionCount) || 0) + 1, lastSubmittedAt: now });
    return NextResponse.json({ ok: true, studentId: studentRef.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not submit your information.';
    const status = error instanceof RequestSecurityError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
