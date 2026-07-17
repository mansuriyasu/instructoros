import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/server/firebase-admin';
import { RequestSecurityError, requireRateLimitedUser } from '@/lib/server/request-security';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const actor = await requireRateLimitedUser(request, 'assigned-students', 30);
    const body = await request.json().catch(() => ({}));
    const tenantId = String(body.tenantId || '');
    if (!tenantId) return NextResponse.json({ error: 'Workspace is required.' }, { status: 400 });

    const db = getAdminFirestore();
    const [tenantSnap, memberSnap] = await Promise.all([
      db.collection('tenants').doc(tenantId).get(),
      db.collection('tenants').doc(tenantId).collection('members').doc(actor.uid).get(),
    ]);
    const member = memberSnap.data();
    if (!tenantSnap.exists || tenantSnap.data()?.status !== 'active' || member?.status !== 'active' || member.role !== 'schoolInstructor') {
      return NextResponse.json({ error: 'This instructor is not active in the selected school workspace.' }, { status: 403 });
    }

    const studentCollection = db.collection('tenants').doc(tenantId).collection('students');
    const [assignedSnapshots, legacySnapshots] = await Promise.all([
      studentCollection.where('assignedInstructorIds', 'array-contains', actor.uid).get(),
      studentCollection.where('instructorId', '==', actor.uid).get(),
    ]);
    const documents = new Map<string, Record<string, unknown>>();
    for (const snapshot of [...assignedSnapshots.docs, ...legacySnapshots.docs]) {
      documents.set(snapshot.id, { ...snapshot.data(), id: snapshot.id });
    }

    return NextResponse.json({ students: Array.from(documents.values()) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load assigned students.';
    const status = error instanceof RequestSecurityError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
