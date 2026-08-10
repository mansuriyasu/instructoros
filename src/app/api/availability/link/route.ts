import { NextRequest, NextResponse } from 'next/server';
import { requireRateLimitedUser, requestSecurityErrorResponse } from '@/lib/server/request-security';
import { getAdminFirestore } from '@/lib/server/firebase-admin';
import crypto from 'crypto';
import { StudentAvailability } from '@/lib/types';
import { MAIN_ADMIN_EMAIL } from '@/lib/auth-config';

export async function POST(req: NextRequest) {
  try {
    const user = await requireRateLimitedUser(req, 'availability-link-gen', 10);
    const body = await req.json().catch(() => ({}));
    const studentId = typeof body.studentId === 'string' ? body.studentId.trim() : '';
    const tenantId = typeof body.tenantId === 'string' ? body.tenantId.trim() : '';

    if (!studentId || !tenantId || studentId.length > 128 || tenantId.length > 128) {
      return NextResponse.json({ ok: false, error: 'Student ID and Tenant ID are required.' }, { status: 400 });
    }

    const db = getAdminFirestore();

    // Verify user is a member of this tenant
    const [tenantDoc, memberDoc] = await Promise.all([
      db.collection('tenants').doc(tenantId).get(),
      db.collection('tenants').doc(tenantId).collection('members').doc(user.uid).get(),
    ]);
    const member = memberDoc.data();
    const isMainAdmin = user.email?.toLowerCase() === MAIN_ADMIN_EMAIL.toLowerCase();
    if (!tenantDoc.exists || tenantDoc.data()?.status !== 'active' || (!isMainAdmin && member?.status !== 'active')) {
      return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 403 });
    }

    // Verify student exists
    const studentDoc = await db.collection('tenants').doc(tenantId).collection('students').doc(studentId).get();
    if (!studentDoc.exists || studentDoc.data()?.status !== 'active') {
      return NextResponse.json({ ok: false, error: 'Student not found.' }, { status: 404 });
    }

    const student = studentDoc.data() || {};
    const isSchoolInstructor = member?.role === 'schoolInstructor';
    const assigned = Array.isArray(student.assignedInstructorIds) && student.assignedInstructorIds.includes(user.uid);
    if (!isMainAdmin && isSchoolInstructor && !assigned) {
      return NextResponse.json({ ok: false, error: 'You can only request availability for assigned students.' }, { status: 403 });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const availabilityRef = db.collection('tenants').doc(tenantId).collection('studentAvailability').doc(studentId);

    // We update or set the token
    const doc = await availabilityRef.get();
    const now = new Date().toISOString();

    if (doc.exists) {
      await availabilityRef.update({
        tokenHash,
        tokenCreatedAt: now,
        tokenEnabled: true,
        updatedAt: now,
      });
    } else {
      const newAvail: StudentAvailability = {
        studentId,
        tenantId,
        timezone: 'America/Toronto',
        weeklyWindows: [],
        overrides: [],
        tokenHash,
        tokenCreatedAt: now,
        tokenEnabled: true,
        updatedAt: now,
      };
      await availabilityRef.set(newAvail);
    }

    return NextResponse.json({ ok: true, token: rawToken });
  } catch (error) {
    console.error('Error in /api/availability/link:', error);
    if (error instanceof Error && error.name === 'RequestSecurityError') {
      return requestSecurityErrorResponse(error, 'Could not generate link.');
    }
    return NextResponse.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
