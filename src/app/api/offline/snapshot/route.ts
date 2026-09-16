import { NextRequest, NextResponse } from 'next/server';
import { offlineActor, assigned, currentStudent, revision } from '@/lib/server/offline';
import { requestSecurityErrorResponse } from '@/lib/server/request-security';
import { getWorkspaceAccess } from '@/lib/workspace-access';
import { EVALUATION_SECTIONS } from '@/lib/evaluation-criteria';
import type { Tenant } from '@/lib/auth-config';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { actor, tenantRef, tenant, member } = await offlineActor(request, body.tenantId);
    const studentsRef = tenantRef.collection('students');
    const fields = ['name', 'address', 'mobileNumber', 'licenseType', 'status', 'assignedInstructorIds', 'instructorId', 'mergedIntoStudentId'];
    const studentSets = member.role === 'schoolInstructor'
      ? await Promise.all([studentsRef.where('assignedInstructorIds', 'array-contains', actor.uid).select(...fields).get(), studentsRef.where('instructorId', '==', actor.uid).select(...fields).get()])
      : [await studentsRef.select(...fields).get()];
    const studentDocs = [...new Map(studentSets.flatMap(set => set.docs).map(doc => [doc.id, doc])).values()].filter(doc => currentStudent(doc.data()));
    const studentData = new Map(studentDocs.map(doc => [doc.id, doc.data()]));
    const students = studentDocs.map(doc => { const s = doc.data(); return { id: doc.id, name: String(s.name || ''), address: String(s.address || ''), mobileNumber: String(s.mobileNumber || ''), licenseType: String(s.licenseType || 'G2'), status: s.status }; });
    // Include the whole current local day across Canadian timezones, plus seven days ahead.
    const now = new Date();
    const start = new Date(now); start.setUTCHours(0, 0, 0, 0); start.setUTCDate(start.getUTCDate() - 1);
    const end = new Date(now.getTime() + 7 * 86400000);
    const events = await tenantRef.collection('events').where('start', '>=', start.toISOString()).where('start', '<=', end.toISOString()).get();
    const lessons = events.docs.filter(doc => {
      const e = doc.data();
      return studentData.has(e.studentId) && !['cancelled', 'no-show'].includes(e.lessonStatus) && (member.role !== 'schoolInstructor' || e.instructorId === actor.uid || assigned(studentData.get(e.studentId)!, actor.uid));
    }).map(doc => { const e = doc.data(); const s = studentData.get(e.studentId)!; return { id: doc.id, studentId: e.studentId, studentName: String(s.name || ''), start: String(e.start), end: String(e.end), notes: String(e.notes || ''), version: revision(doc), canWriteNotes: member.role !== 'schoolInstructor' || e.instructorId === actor.uid, canEvaluate: member.role !== 'schoolInstructor' || (Array.isArray(s.assignedInstructorIds) && s.assignedInstructorIds.includes(actor.uid) && e.instructorId === actor.uid) }; }).sort((a, b) => a.start.localeCompare(b.start));
    return NextResponse.json({ scope: `${actor.uid}:${tenantRef.id}`, uid: actor.uid, tenantId: tenantRef.id, workspaceName: String(tenant.receiptBusinessName || tenant.name || 'InstructorOS'), downloadedAt: now.toISOString(), expiresAt: end.toISOString(), canWrite: getWorkspaceAccess(tenant as Tenant).canWrite, students, lessons, criteria: EVALUATION_SECTIONS }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return requestSecurityErrorResponse(error, 'Could not download offline data. Your previous download has not been replaced.'); }
}
