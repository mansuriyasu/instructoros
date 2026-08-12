import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { RequestSecurityError } from '@/lib/server/request-security';
import { getAdminAuth } from '@/lib/server/firebase-admin';
import { getStudentPortalContext } from '@/lib/server/student-portal';

export const runtime = 'nodejs';
const schema = z.object({
  weeklyWindows: z.array(z.object({ weekday: z.number().min(0).max(6), startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/), endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/) }).refine(v => v.startTime < v.endTime)).max(42),
  overrides: z.array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(), endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(), available: z.boolean() })).max(366),
  timezone: z.string().max(80).optional(),
});

async function context(request: NextRequest) {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new RequestSecurityError('Please sign in before editing availability.', 401);
  const actor = await getAdminAuth().verifyIdToken(token);
  return getStudentPortalContext(actor.uid);
}

export async function PATCH(request: NextRequest) {
  try {
    const { tenantRef, studentRef } = await context(request);
    const result = schema.safeParse(await request.json());
    if (!result.success) return NextResponse.json({ error: 'Please enter valid availability times.' }, { status: 400 });
    await tenantRef.collection('studentAvailability').doc(studentRef.id).set({ ...result.data, tenantId: tenantRef.id, studentId: studentRef.id, updatedAt: new Date().toISOString() }, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = error instanceof RequestSecurityError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not save availability.' }, { status });
  }
}
