import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { syncSubscriptionToTenant } from '@/lib/server/billing-sync';
import { getStripe, requireEnv } from '@/lib/server/stripe';
import { isBillingPlan } from '@/lib/billing';

export const runtime = 'nodejs';

function getStringId(value: string | Stripe.Subscription | null) {
  if (!value) return '';
  return typeof value === 'string' ? value : value.id;
}

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing Stripe signature.' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    const payload = await request.text();
    event = stripe.webhooks.constructEvent(payload, signature, requireEnv('STRIPE_WEBHOOK_SECRET'));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid Stripe webhook.';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const subscriptionId = getStringId(session.subscription as string | Stripe.Subscription | null);
      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await syncSubscriptionToTenant(subscription, {
          tenantId: session.client_reference_id || session.metadata?.tenantId || undefined,
          plan: isBillingPlan(session.metadata?.plan) ? session.metadata.plan : undefined,
          extraSeats: Number(session.metadata?.extraSeats || 0),
        });
      }
    }

    if (
      event.type === 'customer.subscription.created'
      || event.type === 'customer.subscription.updated'
      || event.type === 'customer.subscription.deleted'
    ) {
      await syncSubscriptionToTenant(event.data.object as Stripe.Subscription);
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null };
      const subscriptionId = getStringId(invoice.subscription || null);
      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await syncSubscriptionToTenant(subscription);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not process Stripe webhook.';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
