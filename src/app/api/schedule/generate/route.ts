import { NextRequest, NextResponse } from 'next/server';
import { requireRateLimitedUser, requestSecurityErrorResponse } from '@/lib/server/request-security';
import { getAdminFirestore } from '@/lib/server/firebase-admin';
import { ScheduleCandidate, ScheduleLockedEvent, StudentAvailability } from '@/lib/types';
import { solveScheduleDeterministic } from '@/ai/flows/solve-schedule';
import { z } from 'zod';
import { MAIN_ADMIN_EMAIL } from '@/lib/auth-config';

const generateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  instructorId: z.string(),
  tenantId: z.string(),
  serviceId: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireRateLimitedUser(req, 'schedule-generate', 15);
    const body = await req.json();
    const result = generateSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ ok: false, error: 'Invalid input parameters.' }, { status: 400 });
    }

    const { date, instructorId, tenantId, serviceId } = result.data;
    const db = getAdminFirestore();

    const [tenantDoc, memberDoc, serviceDoc, eventsSnap] = await Promise.all([
      db.collection('tenants').doc(tenantId).get(),
      db.collection('tenants').doc(tenantId).collection('members').doc(user.uid).get(),
      db.collection('tenants').doc(tenantId).collection('services').doc(serviceId).get(),
      db.collection('tenants').doc(tenantId).collection('events').where('instructorId', '==', instructorId).get(),
    ]);
    const member = memberDoc.data();
    const isMainAdmin = user.email?.toLowerCase() === MAIN_ADMIN_EMAIL.toLowerCase();
    const canManageAll = isMainAdmin || member?.role === 'schoolAdmin';
    const isSchool = tenantDoc.data()?.type === 'school';
    if (!tenantDoc.exists || tenantDoc.data()?.status !== 'active' || (!isMainAdmin && member?.status !== 'active')) {
      return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 403 });
    }
    if (!serviceDoc.exists) return NextResponse.json({ ok: false, error: 'Choose an existing service first.' }, { status: 400 });
    if (!canManageAll && instructorId !== user.uid) return NextResponse.json({ ok: false, error: 'You may only schedule your own day.' }, { status: 403 });
    if (isSchool && member?.role === 'schoolInstructor' && instructorId !== user.uid) return NextResponse.json({ ok: false, error: 'You may only schedule your own day.' }, { status: 403 });

    const service = serviceDoc.data() || {};
    const duration = Number(service.duration) > 0 ? Number(service.duration) : 60;

    // Get active students assigned to instructor
    const studentsSnap = isSchool
      ? await db.collection('tenants').doc(tenantId).collection('students')
        .where('status', '==', 'active')
        .where('assignedInstructorIds', 'array-contains', instructorId)
        .get()
      : await db.collection('tenants').doc(tenantId).collection('students').where('status', '==', 'active').get();

    if (studentsSnap.empty) {
      return NextResponse.json({ ok: true, proposal: null, error: 'No active assigned students found.' });
    }

    const targetDate = new Date(`${date}T12:00:00`);
    const dayOfWeek = targetDate.getDay(); // 0 = Sun, 1 = Mon, etc.

    const candidates: ScheduleCandidate[] = [];

    // Get availabilities
    for (const doc of studentsSnap.docs) {
      const student = doc.data();
      if (!student.address) continue;

      const availDoc = await db.collection('tenants').doc(tenantId).collection('studentAvailability').doc(doc.id).get();
      if (!availDoc.exists) continue;

      const avail = availDoc.data() as StudentAvailability;

      // Determine applicable windows for this date
      const availableWindows: {start: string, end: string}[] = [];

      // Check overrides first
      const dateOverride = avail.overrides?.find(o => o.date === date);
      if (dateOverride) {
        if (!dateOverride.available) continue; // Explicitly unavailable

        if (dateOverride.startTime && dateOverride.endTime) {
          availableWindows.push({
            start: `${date}T${dateOverride.startTime}:00-04:00`,
            end: `${date}T${dateOverride.endTime}:00-04:00`
          });
        }
      } else {
        // Check weekly windows
        const dayWindows = avail.weeklyWindows?.filter(w => w.weekday === dayOfWeek) || [];
        for (const w of dayWindows) {
          availableWindows.push({
            start: `${date}T${w.startTime}:00-04:00`,
            end: `${date}T${w.endTime}:00-04:00`
          });
        }
      }

      if (availableWindows.length === 0) continue;

      candidates.push({
        studentId: doc.id,
        studentName: student.name,
        studentAddress: student.address,
        serviceId,
        serviceName: String(service.name || 'Driving lesson'),
        servicePrice: Number.isFinite(Number(service.price)) ? Number(service.price) : undefined,
        serviceCost: Number.isFinite(Number(service.cost)) ? Number(service.cost) : undefined,
        serviceDiscount: Number.isFinite(Number(service.discount)) ? Number(service.discount) : undefined,
        duration,
        availableWindows
      });
    }

    if (candidates.length === 0) {
      return NextResponse.json({ ok: true, proposal: null, error: 'No students available on this date.' });
    }

    const studentAddressById = new Map(studentsSnap.docs.map(doc => [doc.id, String(doc.data().address || '')]));
    const lockedEvents: ScheduleLockedEvent[] = eventsSnap.docs
      .map(doc => {
        const event = doc.data();
        return {
          id: doc.id,
          start: String(event.start || ''),
          end: String(event.end || ''),
          address: event.studentId ? studentAddressById.get(String(event.studentId)) : undefined,
        };
      })
      .filter(event => event.start.startsWith(date) && event.end && event.end > event.start && event.id);

    const proposal = await solveScheduleDeterministic(candidates, date, 8, 20, lockedEvents);

    return NextResponse.json({ ok: true, proposal });

  } catch (error) {
    console.error('Error in /api/schedule/generate:', error);
    if (error instanceof Error && error.name === 'RequestSecurityError') {
      return requestSecurityErrorResponse(error, 'Could not generate schedule.');
    }
    return NextResponse.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
