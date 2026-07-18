import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/server/firebase-admin';
import { RequestSecurityError, requireRateLimitedUser } from '@/lib/server/request-security';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const actor = await requireRateLimitedUser(request, 'assigned-events', 30);
    const body = await request.json().catch(() => ({}));
    const tenantId = String(body.tenantId || '');
    const startDate = typeof body.startDate === 'string' ? body.startDate : '';
    const endDate = typeof body.endDate === 'string' ? body.endDate : '';
    if (!tenantId) return NextResponse.json({ error: 'Workspace is required.' }, { status: 400 });

    const db = getAdminFirestore();
    const tenantRef = db.collection('tenants').doc(tenantId);
    const [tenantSnap, memberSnap, studentsSnap, eventsSnap] = await Promise.all([
      tenantRef.get(),
      tenantRef.collection('members').doc(actor.uid).get(),
      tenantRef.collection('students').where('assignedInstructorIds', 'array-contains', actor.uid).get(),
      tenantRef.collection('events').get(),
    ]);
    const member = memberSnap.data();
    if (!tenantSnap.exists || tenantSnap.data()?.status !== 'active' || member?.status !== 'active' || member.role !== 'schoolInstructor') {
      return NextResponse.json({ error: 'This instructor is not active in the selected school workspace.' }, { status: 403 });
    }

    const assignedStudentIds = new Set(studentsSnap.docs.map(snapshot => snapshot.id));
    const events = eventsSnap.docs
      .map(snapshot => ({ ...snapshot.data(), id: snapshot.id } as Record<string, any>))
      .filter(event => event.instructorId === actor.uid || (typeof event.studentId === 'string' && assignedStudentIds.has(event.studentId)))
      .filter(event => {
        if (!startDate || !endDate) return true;
        const eventStart = new Date(String(event.start || '')).getTime();
        const eventEnd = new Date(String(event.end || '')).getTime();
        const rangeStart = new Date(startDate).getTime();
        const rangeEnd = new Date(endDate).getTime();
        return Number.isFinite(eventStart) && Number.isFinite(eventEnd) && eventStart < rangeEnd && eventEnd > rangeStart;
      })
      .sort((left, right) => String(left.start || '').localeCompare(String(right.start || '')));

    return NextResponse.json({ events });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load assigned lessons.';
    const status = error instanceof RequestSecurityError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
