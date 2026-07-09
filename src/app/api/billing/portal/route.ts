import { NextRequest, NextResponse } from 'next/server';
import { getBillingActor } from '@/lib/server/billing-auth';
import { getAppUrl, getStripe, publicBillingError } from '@/lib/server/stripe';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const tenantId = String(body.tenantId || '');

    if (!tenantId) {
      return NextResponse.json({ error: 'Missing workspace.' }, { status: 400 });
    }

    const { tenant } = await getBillingActor(request, tenantId, { requireOwner: true });
    if (!tenant.stripeCustomerId) {
      return NextResponse.json({ error: 'Billing has not been started yet.' }, { status: 400 });
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: tenant.stripeCustomerId,
      return_url: `${getAppUrl()}/app/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message = publicBillingError(error, 'Could not open billing portal.');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
