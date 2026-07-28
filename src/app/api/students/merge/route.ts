import { NextRequest, NextResponse } from 'next/server';
import { MAIN_ADMIN_EMAIL, normalizeEmail } from '@/lib/auth-config';
import { getAdminFirestore } from '@/lib/server/firebase-admin';
import { RequestSecurityError, requireRateLimitedUser } from '@/lib/server/request-security';
import type { DocumentReference } from 'firebase-admin/firestore';

export const runtime = 'nodejs';

const MAX_DUPLICATES = 25;
const MERGEABLE_FIELDS = [
  'name', 'mobileNumber', 'email', 'address', 'birthdate', 'licenseNumber',
  'licenseExpiry', 'licenseType', 'status', 'comments', 'registrationDate',
  'avatarUrl', 'licenseImageUrl', 'tags', 'assignedInstructorIds',
] as const;

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function firstValue(primary: Record<string, unknown>, duplicates: Record<string, unknown>[], field: string) {
  if (primary[field] !== undefined && primary[field] !== null && primary[field] !== '') return primary[field];
  return duplicates.find(record => record[field] !== undefined && record[field] !== null && record[field] !== '')?.[field];
}

function mergeStudent(primary: Record<string, unknown>, duplicates: Record<string, unknown>[]) {
  const merged: Record<string, unknown> = {};
  for (const field of MERGEABLE_FIELDS) {
    const value = firstValue(primary, duplicates, field);
    if (value !== undefined) merged[field] = value;
  }

  const tags = new Set<string>();
  const instructors = new Set<string>();
  for (const record of [primary, ...duplicates]) {
    if (Array.isArray(record.tags)) record.tags.forEach(tag => typeof tag === 'string' && tag.trim() && tags.add(tag.trim()));
    if (Array.isArray(record.assignedInstructorIds)) record.assignedInstructorIds.forEach(uid => typeof uid === 'string' && uid && instructors.add(uid));
  }
  merged.tags = [...tags];
  merged.assignedInstructorIds = [...instructors];

  const comments = [
    typeof primary.comments === 'string' ? primary.comments.trim() : '',
    ...duplicates.map(record => {
      const comment = typeof record.comments === 'string' ? record.comments.trim() : '';
      return comment && comment !== primary.comments ? `Merged record note: ${comment}` : '';
    }),
  ].filter(Boolean);
  merged.comments = [...new Set(comments)].join('\n\n');
  return merged;
}

function errorResponse(error: unknown) {
  const status = error instanceof RequestSecurityError ? error.status : 500;
  return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not merge students.' }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireRateLimitedUser(request, 'students-merge', 10);
    const body = await request.json().catch(() => ({}));
    const tenantId = text(body.tenantId);
    const primaryId = text(body.primaryId);
    const duplicateIds: string[] = Array.isArray(body.duplicateIds)
      ? [...new Set<string>(body.duplicateIds.map((value: unknown) => text(value)).filter((value: unknown): value is string => Boolean(value)))]
      : [];

    if (!tenantId || !primaryId || duplicateIds.length === 0 || duplicateIds.length > MAX_DUPLICATES || duplicateIds.includes(primaryId)) {
      return NextResponse.json({ error: 'Choose one primary student and one to twenty-five duplicates.' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const tenantRef = db.collection('tenants').doc(tenantId);
    const [tenantSnapshot, memberSnapshot] = await Promise.all([
      tenantRef.get(),
      tenantRef.collection('members').doc(actor.uid).get(),
    ]);
    const isMainAdmin = normalizeEmail(actor.email) === MAIN_ADMIN_EMAIL;
    const member = memberSnapshot.data() || {};
    if (!isMainAdmin && (!tenantSnapshot.exists || tenantSnapshot.data()?.status !== 'active' || member.status !== 'active' || !['schoolAdmin', 'soloInstructor'].includes(member.role))) {
      throw new RequestSecurityError('Only a workspace administrator can merge students.', 403);
    }

    const studentRef = tenantRef.collection('students');
    const studentSnapshots = await Promise.all([primaryId, ...duplicateIds].map(id => studentRef.doc(id).get()));
    if (studentSnapshots.some(snapshot => !snapshot.exists)) {
      throw new RequestSecurityError('One of the selected students no longer exists.', 404);
    }
    const primarySnapshot = studentSnapshots[0];
    const duplicateSnapshots = studentSnapshots.slice(1);
    const primary = primarySnapshot.data() || {};
    const duplicates = duplicateSnapshots.map(snapshot => snapshot.data() || {});
    const merged = mergeStudent(primary, duplicates);

    const allIds = [primaryId, ...duplicateIds];
    const references = ['events', 'payments', 'evaluations'];
    const writes: Array<{ ref: DocumentReference; data: Record<string, unknown> }> = [];
    for (const collectionName of references) {
      for (let index = 0; index < allIds.length; index += 30) {
        const ids = allIds.slice(index, index + 30);
        const snapshots = await tenantRef.collection(collectionName).where('studentId', 'in', ids).get();
        snapshots.docs.forEach(snapshot => {
          if (snapshot.data().studentId !== primaryId) {
            writes.push({ ref: snapshot.ref, data: { studentId: primaryId, studentName: merged.name || primary.name || 'Student' } });
          }
        });
      }
    }

    const operations = [
      { ref: primarySnapshot.ref, data: { ...merged, updatedAt: new Date().toISOString() } },
      ...writes,
      ...duplicateSnapshots.map(snapshot => ({ ref: snapshot.ref, data: { mergedIntoStudentId: primaryId, mergedAt: new Date().toISOString(), status: 'deactivated' } })),
    ];
    for (let index = 0; index < operations.length; index += 450) {
      const batch = db.batch();
      operations.slice(index, index + 450).forEach(operation => batch.set(operation.ref, operation.data, { merge: true }));
      await batch.commit();
    }

    // Keep a reversible audit marker for the duplicate documents instead of hard-deleting them.
    return NextResponse.json({
      ok: true,
      primaryId,
      mergedStudentCount: duplicateIds.length,
      reassignedRecordCount: writes.length,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
