import { NextRequest, NextResponse } from 'next/server';
import { getBillingActor } from '@/lib/server/billing-auth';
import { publicBillingError } from '@/lib/server/stripe';
import { recordWorkspaceActivity } from '@/lib/server/activity';

export const runtime = 'nodejs';

const TRIAL_DAYS = 30;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const tenantId = String(body.tenantId || '');
    if (!tenantId) return NextResponse.json({ error: 'Missing workspace.' }, { status: 400 });

    const { tenant, tenantRef } = await getBillingActor(request, tenantId, { requireOwner: true });
    if (tenant.status !== 'active') {
      return NextResponse.json({ error: 'This workspace is not active.' }, { status: 400 });
    }
    if (tenant.stripeSubscriptionId || tenant.subscriptionStatus === 'active') {
      return NextResponse.json({ error: 'This workspace already has an active subscription.' }, { status: 400 });
    }
    if (tenant.subscriptionStatus === 'trialing' && tenant.trialEndsAt) {
      return NextResponse.json({ status: 'trialing', trialEndsAt: tenant.trialEndsAt });
    }
    if (tenant.trialEndsAt || tenant.freeAccessUntil) {
      return NextResponse.json({ error: 'The free trial has already been used for this workspace.' }, { status: 400 });
    }

    const now = new Date();
    const trialEndsAt = new Date(now);
    trialEndsAt.setUTCDate(trialEndsAt.getUTCDate() + TRIAL_DAYS);

    await tenantRef.set({
      subscriptionStatus: 'trialing',
      billingLocked: false,
      trialStartedAt: now.toISOString(),
      trialEndsAt: trialEndsAt.toISOString(),
      freeAccessReason: '30-day free trial',
      updatedAt: now.toISOString(),
    }, { merge: true });

    await recordWorkspaceActivity({
      tenantId,
      actorUid: tenant.ownerUid,
      actorEmail: tenant.ownerEmail,
      actorRole: 'workspaceOwner',
      action: 'trial_activated',
      entityType: 'tenant',
      entityId: tenantId,
      metadata: { days: TRIAL_DAYS },
    });

    return NextResponse.json({ status: 'trialing', trialEndsAt: trialEndsAt.toISOString() });
  } catch (error) {
    return NextResponse.json({ error: publicBillingError(error, 'Could not activate the free trial.') }, { status: 500 });
  }
}
