import { NextRequest, NextResponse } from 'next/server';
import { PLAN_DETAILS, getExtraSeats, getIncludedSeats, isBillingPlan } from '@/lib/billing';
import { getBillingActor } from '@/lib/server/billing-auth';
import { getAppUrl, getStripe, publicBillingError, requireEnv } from '@/lib/server/stripe';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const tenantId = String(body.tenantId || '');
    const plan = body.plan;
    const seatLimit = Math.max(getIncludedSeats('school'), Number(body.seatLimit || getIncludedSeats('school')));

    if (!tenantId || !isBillingPlan(plan)) {
      return NextResponse.json({ error: 'Missing billing plan or workspace.' }, { status: 400 });
    }

    const { tenant, tenantRef, email } = await getBillingActor(request, tenantId);
    const expectedPlan = tenant.type === 'school' ? 'school' : 'instructor';
    if (plan !== expectedPlan) {
      return NextResponse.json({ error: 'This plan does not match the workspace type.' }, { status: 400 });
    }

    const stripe = getStripe();
    const priceId = requireEnv(PLAN_DETAILS[plan].stripePriceEnv);
    const appUrl = getAppUrl();
    const extraSeats = plan === 'school' ? getExtraSeats(seatLimit) : 0;
    const lineItems = [{ price: priceId, quantity: 1 }];

    if (plan === 'school' && extraSeats > 0) {
      lineItems.push({
        price: requireEnv('STRIPE_PRICE_SCHOOL_EXTRA_SEAT_MONTHLY'),
        quantity: extraSeats,
      });
    }

    let customerId = tenant.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: tenant.ownerEmail || email,
        name: tenant.name,
        metadata: { tenantId, plan },
      });
      customerId = customer.id;
      await tenantRef.set({ stripeCustomerId: customerId, updatedAt: new Date().toISOString() }, { merge: true });
    }

    const metadata = {
      tenantId,
      plan,
      extraSeats: String(extraSeats),
      seatLimit: String(plan === 'school' ? PLAN_DETAILS.school.includedSeats + extraSeats : PLAN_DETAILS.instructor.includedSeats),
    };

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: tenantId,
      line_items: lineItems,
      payment_method_collection: 'always',
      allow_promotion_codes: true,
      success_url: `${appUrl}/app/billing?checkout=success`,
      cancel_url: `${appUrl}/app/billing?checkout=cancelled`,
      metadata,
      subscription_data: {
        trial_period_days: PLAN_DETAILS[plan].trialDays,
        metadata,
      },
    });

    await tenantRef.set({
      plan,
      extraSeats,
      seatLimit: plan === 'school' ? PLAN_DETAILS.school.includedSeats + extraSeats : PLAN_DETAILS.instructor.includedSeats,
      subscriptionStatus: 'checkout_pending',
      billingLocked: true,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message = publicBillingError(error, 'Could not start checkout.');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
