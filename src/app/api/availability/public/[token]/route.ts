import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/server/request-security';
import { getAdminFirestore } from '@/lib/server/firebase-admin';
import crypto from 'crypto';
import { StudentAvailability } from '@/lib/types';
import { z } from 'zod';

const availabilityEligibleStatuses = new Set(['active', 'booked']);

const availabilitySchema = z.object({
  weeklyWindows: z.array(z.object({
    weekday: z.number().min(0).max(6),
    startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
    endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  }).refine(value => value.startTime < value.endTime, { message: 'End time must be after start time.' })).max(42),
  overrides: z.array(z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
    endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
    available: z.boolean(),
  }).refine(value => !value.available || (Boolean(value.startTime && value.endTime) && value.startTime! < value.endTime!), {
    message: 'Available dates need a valid time window.'
  })).max(366),
}).superRefine((value, ctx) => {
  const dates = value.overrides.map(item => item.date);
  if (new Set(dates).size !== dates.length) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['overrides'], message: 'Each override date may appear only once.' });
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    enforceRateLimit(`pub-avail-get:${ip}`, 30, 15 * 60 * 1000);

    const { token } = await params;
    if (!token || typeof token !== 'string') {
      return NextResponse.json({ ok: false, error: 'Invalid token.' }, { status: 400 });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const db = getAdminFirestore();

    const snapshot = await db.collectionGroup('studentAvailability')
      .where('tokenHash', '==', tokenHash)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ ok: false, error: 'Link is invalid or expired.' }, { status: 404 });
    }

    const data = snapshot.docs[0].data() as StudentAvailability;
    if (!data.tokenEnabled) {
      return NextResponse.json({ ok: false, error: 'Link is disabled.' }, { status: 403 });
    }

    // Verify student is still active
    const studentDoc = await db.collection('tenants').doc(data.tenantId).collection('students').doc(data.studentId).get();
    if (!studentDoc.exists || !availabilityEligibleStatuses.has(String(studentDoc.data()?.status || ''))) {
      return NextResponse.json({ ok: false, error: 'Student account is not active.' }, { status: 403 });
    }

    const studentName = studentDoc.data()?.name || 'Student';

    // Mask PII
    return NextResponse.json({
      ok: true,
      studentName,
      availability: {
        weeklyWindows: data.weeklyWindows || [],
        overrides: data.overrides || [],
        timezone: data.timezone,
      }
    });

  } catch (error) {
    if (error instanceof Error && error.name === 'RequestSecurityError') {
      return NextResponse.json({ ok: false, error: 'Too many requests.' }, { status: 429 });
    }
    return NextResponse.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    enforceRateLimit(`pub-avail-post:${ip}`, 10, 15 * 60 * 1000);

    const { token } = await params;
    if (!token || typeof token !== 'string') {
      return NextResponse.json({ ok: false, error: 'Invalid token.' }, { status: 400 });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const db = getAdminFirestore();

    const snapshot = await db.collectionGroup('studentAvailability')
      .where('tokenHash', '==', tokenHash)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ ok: false, error: 'Link is invalid or expired.' }, { status: 404 });
    }

    const doc = snapshot.docs[0];
    const data = doc.data() as StudentAvailability;

    if (!data.tokenEnabled) {
      return NextResponse.json({ ok: false, error: 'Link is disabled.' }, { status: 403 });
    }

    const studentDoc = await db.collection('tenants').doc(data.tenantId).collection('students').doc(data.studentId).get();
    if (!studentDoc.exists || !availabilityEligibleStatuses.has(String(studentDoc.data()?.status || ''))) {
      return NextResponse.json({ ok: false, error: 'Student account is not active.' }, { status: 403 });
    }

    const body = await req.json();
    const result = availabilitySchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ ok: false, error: 'Invalid availability format.' }, { status: 400 });
    }

    await doc.ref.update({
      weeklyWindows: result.data.weeklyWindows,
      overrides: result.data.overrides,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });

  } catch (error) {
    if (error instanceof Error && error.name === 'RequestSecurityError') {
      return NextResponse.json({ ok: false, error: 'Too many requests.' }, { status: 429 });
    }
    return NextResponse.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
