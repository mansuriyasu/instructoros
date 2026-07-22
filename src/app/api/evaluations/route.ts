import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/server/firebase-admin';
import { RequestSecurityError, requireRateLimitedUser } from '@/lib/server/request-security';
import { MAIN_ADMIN_EMAIL, normalizeEmail } from '@/lib/auth-config';
import { TEST_TYPES, calculateVerdict, countStatuses, normalizeAutofails, normalizeEvaluationItems, normalizeSheetExtras } from '@/lib/evaluation-criteria';
import { getExamSheetByVersion } from '@/lib/evaluation-sheets';
import type { Firestore, Query } from 'firebase-admin/firestore';

export const runtime = 'nodejs';

const TEST_TYPE_SET = new Set<string>(TEST_TYPES);

function errorResponse(error: unknown, fallback: string) {
  const status = error instanceof RequestSecurityError ? error.status : 500;
  return NextResponse.json({ error: error instanceof Error ? error.message : fallback }, { status });
}

function cleanString(value: unknown, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

async function getWorkspaceAccess(tenantId: string, uid: string, email?: string) {
  const db = getAdminFirestore();
  const [tenantSnap, memberSnap] = await Promise.all([
    db.collection('tenants').doc(tenantId).get(),
    db.collection('tenants').doc(tenantId).collection('members').doc(uid).get(),
  ]);
  const tenant = tenantSnap.data();
  const member = memberSnap.data();
  const mainAdmin = normalizeEmail(email) === MAIN_ADMIN_EMAIL;
  if (mainAdmin) return { db, tenant: tenant || {}, member: { role: 'mainAdmin' }, mainAdmin: true };
  if (!tenantSnap.exists || tenant?.status !== 'active' || member?.status !== 'active') {
    throw new RequestSecurityError('An active workspace membership is required.', 403);
  }
  return { db, tenant, member, mainAdmin: false };
}

async function validateLinkedRecords(db: Firestore, tenantId: string, studentId: string, lessonId: string) {
  const tenantRef = db.collection('tenants').doc(tenantId);
  const [studentSnap, lessonSnap] = await Promise.all([
    tenantRef.collection('students').doc(studentId).get(),
    tenantRef.collection('events').doc(lessonId).get(),
  ]);
  if (!studentSnap.exists) throw new RequestSecurityError('The selected student was not found.', 404);
  if (!lessonSnap.exists) throw new RequestSecurityError('The selected scheduled lesson was not found.', 404);
  const lesson = lessonSnap.data() || {};
  if (lesson.studentId !== studentId) throw new RequestSecurityError('The lesson is not linked to this student.', 400);
  return { student: studentSnap.data() || {}, lesson };
}

function normalizePayload(body: Record<string, unknown>) {
  const studentId = cleanString(body.studentId, 160);
  const lessonId = cleanString(body.lessonId, 160);
  const testType = cleanString(body.testType, 2);
  const date = cleanString(body.date, 40);
  const area = cleanString(body.area, 300);
  const instructor = cleanString(body.instructor, 160);
  const notes = cleanString(body.notes, 4000);
  const items = normalizeEvaluationItems(body.items);
  const autofails = normalizeAutofails(body.autofails);
  const { minors: minor_count, majors: major_count } = countStatuses(items);
  const sheetVersion = cleanString(body.sheetVersion, 40);
  const sheet = getExamSheetByVersion(sheetVersion);
  const base = { studentId, lessonId, testType, date, area, instructor, notes, items, autofails, minor_count, major_count };
  if (sheet) {
    // Official-sheet records: verdict follows the recorded outcome, not thresholds.
    const extras = normalizeSheetExtras(sheet, body);
    const verdict = extras.outcome === 'meets' ? 'pass' : extras.outcome === 'does-not-meet' ? 'fail' : 'borderline';
    return { ...base, ...extras, verdict };
  }
  return { ...base, verdict: calculateVerdict(minor_count, major_count, autofails.length) };
}

async function assertInstructorCanUseLesson(access: { member: { role?: string }; mainAdmin: boolean }, uid: string, lesson: Record<string, unknown>, student: Record<string, unknown>) {
  if (access.mainAdmin || access.member.role === 'schoolAdmin' || access.member.role === 'soloInstructor') return;
  if (access.member.role !== 'schoolInstructor') throw new RequestSecurityError('This role cannot create evaluations.', 403);
  const assigned = Array.isArray(student.assignedInstructorIds) && student.assignedInstructorIds.includes(uid);
  if (!assigned || lesson.instructorId !== uid) throw new RequestSecurityError('You can only evaluate students and lessons assigned to you.', 403);
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireRateLimitedUser(request, 'evaluations-read', 60);
    const tenantId = new URL(request.url).searchParams.get('tenantId') || '';
    const studentId = new URL(request.url).searchParams.get('studentId') || '';
    const lessonId = new URL(request.url).searchParams.get('lessonId') || '';
    if (!tenantId) return NextResponse.json({ error: 'Workspace is required.' }, { status: 400 });
    const access = await getWorkspaceAccess(tenantId, actor.uid, actor.email);
    const tenantRef = access.db.collection('tenants').doc(tenantId);
    let query: Query = tenantRef.collection('evaluations');
    if (studentId) query = query.where('studentId', '==', studentId);
    if (lessonId) query = query.where('lessonId', '==', lessonId);
    const snapshots = await query.limit(100).get();
    const results = [];
    for (const snapshot of snapshots.docs) {
      const evaluation = { id: snapshot.id, ...snapshot.data() } as Record<string, unknown>;
      if (!access.mainAdmin && access.member.role === 'schoolInstructor' && evaluation.instructorUid !== actor.uid) continue;
      results.push(evaluation);
    }
    results.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    return NextResponse.json({ evaluations: results });
  } catch (error) {
    return errorResponse(error, 'Could not load evaluations.');
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireRateLimitedUser(request, 'evaluations-write', 30);
    const body = await request.json().catch(() => ({}));
    const tenantId = cleanString(body.tenantId, 160);
    const payload = normalizePayload(body);
    if (!tenantId || !payload.studentId || !payload.lessonId || !TEST_TYPE_SET.has(payload.testType) || !payload.date || !payload.items.length) {
      return NextResponse.json({ error: 'Student, scheduled lesson, test type, date, and maneuvers are required.' }, { status: 400 });
    }
    const access = await getWorkspaceAccess(tenantId, actor.uid, actor.email);
    const linked = await validateLinkedRecords(access.db, tenantId, payload.studentId, payload.lessonId);
    await assertInstructorCanUseLesson(access, actor.uid, linked.lesson, linked.student);
    const instructorName = payload.instructor || actor.name || actor.email || 'Instructor';
    const now = new Date().toISOString();
    const docRef = await access.db.collection('tenants').doc(tenantId).collection('evaluations').add({
      ...payload,
      instructor: instructorName,
      instructorUid: actor.uid,
      createdByUid: actor.uid,
      created_at: now,
      updated_at: now,
    });
    return NextResponse.json({ evaluation: { id: docRef.id, ...payload, instructor: instructorName, instructorUid: actor.uid, createdByUid: actor.uid, created_at: now, updated_at: now } }, { status: 201 });
  } catch (error) {
    return errorResponse(error, 'Could not save evaluation.');
  }
}
