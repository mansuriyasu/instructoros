import { NextRequest, NextResponse } from 'next/server';
import { type PromoCode } from '@/lib/billing';
import { getBillingActor } from '@/lib/server/billing-auth';
import { getAdminFirestore } from '@/lib/server/firebase-admin';

function normalizePromoCode(value: unknown) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32);
}

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const tenantId = String(body.tenantId || '');
    const code = normalizePromoCode(body.code);
    if (!tenantId || !code) {
      return NextResponse.json({ error: 'Enter a valid promo code.' }, { status: 400 });
    }

    const { tenantRef } = await getBillingActor(request, tenantId, { requireOwner: true });
    const promoSnap = await getAdminFirestore().collection('promoCodes').doc(code).get();
    if (!promoSnap.exists) {
      return NextResponse.json({ error: 'This promo code was not found.' }, { status: 404 });
    }

    const promo = promoSnap.data() as PromoCode;
    if (!promo.active || (promo.expiresAt && new Date(promo.expiresAt).getTime() < Date.now())) {
      return NextResponse.json({ error: 'This promo code is not active.' }, { status: 400 });
    }

    const now = new Date();
    if (promo.kind === 'free') {
      const freeAccessUntil = new Date(now);
      freeAccessUntil.setDate(freeAccessUntil.getDate() + Math.max(1, promo.freeDays || 30));
      await tenantRef.set({
        promoCodeApplied: promo.code,
        promoPercentOff: 0,
        subscriptionStatus: 'active',
        billingLocked: false,
        freeAccessUntil: freeAccessUntil.toISOString(),
        freeAccessReason: `Promo code ${promo.code}`,
        updatedAt: now.toISOString(),
      }, { merge: true });
      return NextResponse.json({ kind: 'free', freeAccessUntil: freeAccessUntil.toISOString(), code: promo.code });
    }

    const percentOff = Math.round(promo.percentOff || 0);
    if (percentOff < 1 || percentOff > 100) {
      return NextResponse.json({ error: 'This promo code has an invalid discount.' }, { status: 400 });
    }

    await tenantRef.set({
      promoCodeApplied: promo.code,
      promoPercentOff: percentOff,
      updatedAt: now.toISOString(),
    }, { merge: true });
    return NextResponse.json({ kind: 'percent', percentOff, code: promo.code });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not apply this promo code.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
