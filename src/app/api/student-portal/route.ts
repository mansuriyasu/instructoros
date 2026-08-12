import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/server/firebase-admin';
import { RequestSecurityError } from '@/lib/server/request-security';
import { getStudentPortalContext, publicStudent } from '@/lib/server/student-portal';

export const runtime = 'nodejs';

async function context(request: NextRequest) {
  const header = request.headers.get('authorization') || '';
  const token = header.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new RequestSecurityError('Please sign in to open the student portal.', 401);
  const user = await getAdminAuth().verifyIdToken(token);
  return getStudentPortalContext(user.uid);
}

export async function GET(request: NextRequest) {
  try {
    const { tenantRef, tenant, studentRef, student, account } = await context(request);
    const [eventsSnap, paymentsSnap, evaluationsSnap, availabilitySnap] = await Promise.all([
      tenantRef.collection('events').where('studentId', '==', studentRef.id).limit(250).get(),
      tenantRef.collection('payments').where('studentId', '==', studentRef.id).limit(250).get(),
      tenantRef.collection('evaluations').where('studentId', '==', studentRef.id).limit(100).get(),
      tenantRef.collection('studentAvailability').doc(studentRef.id).get(),
    ]);
    return NextResponse.json({
      tenant: { name: tenant.receiptBusinessName || tenant.name || 'Driving school', logoDataUrl: tenant.receiptLogoDataUrl || null },
      account: { email: account.email, status: account.status, lastLoginAt: account.lastLoginAt },
      student: publicStudent({ ...student, id: studentRef.id }),
      events: eventsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Record<string, any>)).sort((a, b) => String(a.start).localeCompare(String(b.start))),
      payments: paymentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Record<string, any>)).sort((a, b) => String(b.paymentDate).localeCompare(String(a.paymentDate))),
      evaluations: evaluationsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Record<string, any>)).sort((a, b) => String(b.date).localeCompare(String(a.date))),
      availability: availabilitySnap.exists ? availabilitySnap.data() : { weeklyWindows: [], overrides: [], timezone: 'America/Toronto' },
    });
  } catch (error) {
    const status = error instanceof RequestSecurityError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not load the student portal.' }, { status });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { studentRef } = await context(request);
    const body = await request.json().catch(() => ({}));
    const allowed = ['name', 'email', 'mobileNumber', 'birthdate', 'licenseNumber', 'licenseExpiry', 'licenseType', 'licenseImageUrl', 'avatarUrl', 'address', 'pickupAddress', 'drivingGoal', 'experienceLevel', 'roadTest', 'studentSubmittedNotes', 'emergencyContact', 'guardianContact'];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) if (Object.prototype.hasOwnProperty.call(body, key)) updates[key] = body[key];
    if (typeof updates.name === 'string' && updates.name.trim().length < 2) return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
    if (typeof updates.email === 'string' && !/^\S+@\S+\.\S+$/.test(updates.email.trim())) return NextResponse.json({ error: 'Enter a valid email.' }, { status: 400 });
    updates.updatedAt = new Date().toISOString();
    const token = request.headers.get('authorization')!.match(/^Bearer\s+(.+)$/i)![1];
    const actor = await getAdminAuth().verifyIdToken(token);
    updates.updatedByUid = actor.uid;
    await studentRef.update(updates);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = error instanceof RequestSecurityError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not update your profile.' }, { status });
  }
}
