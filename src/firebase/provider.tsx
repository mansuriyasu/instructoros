'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { FirebaseApp } from 'firebase/app';
import { doc, Firestore, onSnapshot } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener'
import {
  AppRole,
  AppUserProfile,
  Tenant,
  TenantMember,
  canManageTenant,
  isMainAdminEmail,
} from '@/lib/auth-config';

interface FirebaseProviderProps {
  children: ReactNode;
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
}

// Internal state for user authentication
interface UserAuthState {
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

// Combined state for the Firebase context
export interface FirebaseContextState {
  areServicesAvailable: boolean; // True if core services (app, firestore, auth instance) are provided
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null; // The Auth service instance
  // User authentication state
  user: User | null;
  isUserLoading: boolean; // True during initial auth check
  userError: Error | null; // Error from auth listener
  profile: AppUserProfile | null;
  tenant: Tenant | null;
  member: TenantMember | null;
  role: AppRole | null;
  activeTenantId: string | null;
  isSessionLoading: boolean;
  sessionError: Error | null;
}

// Return type for useFirebase()
export interface FirebaseServicesAndUser {
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

export interface SessionHookResult {
  user: User | null;
  profile: AppUserProfile | null;
  tenant: Tenant | null;
  member: TenantMember | null;
  role: AppRole | null;
  activeTenantId: string | null;
  isMainAdmin: boolean;
  canManageTenant: boolean;
  isSessionLoading: boolean;
  sessionError: Error | null;
}

// Return type for useUser() - specific to user auth state
export interface UserHookResult { // Renamed from UserAuthHookResult for consistency if desired, or keep as UserAuthHookResult
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

// React Context
export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

/**
 * FirebaseProvider manages and provides Firebase services and user authentication state.
 */
export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({
  children,
  firebaseApp,
  firestore,
  auth,
}) => {
  const [userAuthState, setUserAuthState] = useState<UserAuthState>({
    user: null,
    isUserLoading: true, // Start loading until first auth event
    userError: null,
  });
  const [profile, setProfile] = useState<AppUserProfile | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [member, setMember] = useState<TenantMember | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isTenantLoading, setIsTenantLoading] = useState(false);
  const [resolvedProfileUid, setResolvedProfileUid] = useState<string | null>(null);
  const [resolvedTenantId, setResolvedTenantId] = useState<string | null>(null);
  const [resolvedMemberKey, setResolvedMemberKey] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<Error | null>(null);

  // Effect to subscribe to Firebase auth state changes
  useEffect(() => {
    if (!auth) { // If no Auth service instance, cannot determine user state
      setUserAuthState({ user: null, isUserLoading: false, userError: new Error("Auth service not provided.") });
      return;
    }

    // Do not set isUserLoading to true here, to avoid flashing content
    // setUserAuthState({ user: null, isUserLoading: true, userError: null });

    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => { // Auth state determined
        setUserAuthState({ user: firebaseUser, isUserLoading: false, userError: null });
      },
      (error) => { // Auth listener error
        console.error("FirebaseProvider: onAuthStateChanged error:", error);
        setUserAuthState({ user: null, isUserLoading: false, userError: error });
      }
    );
    return () => unsubscribe(); // Cleanup
  }, [auth]); // Depends on the auth instance

  useEffect(() => {
    const firebaseUser = userAuthState.user;
    setProfile(null);
    setTenant(null);
    setMember(null);
    setResolvedProfileUid(null);
    setResolvedTenantId(null);
    setResolvedMemberKey(null);
    setSessionError(null);

    if (!firebaseUser) {
      setIsProfileLoading(false);
      setIsTenantLoading(false);
      return;
    }

    setIsProfileLoading(true);
    const profileRef = doc(firestore, 'users', firebaseUser.uid);
    return onSnapshot(
      profileRef,
      (snapshot) => {
        setProfile(snapshot.exists() ? ({ ...(snapshot.data() as AppUserProfile), id: snapshot.id } as AppUserProfile) : null);
        setResolvedProfileUid(firebaseUser.uid);
        setIsProfileLoading(false);
      },
      (error) => {
        setProfile(null);
        setResolvedProfileUid(firebaseUser.uid);
        setIsProfileLoading(false);
        setSessionError(error);
      }
    );
  }, [firestore, userAuthState.user]);

  useEffect(() => {
    const firebaseUser = userAuthState.user;
    const activeTenantId = profile?.activeTenantId || null;
    setTenant(null);
    setMember(null);
    setResolvedTenantId(null);
    setResolvedMemberKey(null);
    setSessionError(null);

    if (!firebaseUser || !activeTenantId) {
      setIsTenantLoading(false);
      return;
    }

    setIsTenantLoading(true);
    const tenantRef = doc(firestore, 'tenants', activeTenantId);
    const memberRef = doc(firestore, 'tenants', activeTenantId, 'members', firebaseUser.uid);
    let tenantDone = false;
    let memberDone = false;

    const finish = () => {
      if (tenantDone && memberDone) setIsTenantLoading(false);
    };

    const unsubscribeTenant = onSnapshot(
      tenantRef,
      (snapshot) => {
        setTenant(snapshot.exists() ? ({ ...(snapshot.data() as Tenant), id: snapshot.id } as Tenant) : null);
        setResolvedTenantId(activeTenantId);
        tenantDone = true;
        finish();
      },
      (error) => {
        setTenant(null);
        setResolvedTenantId(activeTenantId);
        tenantDone = true;
        setSessionError(error);
        finish();
      }
    );
    const unsubscribeMember = onSnapshot(
      memberRef,
      (snapshot) => {
        setMember(snapshot.exists() ? ({ ...(snapshot.data() as TenantMember), id: snapshot.id } as TenantMember) : null);
        setResolvedMemberKey(`${activeTenantId}:${firebaseUser.uid}`);
        memberDone = true;
        finish();
      },
      (error) => {
        setMember(null);
        setResolvedMemberKey(`${activeTenantId}:${firebaseUser.uid}`);
        memberDone = true;
        setSessionError(error);
        finish();
      }
    );

    return () => {
      unsubscribeTenant();
      unsubscribeMember();
    };
  }, [firestore, profile?.activeTenantId, userAuthState.user]);

  // Memoize the context value
  const contextValue = useMemo((): FirebaseContextState => {
    const servicesAvailable = !!(firebaseApp && firestore && auth);
    const activeTenantId = profile?.activeTenantId || null;
    const profileResolved = !userAuthState.user || resolvedProfileUid === userAuthState.user.uid;
    const tenantResolved = !userAuthState.user
      || !activeTenantId
      || (resolvedTenantId === activeTenantId && resolvedMemberKey === `${activeTenantId}:${userAuthState.user.uid}`);
    const role: AppRole | null = isMainAdminEmail(userAuthState.user?.email)
      ? 'mainAdmin'
      : member?.status === 'active'
        ? member.role
        : null;

    return {
      areServicesAvailable: servicesAvailable,
      firebaseApp: servicesAvailable ? firebaseApp : null,
      firestore: servicesAvailable ? firestore : null,
      auth: servicesAvailable ? auth : null,
      user: userAuthState.user,
      isUserLoading: userAuthState.isUserLoading,
      userError: userAuthState.userError,
      profile,
      tenant,
      member,
      role,
      activeTenantId,
      isSessionLoading: userAuthState.isUserLoading || isProfileLoading || isTenantLoading || !profileResolved || !tenantResolved,
      sessionError,
    };
  }, [firebaseApp, firestore, auth, userAuthState, profile, tenant, member, isProfileLoading, isTenantLoading, resolvedProfileUid, resolvedTenantId, resolvedMemberKey, sessionError]);

  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
};

/**
 * Hook to access core Firebase services and user authentication state.
 * Throws error if core services are not available or used outside provider.
 */
export const useFirebase = (): FirebaseServicesAndUser => {
  const context = useContext(FirebaseContext);

  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider.');
  }

  if (!context.areServicesAvailable || !context.firebaseApp || !context.firestore || !context.auth) {
    throw new Error('Firebase core services not available. Check FirebaseProvider props.');
  }

  return {
    firebaseApp: context.firebaseApp,
    firestore: context.firestore,
    auth: context.auth,
    user: context.user,
    isUserLoading: context.isUserLoading,
    userError: context.userError,
  };
};

/** Hook to access Firebase Auth instance. */
export const useAuth = (): Auth => {
  const { auth } = useFirebase();
  return auth;
};

/** Hook to access Firestore instance. */
export const useFirestore = (): Firestore => {
  const { firestore } = useFirebase();
  return firestore;
};

/** Hook to access Firebase App instance. */
export const useFirebaseApp = (): FirebaseApp => {
  const { firebaseApp } = useFirebase();
  return firebaseApp;
};

type MemoFirebase <T> = T & {__memo?: boolean};

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T | (MemoFirebase<T>) {
  const memoized = useMemo(factory, deps);
  
  if(typeof memoized !== 'object' || memoized === null) return memoized;
  (memoized as MemoFirebase<T>).__memo = true;
  
  return memoized;
}

/**
 * Hook specifically for accessing the authenticated user's state.
 * This provides the User object, loading status, and any auth errors.
 * @returns {UserHookResult} Object with user, isUserLoading, userError.
 */
export const useUser = (): UserHookResult => { // Renamed from useAuthUser
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a FirebaseProvider.');
  }
  const { user, isUserLoading, userError } = context; 
  return { user, isUserLoading, userError };
};

export const useSession = (): SessionHookResult => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a FirebaseProvider.');
  }
  const { user, profile, tenant, member, role, activeTenantId, isSessionLoading, sessionError } = context;
  return {
    user,
    profile,
    tenant,
    member,
    role,
    activeTenantId,
    isMainAdmin: role === 'mainAdmin',
    canManageTenant: canManageTenant(role),
    isSessionLoading,
    sessionError,
  };
};

export const useActiveTenantId = (): string | null => {
  const { activeTenantId } = useSession();
  return activeTenantId;
};

export const useTenantCollectionPath = (collectionName: string): string | null => {
  const activeTenantId = useActiveTenantId();
  return activeTenantId ? `tenants/${activeTenantId}/${collectionName}` : null;
};
