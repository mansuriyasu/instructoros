import type Stripe from 'stripe';
import { PLAN_DETAILS, getBillingLocked, getExtraSeats, isBillingPlan, type BillingPlan } from '@/lib/billing';
import { getAdminFirestore } from '@/lib/server/firebase-admin';

function secondsToIso(value?: number | null) {
  return value ? new Date(value * 1000).toISOString() : null;
}

function getStringId(value: string | { id: string } | null | undefined) {
  if (!value) return '';
  return typeof value === 'string' ? value : value.id;
}

export async function findTenantBySubscriptionId(subscriptionId: string) {
  const snapshot = await getAdminFirestore()
    .collection('tenants')
    .where('stripeSubscriptionId', '==', subscriptionId)
    .limit(1)
    .get();

  return snapshot.empty ? null : snapshot.docs[0].ref;
}

export async function syncSubscriptionToTenant(
  subscription: Stripe.Subscription,
  fallback?: { tenantId?: string; plan?: BillingPlan; extraSeats?: number },
) {
  const subscriptionData = subscription as Stripe.Subscription & {
    current_period_end?: number | null;
    trial_end?: number | null;
  };
  const metadata = subscription.metadata || {};
  const tenantId = metadata.tenantId || fallback?.tenantId;
  const plan = isBillingPlan(metadata.plan) ? metadata.plan : fallback?.plan;
  const extraSeatPriceId = process.env.STRIPE_PRICE_SCHOOL_EXTRA_SEAT_MONTHLY;
  const extraSeatItem = extraSeatPriceId
    ? subscription.items.data.find(item => item.price.id === extraSeatPriceId)
    : undefined;
  const extraSeats = (extraSeatItem?.quantity ?? fallback?.extraSeats ?? Number(metadata.extraSeats || 0)) || 0;
  const resolvedPlan = plan || (extraSeats > 0 ? 'school' : undefined);
  const tenantRef = tenantId
    ? getAdminFirestore().collection('tenants').doc(tenantId)
    : await findTenantBySubscriptionId(subscription.id);

  if (!tenantRef) return;

  const status = subscription.status;
  const update: Record<string, unknown> = {
    stripeCustomerId: getStringId(subscription.customer),
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: status,
    trialEndsAt: secondsToIso(subscriptionData.trial_end),
    currentPeriodEnd: secondsToIso(subscriptionData.current_period_end),
    billingLocked: getBillingLocked(status),
    updatedAt: new Date().toISOString(),
  };

  if (resolvedPlan) {
    update.plan = resolvedPlan;
    update.extraSeats = resolvedPlan === 'school' ? extraSeats : 0;
    update.seatLimit = resolvedPlan === 'school'
      ? PLAN_DETAILS.school.includedSeats + extraSeats
      : PLAN_DETAILS.instructor.includedSeats;
  }

  await tenantRef.set(update, { merge: true });
}

export async function markTenantBillingCancelled(subscription: Stripe.Subscription) {
  await syncSubscriptionToTenant({
    ...subscription,
    status: 'canceled',
  } as Stripe.Subscription);
}

export function normalizeSeatLimit(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return PLAN_DETAILS.school.includedSeats;
  return Math.max(PLAN_DETAILS.school.includedSeats, Math.ceil(numeric));
}

export function seatLimitToExtraSeats(seatLimit: number) {
  return getExtraSeats(seatLimit);
}
