'use client';

import React, { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { FirebaseProvider, useUser } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';
import { Auth } from 'firebase/auth';
import { AccessDenied } from '@/components/auth/access-denied';
import { isOwnerEmail } from '@/lib/auth-config';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

function AuthGate({ auth, children }: { auth: Auth, children: React.ReactNode }) {
  const { user, isUserLoading, userError } = useUser();
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === '/login';

  useEffect(() => {
    if (isUserLoading || isLoginPage || user) return;
    router.replace(`/login?next=${encodeURIComponent(pathname || '/')}`);
  }, [isLoginPage, isUserLoading, pathname, router, user]);

  if (isUserLoading) {
    return null;
  }

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (userError || !auth) {
    return <AccessDenied />;
  }

  if (!user) {
    return null;
  }

  if (!isOwnerEmail(user.email)) {
    return <AccessDenied />;
  }

  return <>{children}</>;
}


export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const [firebaseServices, setFirebaseServices] = useState<ReturnType<typeof initializeFirebase> | null>(null);
  const [initError, setInitError] = useState<Error | null>(null);

  useEffect(() => {
    try {
      const svcs = initializeFirebase();
      (window as any).firebaseServices = svcs;
      (window as any).firestore = svcs.firestore;
      setFirebaseServices(svcs);
    } catch (error) {
      setInitError(error instanceof Error ? error : new Error('Firebase could not initialize.'));
    }
  }, []);

  if (initError) {
    return <AccessDenied />;
  }

  if (!firebaseServices) {
    return null;
  }

  return (
    <FirebaseProvider
      firebaseApp={firebaseServices.firebaseApp}
      auth={firebaseServices.auth}
      firestore={firebaseServices.firestore}
    >
      <AuthGate auth={firebaseServices.auth}>
        {children}
      </AuthGate>
    </FirebaseProvider>
  );
}
