import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/server/firebase-admin';
import { RequestSecurityError, requireRateLimitedUser } from '@/lib/server/request-security';
import { isEmailConfigured, isValidEmail, maskEmail, sendEmail } from '@/lib/server/email';
import { type EmailBranding, lessonEmail, paymentReceiptEmail, welcomeEmail } from '@/lib/server/email-templates';

export const runtime = 'nodejs';

// Sends a fixed template to a student of the caller's workspace. The recipient always comes from
// the student record, never from the request, so this can't be used to email arbitrary addresses.

function text(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function badRequest(error: string) {
  return NextResponse.json({ ok: false, error }, { status: 400 });
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireRateLimitedUser(request, 'student-email', 60);
    if (!isEmailConfigured()) {
      return NextResponse.json({ ok: false, error: 'Email is not set up on the server yet.' }, { status: 503 });
    }
    const body = await request.json().catch(() => ({}));
    const tenantId = text(body.tenantId, 128);
    const studentId = text(body.studentId, 128);
    const template = text(body.template, 20);
    const data = (body.data && typeof body.data === 'object' ? body.data : {}) as Record<string, unknown>;
    if (!tenantId || !studentId) return badRequest('Workspace and student are required.');

    const db = getAdminFirestore();
    const tenantRef = db.collection('tenants').doc(tenantId);
    const [tenantSnap, memberSnap, studentSnap] = await Promise.all([
      tenantRef.get(),
      tenantRef.collection('members').doc(actor.uid).get(),
      tenantRef.collection('students').doc(studentId).get(),
    ]);
    const tenant = tenantSnap.data();
    const member = memberSnap.data();
    if (!tenantSnap.exists || tenant?.status !== 'active' || member?.status !== 'active') {
      return NextResponse.json({ ok: false, error: 'This account is not active in the selected workspace.' }, { status: 403 });
    }
    const student = studentSnap.data();
    if (!studentSnap.exists || !student) {
      return NextResponse.json({ ok: false, error: 'Student not found.' }, { status: 404 });
    }
    if (member.role === 'schoolInstructor') {
      const assigned = Array.isArray(student.assignedInstructorIds) && student.assignedInstructorIds.includes(actor.uid);
      if (!assigned && student.instructorId !== actor.uid) {
        return NextResponse.json({ ok: false, error: 'This student is not assigned to you.' }, { status: 403 });
      }
    }

    const to = String(student.email || '').trim();
    if (!isValidEmail(to)) {
      return NextResponse.json({ ok: false, code: 'missing_email', error: `${student.name || 'This student'} has no email address saved.` }, { status: 422 });
    }

    const branding = tenant as EmailBranding;
    const studentName = String(student.name || 'there');
    let message;
    if (template === 'payment') {
      const amount = Number(data.amount);
      if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) return badRequest('Enter a valid payment amount.');
      message = paymentReceiptEmail(branding, { studentName, amount, servicesDesc: text(data.servicesDesc, 300) || 'your lessons' });
    } else if (template === 'lesson') {
      const start = new Date(text(data.start, 40));
      const end = new Date(text(data.end, 40));
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return badRequest('The lesson time is not valid.');
      const eventId = text(data.eventId, 128);
      message = lessonEmail(branding, {
        studentName,
        isUpdate: data.isUpdate === true,
        start,
        end,
        timeZone: text(data.timeZone, 64) || 'America/Toronto',
        services: text(data.services, 200) || 'Driving lesson',
        address: text(data.address, 300) || 'your pickup address on file',
        eventId: /^[\w-]+$/.test(eventId) ? eventId : undefined,
      });
    } else if (template === 'welcome') {
      message = welcomeEmail(branding, { studentName });
    } else {
      return badRequest('Unknown message type.');
    }

    const log = (entry: Record<string, unknown>) =>
      tenantRef.collection('smsLogs').add({ to, body: message.subject, channel: 'email', date: new Date().toISOString(), studentId, sentBy: actor.uid, ...entry })
        .catch(error => console.error('email_log_failed', error instanceof Error ? error.message : error));

    try {
      await sendEmail({ ...message, to });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Could not send the email.';
      await log({ status: 'error', errorMessage });
      return NextResponse.json({ ok: false, error: errorMessage }, { status: 502 });
    }
    await log({ status: 'sent' });
    return NextResponse.json({ ok: true, to: maskEmail(to) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not send the email.';
    const status = error instanceof RequestSecurityError ? error.status : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
