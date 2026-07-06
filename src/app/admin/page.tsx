'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { collection, doc, orderBy, query, setDoc, updateDoc } from 'firebase/firestore';
import { Activity, AlertTriangle, Building2, CheckCircle2, ExternalLink, Gift, Receipt, RefreshCw, Shield, TicketPercent, UserRound, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCollection, useFirestore, useMemoFirebase, useSession } from '@/firebase';
import { MAIN_ADMIN_EMAIL, type Tenant } from '@/lib/auth-config';
import type { PromoCode, PromoCodeKind } from '@/lib/billing';

type ReadinessItem = {
  key: string;
  label: string;
  state: 'ready' | 'missing' | 'warning';
  detail: string;
};

type ReadinessResponse = {
  ok?: boolean;
  error?: string;
  missingCount?: number;
  warningCount?: number;
  items?: ReadinessItem[];
  reminders?: string[];
};

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

export default function AdminPage() {
  const firestore = useFirestore();
  const { user, isMainAdmin, activeTenantId } = useSession();
  const router = useRouter();
  const [readiness, setReadiness] = useState<ReadinessResponse | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoKind, setPromoKind] = useState<PromoCodeKind>('free');
  const [promoFreeDays, setPromoFreeDays] = useState(30);
  const [promoPercentOff, setPromoPercentOff] = useState(25);
  const [promoExpiresAt, setPromoExpiresAt] = useState('');
  const [adminMessage, setAdminMessage] = useState('');
  const [promoSaving, setPromoSaving] = useState(false);

  const tenantsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'tenants'), orderBy('createdAt', 'desc')) : null),
    [firestore]
  );
  const usersQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'users'), orderBy('createdAt', 'desc')) : null),
    [firestore]
  );
  const promoCodesQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'promoCodes'), orderBy('createdAt', 'desc')) : null),
    [firestore]
  );

  const { data: tenants, isLoading: tenantsLoading } = useCollection<Tenant>(tenantsQuery);
  const { data: users } = useCollection<{ email: string; activeTenantId?: string }>(usersQuery);
  const { data: promoCodes, isLoading: promoCodesLoading } = useCollection<PromoCode>(promoCodesQuery);
  const userCountByTenant = useMemo(() => {
    return (users || []).reduce<Record<string, number>>((counts, profile) => {
      if (!profile.activeTenantId) return counts;
      counts[profile.activeTenantId] = (counts[profile.activeTenantId] || 0) + 1;
      return counts;
    }, {});
  }, [users]);

  const loadReadiness = useCallback(async () => {
    if (!user || !isMainAdmin) return;
    setReadinessLoading(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/readiness', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      setReadiness(data);
    } catch (error) {
      setReadiness({
        error: error instanceof Error ? error.message : 'Could not load production readiness.',
      });
    } finally {
      setReadinessLoading(false);
    }
  }, [isMainAdmin, user]);

  useEffect(() => {
    void loadReadiness();
  }, [loadReadiness]);

  const openTenant = async (tenant: Tenant) => {
    if (!user) return;
    const now = new Date().toISOString();
    await setDoc(doc(firestore, 'users', user.uid), {
      uid: user.uid,
      email: user.email || MAIN_ADMIN_EMAIL,
      displayName: user.displayName || 'Main Admin',
      activeTenantId: tenant.id,
      tenantIds: [tenant.id],
      createdAt: now,
      updatedAt: now,
    }, { merge: true });
    router.push('/app');
  };

  const toggleTenantStatus = async (tenant: Tenant) => {
    await updateDoc(doc(firestore, 'tenants', tenant.id), {
      status: tenant.status === 'active' ? 'suspended' : 'active',
      updatedAt: new Date().toISOString(),
    });
  };

  const grantFreeAccess = async (tenant: Tenant, days: number) => {
    const now = new Date();
    const freeAccessUntil = addDays(now, days).toISOString();

    await updateDoc(doc(firestore, 'tenants', tenant.id), {
      status: 'active',
      subscriptionStatus: 'active',
      billingLocked: false,
      freeAccessUntil,
      freeAccessReason: `Admin granted ${days} days free access`,
      updatedAt: now.toISOString(),
    });
    setAdminMessage(`${tenant.name} has free access until ${formatDate(freeAccessUntil)}.`);
  };

  const handlePromoSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = normalizePromoCode(promoCode);
    if (!code || !user) return;

    setPromoSaving(true);
    try {
      const now = new Date().toISOString();
      const expiresAt = promoExpiresAt ? new Date(`${promoExpiresAt}T23:59:59`).toISOString() : null;
      const record: Omit<PromoCode, 'id' | 'percentOff' | 'freeDays'> & Pick<PromoCode, 'percentOff' | 'freeDays'> = {
        code,
        kind: promoKind,
        active: true,
        expiresAt,
        note: promoKind === 'free'
          ? `${Math.max(1, Math.round(promoFreeDays))} free day(s)`
          : `${Math.min(100, Math.max(1, Math.round(promoPercentOff)))}% discount`,
        createdAt: now,
        updatedAt: now,
        createdByUid: user.uid,
      };
      if (promoKind === 'percent') {
        record.percentOff = Math.min(100, Math.max(1, Math.round(promoPercentOff)));
      } else {
        record.freeDays = Math.max(1, Math.round(promoFreeDays));
      }

      await setDoc(doc(firestore, 'promoCodes', code), record, { merge: true });
      setAdminMessage(`Promo code ${code} is ready.`);
      setPromoCode('');
    } finally {
      setPromoSaving(false);
    }
  };

  const togglePromoCode = async (promo: PromoCode) => {
    await updateDoc(doc(firestore, 'promoCodes', promo.id), {
      active: !promo.active,
      updatedAt: new Date().toISOString(),
    });
  };

  if (!isMainAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">Only the main admin can use this page.</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5] p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0D1B2A] text-white">
              <Shield className="h-6 w-6" />
            </div>
            <h1 className="text-3xl font-bold">InstructorOS Admin</h1>
            <p className="mt-1 text-sm text-muted-foreground">Manage schools, individual instructors, and support access.</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/app">
              <ExternalLink className="mr-2 h-4 w-4" />
              Open active workspace
            </Link>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Total tenants</CardTitle></CardHeader>
            <CardContent className="text-3xl font-bold">{tenants?.length || 0}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Schools</CardTitle></CardHeader>
            <CardContent className="text-3xl font-bold">{(tenants || []).filter(t => t.type === 'school').length}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Individual instructors</CardTitle></CardHeader>
            <CardContent className="text-3xl font-bold">{(tenants || []).filter(t => t.type === 'solo').length}</CardContent>
          </Card>
        </div>

        {adminMessage && (
          <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Admin update</AlertTitle>
            <AlertDescription>{adminMessage}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Admin tools</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {activeTenantId ? (
              <Button asChild variant="outline" className="justify-start">
                <Link href="/app/expenses">
                  <Receipt className="mr-2 h-4 w-4" />
                  Business Expenses
                </Link>
              </Button>
            ) : (
              <Button variant="outline" className="justify-start" disabled>
                <Receipt className="mr-2 h-4 w-4" />
                Business Expenses
              </Button>
            )}
            <Button asChild variant="outline" className="justify-start">
              <Link href="/admin/utility-tracker">
                <Activity className="mr-2 h-4 w-4" />
                Utility Tracker
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Production readiness</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Checks deployment settings without showing secret values.
                </p>
              </div>
              <Button variant="outline" onClick={loadReadiness} disabled={readinessLoading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${readinessLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {readiness?.error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Readiness check needs attention</AlertTitle>
                <AlertDescription>{readiness.error}</AlertDescription>
              </Alert>
            )}

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border bg-muted/30 p-4">
                <p className="text-xs font-bold uppercase text-muted-foreground">Missing</p>
                <p className="mt-2 text-2xl font-black">{readiness?.missingCount ?? '-'}</p>
              </div>
              <div className="rounded-xl border bg-muted/30 p-4">
                <p className="text-xs font-bold uppercase text-muted-foreground">Warnings</p>
                <p className="mt-2 text-2xl font-black">{readiness?.warningCount ?? '-'}</p>
              </div>
              <div className="rounded-xl border bg-muted/30 p-4">
                <p className="text-xs font-bold uppercase text-muted-foreground">Status</p>
                <Badge className="mt-2" variant={readiness?.ok ? 'default' : 'destructive'}>
                  {readiness?.ok ? 'Ready' : 'Not ready'}
                </Badge>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {(readiness?.items || []).map(item => (
                <div key={item.key} className="rounded-xl border bg-white p-4">
                  <div className="flex items-center gap-2">
                    {item.state === 'ready' ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    ) : item.state === 'warning' ? (
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    <p className="font-semibold">{item.label}</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.detail}</p>
                </div>
              ))}
            </div>

            {readiness?.reminders && readiness.reminders.length > 0 && (
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertTitle>Before going live</AlertTitle>
                <AlertDescription>
                  <ul className="mt-2 list-disc space-y-1 pl-4">
                    {readiness.reminders.map(reminder => (
                      <li key={reminder}>{reminder}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TicketPercent className="h-5 w-5" />
              Promo codes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <form className="grid gap-3 lg:grid-cols-[1fr_150px_150px_170px_auto]" onSubmit={handlePromoSubmit}>
              <div className="space-y-2">
                <Label htmlFor="promoCode">Code</Label>
                <Input
                  id="promoCode"
                  value={promoCode}
                  onChange={event => setPromoCode(normalizePromoCode(event.target.value))}
                  placeholder="SCHOOL50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="promoKind">Type</Label>
                <select
                  id="promoKind"
                  value={promoKind}
                  onChange={event => setPromoKind(event.target.value as PromoCodeKind)}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="free">Free days</option>
                  <option value="percent">Percent off</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="promoValue">{promoKind === 'free' ? 'Free days' : 'Percent off'}</Label>
                <Input
                  id="promoValue"
                  type="number"
                  min={1}
                  max={promoKind === 'percent' ? 100 : 3650}
                  value={promoKind === 'free' ? promoFreeDays : promoPercentOff}
                  onChange={event => {
                    const value = Number(event.target.value);
                    if (promoKind === 'free') setPromoFreeDays(value);
                    else setPromoPercentOff(value);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="promoExpires">Expires</Label>
                <Input
                  id="promoExpires"
                  type="date"
                  value={promoExpiresAt}
                  onChange={event => setPromoExpiresAt(event.target.value)}
                />
              </div>
              <Button className="mt-auto" disabled={promoSaving || !promoCode.trim()}>
                {promoSaving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Gift className="mr-2 h-4 w-4" />}
                Save code
              </Button>
            </form>

            <div className="space-y-3">
              {promoCodesLoading && <p className="text-sm text-muted-foreground">Loading promo codes...</p>}
              {(promoCodes || []).map(promo => (
                <div key={promo.id} className="flex flex-col gap-3 rounded-xl border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black">{promo.code}</p>
                      <Badge variant={promo.active ? 'default' : 'secondary'}>{promo.active ? 'active' : 'paused'}</Badge>
                      <Badge variant="outline">{promo.kind === 'free' ? `${promo.freeDays || 0} free days` : `${promo.percentOff || 0}% off`}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {promo.expiresAt ? `Expires ${formatDate(promo.expiresAt)}` : 'No expiry date'}
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => togglePromoCode(promo)}>
                    {promo.active ? 'Pause' : 'Activate'}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tenants</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tenantsLoading && <p className="text-sm text-muted-foreground">Loading tenants...</p>}
            {(tenants || []).map(tenant => (
              <div key={tenant.id} className="flex flex-col gap-3 rounded-xl border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                    {tenant.type === 'school' ? <Building2 className="h-5 w-5" /> : <UserRound className="h-5 w-5" />}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">{tenant.name}</h2>
                      <Badge variant={tenant.status === 'active' ? 'default' : 'secondary'}>{tenant.status}</Badge>
                      <Badge variant="outline">{tenant.type}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{tenant.ownerEmail} · {userCountByTenant[tenant.id] || 0} user(s)</p>
                    {tenant.freeAccessUntil && (
                      <p className="mt-1 text-xs font-semibold text-emerald-700">
                        Free access until {formatDate(tenant.freeAccessUntil)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => grantFreeAccess(tenant, 30)}>
                    Free 30d
                  </Button>
                  <Button variant="outline" onClick={() => grantFreeAccess(tenant, 90)}>
                    Free 90d
                  </Button>
                  <Button variant="outline" onClick={() => grantFreeAccess(tenant, 365)}>
                    Free 1y
                  </Button>
                  <Button variant="outline" onClick={() => toggleTenantStatus(tenant)}>
                    {tenant.status === 'active' ? 'Suspend' : 'Activate'}
                  </Button>
                  <Button onClick={() => openTenant(tenant)}>Open</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
