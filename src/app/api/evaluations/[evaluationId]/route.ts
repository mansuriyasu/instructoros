import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/server/firebase-admin';
import { RequestSecurityError, requireRateLimitedUser } from '@/lib/server/request-security';
import { MAIN_ADMIN_EMAIL, normalizeEmail } from '@/lib/auth-config';
import { TEST_TYPES, calculateVerdict, countStatuses, normalizeAutofails, normalizeEvaluationItems } from '@/lib/evaluation-criteria';
import type { EvaluationItem } from '@/lib/types';

export const runtime = 'nodejs';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ evaluationId: string }> }) {
  try {
    const actor = await requireRateLimitedUser(request, 'evaluation-update', 30);
    const { evaluationId } = await params;
    const body = await request.json().catch(() => ({}));
    const tenantId = String(body.tenantId || '');
    if (!tenantId || !evaluationId) return NextResponse.json({ error: 'Workspace and evaluation are required.' }, { status: 400 });
    const db = getAdminFirestore();
    const tenantRef = db.collection('tenants').doc(tenantId);
    const [tenantSnap, memberSnap, evaluationSnap] = await Promise.all([
      tenantRef.get(), tenantRef.collection('members').doc(actor.uid).get(), tenantRef.collection('evaluations').doc(evaluationId).get(),
    ]);
    const mainAdmin = normalizeEmail(actor.email) === MAIN_ADMIN_EMAIL;
    const member = memberSnap.data();
    const evaluation = evaluationSnap.data();
    if (!tenantSnap.exists || tenantSnap.data()?.status !== 'active' || (!mainAdmin && member?.status !== 'active')) throw new RequestSecurityError('An active workspace membership is required.', 403);
    if (!evaluationSnap.exists || !evaluation) return NextResponse.json({ error: 'Evaluation was not found.' }, { status: 404 });
    const canEdit = mainAdmin || member?.role === 'schoolAdmin' || member?.role === 'soloInstructor' || evaluation.createdByUid === actor.uid;
    if (!canEdit) throw new RequestSecurityError('Only the evaluation creator or a workspace administrator can edit this evaluation.', 403);
    // Counts and verdict are always recomputed server-side — client-sent
    // values for them are ignored.
    const allowed = ['testType', 'date', 'area', 'instructor', 'notes'];
    const changes: Record<string, unknown> = Object.fromEntries(allowed.filter(key => Object.prototype.hasOwnProperty.call(body, key)).map(key => [key, body[key]]));
    if (Object.prototype.hasOwnProperty.call(changes, 'testType') && !TEST_TYPES.includes(changes.testType as never)) {
      return NextResponse.json({ error: 'Unknown test type.' }, { status: 400 });
    }
    if (Object.prototype.hasOwnProperty.call(body, 'items')) {
      const items = normalizeEvaluationItems(body.items);
      if (!items.length) return NextResponse.json({ error: 'At least one maneuver is required.' }, { status: 400 });
      changes.items = items;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'autofails')) {
      changes.autofails = normalizeAutofails(body.autofails);
    }
    const effectiveItems = (changes.items as EvaluationItem[] | undefined) ?? normalizeEvaluationItems(evaluation.items);
    const effectiveAutofails = (changes.autofails as string[] | undefined) ?? normalizeAutofails(evaluation.autofails);
    const { minors, majors } = countStatuses(effectiveItems);
    changes.minor_count = minors;
    changes.major_count = majors;
    changes.verdict = calculateVerdict(minors, majors, effectiveAutofails.length);
    await tenantRef.collection('evaluations').doc(evaluationId).set({ ...changes, updated_at: new Date().toISOString() }, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = error instanceof RequestSecurityError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not update evaluation.' }, { status });
  }
}
