'use client';

import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { FirebaseProvider, useUser } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';
import { Auth } from 'firebase/auth';
import { AccessDenied } from '@/components/auth/access-denied';
import { useSession } from '@/firebase/provider';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

function AuthGate({ auth, children }: { auth: Auth, children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const { role, tenant, activeTenantId, isMainAdmin, isSessionLoading, sessionError } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === '/login';
  const isPublicPage = pathname === '/';
  const isAdminPage = pathname?.startsWith('/admin');
  const sessionRepairAttempted = useRef(false);

  useEffect(() => {
    if (isUserLoading || !user || sessionRepairAttempted.current) return;
    sessionRepairAttempted.current = true;
    void user.getIdToken().then(token => fetch('/api/session/repair', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })).then(response => response?.json()).then(result => {
      if (result?.repaired) window.location.reload();
    }).catch(() => undefined);
  }, [isUserLoading, user]);

  useEffect(() => {
    if (isUserLoading || isLoginPage || isPublicPage || user) return;
    router.replace(`/login?next=${encodeURIComponent(pathname || '/')}`);
  }, [isLoginPage, isPublicPage, isUserLoading, pathname, router, user]);

  useEffect(() => {
    if (isLoginPage || isPublicPage || isSessionLoading || !user || !isMainAdmin || activeTenantId || isAdminPage) return;
    router.replace('/admin');
  }, [activeTenantId, isAdminPage, isLoginPage, isPublicPage, isMainAdmin, isSessionLoading, router, user]);

  if (isPublicPage) {
    return <>{children}</>;
  }

  if (isSessionLoading) {
    return null;
  }

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (sessionError || !auth) {
    return <AccessDenied />;
  }

  if (!user) {
    return null;
  }

  if (!role) {
    return <AccessDenied message="Your account is signed in, but it has not been connected to an InstructorOS workspace yet." />;
  }

  if (!isMainAdmin && (!tenant || tenant.status !== 'active')) {
    return <AccessDenied message="This workspace is not active. Please contact your school admin or InstructorOS support." />;
  }

  if (isMainAdmin && !activeTenantId && !isAdminPage) {
    return null;
  }

  if (isAdminPage && !isMainAdmin) {
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
