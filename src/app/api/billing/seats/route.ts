import { NextRequest, NextResponse } from 'next/server';
import { PLAN_DETAILS } from '@/lib/billing';
import { getBillingActor } from '@/lib/server/billing-auth';
import { normalizeSeatLimit, seatLimitToExtraSeats, syncSubscriptionToTenant } from '@/lib/server/billing-sync';
import { getStripe, publicBillingError, requireEnv } from '@/lib/server/stripe';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const tenantId = String(body.tenantId || '');
    const requestedSeatLimit = normalizeSeatLimit(body.seatLimit);

    if (!tenantId) {
      return NextResponse.json({ error: 'Missing workspace.' }, { status: 400 });
    }

    const { tenant, tenantRef } = await getBillingActor(request, tenantId);
    if (tenant.type !== 'school') {
      return NextResponse.json({ error: 'Only school workspaces can add seats.' }, { status: 400 });
    }
    if (!tenant.stripeSubscriptionId) {
      return NextResponse.json({ error: 'Start the school subscription before adding seats.' }, { status: 400 });
    }

    const stripe = getStripe();
    const extraSeatPriceId = requireEnv('STRIPE_PRICE_SCHOOL_EXTRA_SEAT_MONTHLY');
    const extraSeats = seatLimitToExtraSeats(requestedSeatLimit);
    const subscription = await stripe.subscriptions.retrieve(tenant.stripeSubscriptionId);
    const existingItem = subscription.items.data.find(item => item.price.id === extraSeatPriceId);

    if (extraSeats > 0 && existingItem) {
      await stripe.subscriptionItems.update(existingItem.id, {
        quantity: extraSeats,
        proration_behavior: 'create_prorations',
      });
    } else if (extraSeats > 0) {
      await stripe.subscriptionItems.create({
        subscription: subscription.id,
        price: extraSeatPriceId,
        quantity: extraSeats,
        proration_behavior: 'create_prorations',
      });
    } else if (existingItem) {
      await stripe.subscriptionItems.del(existingItem.id, {
        proration_behavior: 'create_prorations',
      });
    }

    const updatedSubscription = await stripe.subscriptions.retrieve(subscription.id);
    await syncSubscriptionToTenant(updatedSubscription, {
      tenantId,
      plan: 'school',
      extraSeats,
    });
    await tenantRef.set({
      plan: 'school',
      extraSeats,
      seatLimit: PLAN_DETAILS.school.includedSeats + extraSeats,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    return NextResponse.json({
      seatLimit: PLAN_DETAILS.school.includedSeats + extraSeats,
      extraSeats,
    });
  } catch (error) {
    const message = publicBillingError(error, 'Could not update seats.');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
