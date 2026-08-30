import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/server/firebase-admin';
import { RequestSecurityError, requireRateLimitedUser } from '@/lib/server/request-security';

export const runtime = 'nodejs';

const STUDENT_LIST_FIELDS = [
  'name',
  'mobileNumber',
  'email',
  'address',
  'birthdate',
  'licenseNumber',
  'licenseExpiry',
  'licenseType',
  'status',
  'comments',
  'tags',
  'assignedInstructorIds',
  'instructorId',
  'registrationDate',
  'registrationCompletedAt',
  'portalEmail',
  'portalStatus',
  'privacyAcceptedAt',
  'mergedIntoStudentId',
  'mergedAt',
] as const;

function asListRecord(snapshot: FirebaseFirestore.QueryDocumentSnapshot) {
  return { ...snapshot.data(), id: snapshot.id };
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireRateLimitedUser(request, 'students-list', 60);
    const body = await request.json().catch(() => ({}));
    const tenantId = String(body.tenantId || '');
    if (!tenantId) return NextResponse.json({ error: 'Workspace is required.' }, { status: 400 });

    const db = getAdminFirestore();
    const tenantRef = db.collection('tenants').doc(tenantId);
    const [tenantSnap, memberSnap] = await Promise.all([
      tenantRef.get(),
      tenantRef.collection('members').doc(actor.uid).get(),
    ]);
    const tenant = tenantSnap.data();
    const member = memberSnap.data();

    if (!tenantSnap.exists || tenant?.status !== 'active' || member?.status !== 'active') {
      return NextResponse.json({ error: 'This account is not active in the selected workspace.' }, { status: 403 });
    }

    const studentsRef = tenantRef.collection('students');

    if (member.role === 'schoolInstructor') {
      const [assignedSnapshots, legacySnapshots] = await Promise.all([
        studentsRef
          .where('assignedInstructorIds', 'array-contains', actor.uid)
          .select(...STUDENT_LIST_FIELDS)
          .get(),
        studentsRef
          .where('instructorId', '==', actor.uid)
          .select(...STUDENT_LIST_FIELDS)
          .get(),
      ]);
      const documents = new Map<string, Record<string, unknown>>();
      for (const snapshot of [...assignedSnapshots.docs, ...legacySnapshots.docs]) {
        documents.set(snapshot.id, asListRecord(snapshot));
      }
      return NextResponse.json({ students: Array.from(documents.values()) });
    }

    const snapshot = await studentsRef.select(...STUDENT_LIST_FIELDS).get();
    return NextResponse.json({ students: snapshot.docs.map(asListRecord) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load students.';
    const status = error instanceof RequestSecurityError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
