'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { collection, doc, orderBy, query, setDoc, updateDoc } from 'firebase/firestore';
import { Building2, ExternalLink, Shield, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCollection, useFirestore, useMemoFirebase, useSession } from '@/firebase';
import { MAIN_ADMIN_EMAIL, type Tenant } from '@/lib/auth-config';

export default function AdminPage() {
  const firestore = useFirestore();
  const { user, isMainAdmin } = useSession();
  const router = useRouter();

  const tenantsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'tenants'), orderBy('createdAt', 'desc')) : null),
    [firestore]
  );
  const usersQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'users'), orderBy('createdAt', 'desc')) : null),
    [firestore]
  );

  const { data: tenants, isLoading: tenantsLoading } = useCollection<Tenant>(tenantsQuery);
  const { data: users } = useCollection<{ email: string; activeTenantId?: string }>(usersQuery);
  const userCountByTenant = useMemo(() => {
    return (users || []).reduce<Record<string, number>>((counts, profile) => {
      if (!profile.activeTenantId) return counts;
      counts[profile.activeTenantId] = (counts[profile.activeTenantId] || 0) + 1;
      return counts;
    }, {});
  }, [users]);

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
    router.push('/');
  };

  const toggleTenantStatus = async (tenant: Tenant) => {
    await updateDoc(doc(firestore, 'tenants', tenant.id), {
      status: tenant.status === 'active' ? 'suspended' : 'active',
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
            <Link href="/">
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
                  </div>
                </div>
                <div className="flex gap-2">
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
