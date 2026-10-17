'use client';

import { signOut } from 'firebase/auth';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth, useFirestore, useUser } from '@/firebase';
import { clearOffline } from '../../../public/offline-store';
import { clearFirestoreDeviceCache, forgetTrustedDeviceCache } from '@/lib/trusted-device-cache';

type AccessDeniedProps = {
  message?: string;
};

export function AccessDenied({ message }: AccessDeniedProps) {
  const auth = useAuth();
  const firestore = useFirestore();
  const { user } = useUser();

  const handleLogout = async () => {
    await clearOffline().catch(() => undefined);
    forgetTrustedDeviceCache(user?.uid);
    await signOut(auth);
    await clearFirestoreDeviceCache(firestore).catch(() => undefined);
    window.location.assign('/login');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md rounded-3xl border-0 shadow-xl">
        <CardContent className="space-y-5 p-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-700">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Access not allowed</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {message || `You are signed in as ${user?.email || 'another account'}, but this account does not have access here.`}
            </p>
          </div>
          <Button className="h-11 w-full rounded-2xl" onClick={handleLogout}>
            Logout
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
