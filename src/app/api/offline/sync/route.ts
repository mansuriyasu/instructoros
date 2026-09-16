import { NextRequest, NextResponse } from 'next/server';
import { offlineActor, assertAccess, assigned, currentStudent, documentId, revision, phoneKey, fingerprint } from '@/lib/server/offline';
import { offlineOperation } from '@/lib/offline-validation';
import { RequestSecurityError, requestSecurityErrorResponse } from '@/lib/server/request-security';
import { normalizeEvaluationItems, normalizeAutofails, countStatuses, calculateVerdict } from '@/lib/evaluation-criteria';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const raw = await request.text();
    if (raw.length > 100000) throw new RequestSecurityError('Draft is too large.', 413);
    let input: unknown;
    try { input = JSON.parse(raw); } catch { throw new RequestSecurityError('Invalid draft.', 400); }
    const parsed = offlineOperation.safeParse(input);
    if (!parsed.success) throw new RequestSecurityError('Draft contains invalid or missing fields. Review it before retrying.', 400);
    const { tenantId, id, operation } = parsed.data;
    const { actor, tenantRef, db } = await offlineActor(request, tenantId, true);
    const receiptRef = tenantRef.collection('offlineOperations').doc(`${actor.uid}_${id}`);
    const digest = fingerprint(operation);
    const result = await db.runTransaction(async transaction => {
      // Re-read authorization inside the transaction so revocation/billing changes race safely.
      const [tenantDoc, memberDoc, receipt] = await Promise.all([
        transaction.get(tenantRef), transaction.get(tenantRef.collection('members').doc(actor.uid)), transaction.get(receiptRef),
      ]);
      const member = memberDoc.data();
      assertAccess(tenantDoc.data(), member, true);
      if (receipt.exists) {
        if (receipt.data()?.digest !== digest) throw new RequestSecurityError('This draft was already submitted with different contents. Review it online.', 409);
        return { recordId: receipt.data()!.recordId, alreadySynced: true };
      }
      const now = new Date().toISOString();
      let recordId: string;
      if (operation.kind === 'student') {
        const p = operation.payload;
        const existing = await transaction.get(tenantRef.collection('students').select('name', 'mobileNumber', 'mergedIntoStudentId'));
        const phone = phoneKey(p.mobileNumber);
        if (existing.docs.some(doc => { const s = doc.data(); return !s.mergedIntoStudentId && ((phone && phoneKey(String(s.mobileNumber || '')) === phone) || String(s.name || '').trim().toLowerCase() === p.name.toLowerCase()); })) {
          throw new RequestSecurityError('A possible duplicate student exists. Review Students online before creating this record. Your draft is still on this phone.', 409);
        }
        const ref = tenantRef.collection('students').doc(`offline-${id}`);
        recordId = ref.id;
        transaction.create(ref, { ...p, birthdate: '', licenseNumber: '', licenseExpiry: '', tags: [], assignedInstructorIds: member!.role === 'schoolInstructor' ? [actor.uid] : [], registrationDate: now, status: 'active' });
      } else {
        const p = operation.payload;
        const studentRef = tenantRef.collection('students').doc(documentId(p.studentId));
        const lessonRef = tenantRef.collection('events').doc(documentId(p.lessonId));
        const [studentDoc, lessonDoc] = await Promise.all([transaction.get(studentRef), transaction.get(lessonRef)]);
        const student = studentDoc.data(); const lesson = lessonDoc.data();
        if (!student || !lesson || !currentStudent(student) || lesson.studentId !== p.studentId || ['cancelled', 'no-show'].includes(lesson.lessonStatus)) throw new RequestSecurityError('This student or lesson is no longer available. Review this draft online.', 409);
        if (member!.role === 'schoolInstructor' && !assigned(student, actor.uid)) throw new RequestSecurityError('This student is no longer assigned to you. The draft has not been uploaded.', 403);
        if (member!.role === 'schoolInstructor' && lesson.instructorId !== actor.uid) throw new RequestSecurityError('You can only edit lessons assigned to you.', 403);
        if (operation.kind === 'evaluation' && member!.role === 'schoolInstructor' && (lesson.instructorId !== actor.uid || !Array.isArray(student.assignedInstructorIds) || !student.assignedInstructorIds.includes(actor.uid))) throw new RequestSecurityError('You can only evaluate students and lessons assigned to you.', 403);
        if (revision(lessonDoc) !== p.version) throw new RequestSecurityError('This lesson changed after your download. Compare the latest lesson with this draft before resubmitting.', 409);
        if (operation.kind === 'note') {
          recordId = lessonRef.id;
          transaction.update(lessonRef, { notes: operation.payload.notes });
        } else {
          const { version: _version, ...payload } = operation.payload;
          void _version;
          const items = normalizeEvaluationItems(payload.items);
          const autofails = normalizeAutofails(payload.autofails);
          const counts = countStatuses(items);
          const ref = tenantRef.collection('evaluations').doc(`offline-${id}`);
          recordId = ref.id;
          transaction.create(ref, { ...payload, items, autofails, minor_count: counts.minors, major_count: counts.majors, verdict: calculateVerdict(counts.minors, counts.majors, autofails.length), instructor: String(member!.displayName || actor.name || actor.email || 'Instructor'), instructorUid: actor.uid, createdByUid: actor.uid, created_at: now, updated_at: now });
        }
      }
      transaction.create(receiptRef, { digest, kind: operation.kind, recordId, uid: actor.uid, syncedAt: now });
      return { recordId, alreadySynced: false };
    });
    return NextResponse.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return requestSecurityErrorResponse(error, 'Could not upload this draft. It remains on this phone and can be retried.'); }
}
