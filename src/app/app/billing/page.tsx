'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Building2, CheckCircle2, Loader2, Lock, TicketPercent, UserRound, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useFirestore, useSession, useUser } from '@/firebase';
import { PLAN_DETAILS, SCHOOL_EXTRA_SEAT_PRICE, getBillingLocked, getPlanForTenantType } from '@/lib/billing';
import type { BillingPlan, PromoCode } from '@/lib/billing';

async function postBilling(path: string, token: string, body: Record<string, unknown>) {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Billing request failed.');
  return data;
}

function friendlyBillingError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (/default credentials|application default credentials|GOOGLE_APPLICATION_CREDENTIALS|Firebase Admin/i.test(message)) {
    return 'Paid billing setup is not fully connected yet. You can still start the 1 month free trial now.';
  }

  return message || 'Billing request failed.';
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(value?: string | null) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

function normalizePromoCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32);
}

export default function BillingPage() {
  const firestore = useFirestore();
  const { tenant, activeTenantId, canManageTenant } = useSession();
  const { user } = useUser();
  const searchParams = useSearchParams();
  const [seatLimit, setSeatLimit] = useState(PLAN_DETAILS.school.includedSeats);
  const [isLoading, setIsLoading] = useState<'trial' | 'checkout' | 'portal' | 'seats' | null>(null);
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [promoCodeInput, setPromoCodeInput] = useState('');

  const plan = useMemo<BillingPlan>(() => tenant?.plan || getPlanForTenantType(tenant?.type === 'school' ? 'school' : 'solo'), [tenant?.plan, tenant?.type]);
  const isSchool = tenant?.type === 'school';
  const status = tenant?.subscriptionStatus || 'not_started';
  const billingLocked = tenant?.billingLocked ?? getBillingLocked(status);
  const trialIsActive = status === 'trialing';
  const canActivateTrialCheckout = canManageTenant && status !== 'active';

  useEffect(() => {
    setSeatLimit(tenant?.seatLimit || (isSchool ? PLAN_DETAILS.school.includedSeats : PLAN_DETAILS.instructor.includedSeats));
  }, [isSchool, tenant?.seatLimit]);

  useEffect(() => {
    if (searchParams.get('checkout') === 'success') {
      setMessage('Checkout completed. Stripe may take a few seconds to confirm the trial here.');
    }
    if (searchParams.get('checkout') === 'cancelled') {
      setError('Checkout was cancelled. You can still start the 1 month free trial from this page.');
    }
  }, [searchParams]);

  const applyPromoCode = async () => {
    if (!activeTenantId || !tenant) return;
    const code = normalizePromoCode(promoCodeInput);
    if (!code) return;

    setIsApplyingPromo(true);
    setError('');
    setMessage('');

    try {
      const promoSnap = await getDoc(doc(firestore, 'promoCodes', code));
      if (!promoSnap.exists()) {
        throw new Error('This promo code was not found.');
      }

      const promo = { ...(promoSnap.data() as PromoCode), id: promoSnap.id };
      if (!promo.active) {
        throw new Error('This promo code is not active.');
      }
      if (promo.expiresAt && new Date(promo.expiresAt).getTime() < Date.now()) {
        throw new Error('This promo code has expired.');
      }

      const now = new Date();

      if (promo.kind === 'free') {
        const freeAccessUntil = addDays(now, promo.freeDays || 30).toISOString();
        await updateDoc(doc(firestore, 'tenants', activeTenantId), {
          promoCodeApplied: promo.code,
          updatedAt: now.toISOString(),
          subscriptionStatus: 'active',
          billingLocked: false,
          freeAccessUntil,
          freeAccessReason: `Promo code ${promo.code}`,
        });
        setMessage(`${promo.code} applied. Free access is active until ${formatDate(freeAccessUntil)}.`);
      } else {
        const update = {
          promoCodeApplied: promo.code,
          updatedAt: now.toISOString(),
          promoPercentOff: promo.percentOff || 0,
          ...(billingLocked
            ? {
                subscriptionStatus: 'trialing',
                billingLocked: false,
                trialEndsAt: tenant.trialEndsAt || addDays(now, PLAN_DETAILS[plan].trialDays).toISOString(),
              }
            : {}),
        };
        await updateDoc(doc(firestore, 'tenants', activeTenantId), update);
        setMessage(`${promo.code} applied. ${promo.percentOff || 0}% discount is saved for this workspace.`);
      }

      setPromoCodeInput('');
    } catch (promoError) {
      setError(promoError instanceof Error ? promoError.message : 'Could not apply this promo code.');
    } finally {
      setIsApplyingPromo(false);
    }
  };

  const runBillingAction = async (action: 'checkout' | 'portal' | 'seats') => {
    if (!user || !activeTenantId || !tenant) return;
    setIsLoading(action);
    setError('');
    setMessage('');

    try {
      const token = await user.getIdToken();
      if (action === 'checkout') {
        const data = await postBilling('/api/billing/checkout', token, {
          tenantId: activeTenantId,
          plan,
          seatLimit,
        });
        window.location.assign(data.url);
        return;
      }

      if (action === 'portal') {
        const data = await postBilling('/api/billing/portal', token, { tenantId: activeTenantId });
        window.location.assign(data.url);
        return;
      }

      const data = await postBilling('/api/billing/seats', token, { tenantId: activeTenantId, seatLimit });
      setSeatLimit(data.seatLimit);
      setMessage(`School seat limit updated to ${data.seatLimit} user(s).`);
    } catch (billingError) {
      setError(friendlyBillingError(billingError));
    } finally {
      setIsLoading(null);
    }
  };

  if (!tenant) {
    return null;
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <div>
        <h1 className="text-3xl font-black tracking-normal">Billing</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage the monthly InstructorOS subscription for {tenant.name}.
        </p>
      </div>

      {message && (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Billing update</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <Lock className="h-4 w-4" />
          <AlertTitle>Billing needs attention</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-lg">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-xl">Subscription</CardTitle>
                <p className="mt-2 text-sm text-muted-foreground">
                  Start with 1 month free. Stripe collects payment details now, then charges monthly only after the trial.
                </p>
              </div>
              {isSchool ? <Building2 className="h-6 w-6" /> : <UserRound className="h-6 w-6" />}
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-xs font-bold uppercase text-muted-foreground">Plan</p>
                <p className="mt-2 text-lg font-black">{PLAN_DETAILS[plan].label}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-xs font-bold uppercase text-muted-foreground">Status</p>
                <Badge className="mt-2" variant={billingLocked ? 'destructive' : 'default'}>{status}</Badge>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-xs font-bold uppercase text-muted-foreground">Seats</p>
                <p className="mt-2 text-lg font-black">{tenant.seatLimit || PLAN_DETAILS[plan].includedSeats}</p>
              </div>
            </div>

            {tenant.trialEndsAt && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
                Free trial ends {formatDate(tenant.trialEndsAt)}.
              </div>
            )}

            {(tenant.freeAccessUntil || tenant.promoCodeApplied || tenant.promoPercentOff) && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                {tenant.freeAccessUntil && <p className="font-semibold">Free access until {formatDate(tenant.freeAccessUntil)}.</p>}
                {tenant.promoCodeApplied && <p className="mt-1">Promo code: <span className="font-black">{tenant.promoCodeApplied}</span></p>}
                {tenant.promoPercentOff ? <p className="mt-1">{tenant.promoPercentOff}% discount saved for this workspace.</p> : null}
              </div>
            )}

            {billingLocked && (
              <Alert>
                <Lock className="h-4 w-4" />
                <AlertTitle>Workspace is read-only</AlertTitle>
                <AlertDescription>
                  Start or fix billing to unlock changes. You can still view existing records.
                </AlertDescription>
              </Alert>
            )}

            {canManageTenant ? (
              <div className="space-y-4">
                <div className="rounded-lg border bg-muted/30 p-4">
                  <Label htmlFor="promoCode">Promo code</Label>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="promoCode"
                      value={promoCodeInput}
                      onChange={event => setPromoCodeInput(normalizePromoCode(event.target.value))}
                      placeholder="Enter code"
                      className="h-11 rounded-lg"
                    />
                    <Button variant="outline" onClick={applyPromoCode} disabled={isApplyingPromo || !promoCodeInput.trim()} className="rounded-lg">
                      {isApplyingPromo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TicketPercent className="mr-2 h-4 w-4" />}
                      Apply
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  {canActivateTrialCheckout && (
                    <Button onClick={() => runBillingAction('checkout')} disabled={Boolean(isLoading)} className="rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
                      {isLoading === 'checkout' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                      {trialIsActive ? 'Add payment method' : 'Activate 1 Month Free Trial'}
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => runBillingAction('portal')} disabled={Boolean(isLoading) || !tenant.stripeCustomerId} className="rounded-lg">
                    {isLoading === 'portal' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Manage or unsubscribe
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Only a school admin or individual instructor owner can manage billing.</p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-xl">School seats</CardTitle>
                <p className="mt-2 text-sm text-muted-foreground">
                  School includes 10 users. Extra users are ${SCHOOL_EXTRA_SEAT_PRICE} CAD/month each.
                </p>
              </div>
              <UsersRound className="h-6 w-6" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isSchool ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="seatLimit">Total school users</Label>
                  <Input
                    id="seatLimit"
                    type="number"
                    min={PLAN_DETAILS.school.includedSeats}
                    value={seatLimit}
                    onChange={(event) => setSeatLimit(Number(event.target.value))}
                    className="h-12 rounded-lg"
                    disabled={!canManageTenant}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Extra seats: {Math.max(0, seatLimit - PLAN_DETAILS.school.includedSeats)}.
                </p>
                <Button
                  variant="outline"
                  onClick={() => runBillingAction('seats')}
                  disabled={!canManageTenant || Boolean(isLoading) || !tenant.stripeSubscriptionId}
                  className="w-full rounded-lg"
                >
                  {isLoading === 'seats' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Update seats
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Seat billing is only needed for school workspaces. Individual instructor accounts include one user.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
