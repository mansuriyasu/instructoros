'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  setPersistence,
  signOut,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
  type User,
} from 'firebase/auth';
import { collection, doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { Building2, Eye, EyeOff, Loader2, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth, useFirestore, useSession } from '@/firebase';
import { MAIN_ADMIN_EMAIL, normalizeEmail, type AppUserProfile, type TenantInvite, type TenantMember } from '@/lib/auth-config';
import { getIncludedSeats, getPlanForTenantType } from '@/lib/billing';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/logo';

type AuthMode = 'login' | 'school' | 'solo' | 'invite';
type AuthAttemptType = 'email' | 'google';

const AUTH_ATTEMPT_STORAGE_KEY = 'instructorosAuthAttempts_v1';
const AUTH_ATTEMPT_LIMIT = 5;
const AUTH_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const AUTH_LOCK_MS = 15 * 60 * 1000;

type AuthAttemptRecord = {
  count: number;
  firstAttemptAt: number;
  lockedUntil?: number;
};

function getAuthErrorMessage(error: unknown, attemptType: AuthAttemptType = 'email') {
  const message = error instanceof Error ? error.message : String(error);

  if (/auth\/invalid-credential|auth\/wrong-password|auth\/user-not-found/i.test(message)) {
    return 'Email or password is not correct.';
  }
  if (/auth\/email-already-in-use/i.test(message)) {
    return 'This account already exists. Please use Login.';
  }
  if (/auth\/weak-password/i.test(message)) {
    return 'Password must be at least 6 characters.';
  }
  if (/auth\/operation-not-allowed/i.test(message)) {
    return attemptType === 'google'
      ? 'Google login is not enabled in Firebase yet. In Firebase Console, open Authentication > Sign-in method, enable Google, add a support email, and save.'
      : 'Email/password login is not enabled in Firebase yet. In Firebase Console, open Authentication > Sign-in method, enable Email/Password, and save.';
  }
  if (/auth\/unauthorized-domain/i.test(message)) {
    return 'This domain is not authorized for Firebase login yet. In Firebase Console, open Authentication > Settings > Authorized domains, then add instructoros.ca and localhost.';
  }
  if (/auth\/popup-blocked/i.test(message)) {
    return 'The Google sign-in popup was blocked. Allow popups for this site and try again.';
  }
  if (/auth\/popup-closed-by-user|auth\/cancelled-popup-request/i.test(message)) {
    return 'Google login was cancelled before it finished.';
  }
  if (/auth\/too-many-requests/i.test(message)) {
    return 'Too many attempts. Please wait a little and try again.';
  }

  return message || 'Could not complete login. Please try again.';
}

function safeNextUrl(rawNextUrl: string | null) {
  const nextUrl = rawNextUrl || '/app';
  return nextUrl.startsWith('/') && !nextUrl.startsWith('//') ? nextUrl : '/app';
}

function getAuthAttemptId(mode: AuthMode, email: string) {
  return `${mode}:${normalizeEmail(email) || 'unknown'}`;
}

function readAuthAttempts(): Record<string, AuthAttemptRecord> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(AUTH_ATTEMPT_STORAGE_KEY);
    return raw ? JSON.parse(raw) as Record<string, AuthAttemptRecord> : {};
  } catch {
    return {};
  }
}

function writeAuthAttempts(records: Record<string, AuthAttemptRecord>) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(AUTH_ATTEMPT_STORAGE_KEY, JSON.stringify(records));
}

function formatLockTime(ms: number) {
  const minutes = Math.max(1, Math.ceil(ms / 60000));
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

function getAuthLockMessage(attemptId: string) {
  const record = readAuthAttempts()[attemptId];
  if (!record?.lockedUntil) return '';

  const remaining = record.lockedUntil - Date.now();
  if (remaining <= 0) {
    clearAuthAttempts(attemptId);
    return '';
  }

  return `Too many login attempts. Please wait ${formatLockTime(remaining)} before trying again.`;
}

function recordFailedAuthAttempt(attemptId: string) {
  const now = Date.now();
  const records = readAuthAttempts();
  const current = records[attemptId];
  const isFreshWindow = current && now - current.firstAttemptAt <= AUTH_ATTEMPT_WINDOW_MS;
  const nextCount = isFreshWindow ? current.count + 1 : 1;
  const lockedUntil = nextCount >= AUTH_ATTEMPT_LIMIT ? now + AUTH_LOCK_MS : undefined;

  records[attemptId] = {
    count: nextCount,
    firstAttemptAt: isFreshWindow ? current.firstAttemptAt : now,
    lockedUntil,
  };
  writeAuthAttempts(records);

  return lockedUntil
    ? `Too many login attempts. Please wait ${formatLockTime(AUTH_LOCK_MS)} before trying again.`
    : '';
}

function clearAuthAttempts(attemptId: string) {
  const records = readAuthAttempts();
  if (!records[attemptId]) return;
  delete records[attemptId];
  writeAuthAttempts(records);
}

function shouldCountFailedAttempt(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /auth\/invalid-credential|auth\/wrong-password|auth\/user-not-found|auth\/too-many-requests/i.test(message);
}

export function LoginForm() {
  const auth = useAuth();
  const firestore = useFirestore();
  const session = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = safeNextUrl(searchParams.get('next'));
  const inviteTenantId = searchParams.get('tenantId') || '';
  const inviteId = searchParams.get('inviteId') || '';
  const requestedModeParam = searchParams.get('mode');
  const requestedMode = requestedModeParam === 'invite' && inviteTenantId && inviteId
    ? 'invite'
    : requestedModeParam === 'school' || requestedModeParam === 'solo'
      ? requestedModeParam
      : 'login';

  const [mode, setMode] = useState<AuthMode>(requestedMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [authLockMessage, setAuthLockMessage] = useState('');

  const normalizedEmail = useMemo(() => normalizeEmail(email), [email]);
  const sessionEmail = normalizeEmail(session.user?.email);
  const hasUnconnectedSession = Boolean(session.user && !session.isSessionLoading && !session.role);
  const canUseCurrentSessionForSignup = hasUnconnectedSession && sessionEmail === normalizedEmail && mode !== 'login';
  const requiresName = mode === 'school' || mode === 'solo' || mode === 'invite';
  const canSubmit =
    (normalizedEmail.includes('@') || Boolean(canUseCurrentSessionForSignup && sessionEmail.includes('@'))) &&
    (canUseCurrentSessionForSignup || password.length >= 6) &&
    (!requiresName || displayName.trim().length >= 2) &&
    (mode !== 'school' || schoolName.trim().length >= 2) &&
    (mode !== 'invite' || Boolean(inviteTenantId && inviteId)) &&
    !isSubmitting;

  useEffect(() => {
    const attemptId = getAuthAttemptId(mode, normalizedEmail);
    const refreshLock = () => setAuthLockMessage(getAuthLockMessage(attemptId));

    refreshLock();
    const interval = window.setInterval(refreshLock, 30000);
    return () => window.clearInterval(interval);
  }, [mode, normalizedEmail]);

  useEffect(() => {
    if (!session.user || session.isSessionLoading || !session.role) return;
    router.replace(session.isMainAdmin && !session.activeTenantId ? '/admin' : nextUrl);
  }, [nextUrl, router, session.activeTenantId, session.isMainAdmin, session.isSessionLoading, session.role, session.user]);

  useEffect(() => {
    if (!session.user || session.isSessionLoading || session.role) return;
    setEmail(value => value || session.user?.email || '');
    setDisplayName(value => value || session.user?.displayName || '');
  }, [session.isSessionLoading, session.role, session.user]);

  const createTenantWorkspace = async (user: User, type: 'school' | 'solo') => {
    const now = new Date().toISOString();
    const tenantRef = doc(collection(firestore, 'tenants'));
    const userRef = doc(firestore, 'users', user.uid);
    const memberRef = doc(firestore, 'tenants', tenantRef.id, 'members', user.uid);
    const ownerEmail = normalizeEmail(user.email || normalizedEmail);
    const ownerDisplayName = displayName.trim() || user.displayName || ownerEmail;
    const tenantName = type === 'school' ? schoolName.trim() : `${ownerDisplayName}'s Workspace`;
    const role = type === 'school' ? 'schoolAdmin' : 'soloInstructor';
    const plan = getPlanForTenantType(type);
    const batch = writeBatch(firestore);

    batch.set(tenantRef, {
      name: tenantName,
      type,
      status: 'active',
      plan,
      seatLimit: getIncludedSeats(plan),
      extraSeats: 0,
      subscriptionStatus: 'checkout_pending',
      billingLocked: true,
      ownerUid: user.uid,
      ownerEmail,
      createdAt: now,
      updatedAt: now,
    });
    batch.set(userRef, {
      uid: user.uid,
      email: ownerEmail,
      displayName: ownerDisplayName,
      activeTenantId: tenantRef.id,
      tenantIds: [tenantRef.id],
      createdAt: now,
      updatedAt: now,
    }, { merge: true });
    batch.set(memberRef, {
      uid: user.uid,
      email: ownerEmail,
      displayName: ownerDisplayName,
      role,
      status: 'active',
      tenantId: tenantRef.id,
      createdAt: now,
      updatedAt: now,
    });

    await batch.commit();
    return tenantRef.id;
  };

  const startBillingCheckout = async (user: User, tenantId: string, type: 'school' | 'solo') => {
    const response = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await user.getIdToken()}`,
      },
      body: JSON.stringify({
        tenantId,
        plan: getPlanForTenantType(type),
        seatLimit: getIncludedSeats(getPlanForTenantType(type)),
      }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.url) {
      throw new Error(data.error || 'Workspace was created, but billing checkout could not start.');
    }

    window.location.assign(data.url);
  };

  const getExistingWorkspace = async (user: User) => {
    const profileSnap = await getDoc(doc(firestore, 'users', user.uid));
    if (!profileSnap.exists()) return null;

    const profile = profileSnap.data() as AppUserProfile;
    const activeTenantId = profile.activeTenantId || null;
    if (!activeTenantId) return null;

    if (normalizeEmail(user.email) === MAIN_ADMIN_EMAIL) {
      return { activeTenantId, role: 'mainAdmin' as const };
    }

    const memberSnap = await getDoc(doc(firestore, 'tenants', activeTenantId, 'members', user.uid));
    if (!memberSnap.exists()) return { activeTenantId, role: null };

    const member = memberSnap.data() as TenantMember;
    return {
      activeTenantId,
      role: member.status === 'active' ? member.role : null,
    };
  };

  const acceptInvite = async (user: User, emailOverride?: string) => {
    if (!inviteTenantId || !inviteId) {
      throw new Error('This invite link is missing school information.');
    }

    const inviteEmail = normalizeEmail(emailOverride || user.email || normalizedEmail);
    const inviteRef = doc(firestore, 'tenants', inviteTenantId, 'invites', inviteId);
    const inviteSnap = await getDoc(inviteRef);
    if (!inviteSnap.exists()) {
      throw new Error('This invite was not found.');
    }

    const invite = { ...(inviteSnap.data() as TenantInvite), id: inviteSnap.id };
    if (invite.status !== 'pending') {
      throw new Error('This invite is no longer available.');
    }
    if (normalizeEmail(invite.email) !== inviteEmail) {
      throw new Error('This invite is for a different email address.');
    }

    const now = new Date().toISOString();
    const userRef = doc(firestore, 'users', user.uid);
    const memberRef = doc(firestore, 'tenants', inviteTenantId, 'members', user.uid);
    const batch = writeBatch(firestore);

    batch.set(userRef, {
      uid: user.uid,
      email: inviteEmail,
      displayName: displayName.trim() || user.displayName || inviteEmail,
      activeTenantId: inviteTenantId,
      tenantIds: [inviteTenantId],
      createdAt: now,
      updatedAt: now,
    }, { merge: true });
    batch.set(memberRef, {
      uid: user.uid,
      email: inviteEmail,
      displayName: displayName.trim() || user.displayName || inviteEmail,
      role: 'schoolInstructor',
      status: 'active',
      tenantId: inviteTenantId,
      inviteId,
      createdAt: now,
      updatedAt: now,
    }, { merge: true });
    batch.update(inviteRef, {
      status: 'accepted',
      acceptedAt: now,
      acceptedByUid: user.uid,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setNotice('');

    if (!canUseCurrentSessionForSignup && password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    const attemptId = getAuthAttemptId(mode, normalizedEmail);
    const lockMessage = getAuthLockMessage(attemptId);
    if (lockMessage) {
      setAuthLockMessage(lockMessage);
      setError(lockMessage);
      return;
    }

    setIsSubmitting(true);
    try {
      await setPersistence(auth, keepLoggedIn ? browserLocalPersistence : browserSessionPersistence);
      let user: User;

      if (canUseCurrentSessionForSignup && session.user) {
        user = session.user;
      } else if (mode === 'login') {
        const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
        user = credential.user;
      } else {
        try {
          const credential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
          user = credential.user;
        } catch (signupError) {
          if (mode !== 'invite' || !/auth\/email-already-in-use/i.test(signupError instanceof Error ? signupError.message : String(signupError))) {
            throw signupError;
          }
          const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
          user = credential.user;
        }
      }

      if (displayName.trim()) {
        await updateProfile(user, { displayName: displayName.trim() }).catch(() => undefined);
      }

      if (mode === 'school') {
        const tenantId = await createTenantWorkspace(user, 'school');
        await startBillingCheckout(user, tenantId, 'school');
        return;
      } else if (mode === 'solo') {
        const tenantId = await createTenantWorkspace(user, 'solo');
        await startBillingCheckout(user, tenantId, 'solo');
        return;
      } else if (mode === 'invite') {
        await acceptInvite(user);
      }

      clearAuthAttempts(attemptId);
      router.replace(normalizedEmail === MAIN_ADMIN_EMAIL && mode === 'login' ? '/admin' : nextUrl);
    } catch (submitError) {
      const lockoutMessage = shouldCountFailedAttempt(submitError) ? recordFailedAuthAttempt(attemptId) : '';
      setAuthLockMessage(lockoutMessage);
      setError(lockoutMessage || getAuthErrorMessage(submitError, 'email'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError('');
    setNotice('');
    setIsSubmitting(true);

    try {
      await setPersistence(auth, keepLoggedIn ? browserLocalPersistence : browserSessionPersistence);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const credential = await signInWithPopup(auth, provider);
      const user = credential.user;
      const googleEmail = normalizeEmail(user.email);

      if (mode === 'invite') {
        await acceptInvite(user, googleEmail);
        router.replace(nextUrl);
        return;
      }

      if (mode === 'school' || mode === 'solo') {
        if (mode === 'school' && schoolName.trim().length < 2) {
          setError('Enter the school name first.');
          return;
        }

        const existingWorkspace = await getExistingWorkspace(user);
        if (existingWorkspace?.role) {
          setError('This Google account is already connected to an InstructorOS workspace. Use Login with Google, or choose a different Google account.');
          return;
        }

        const tenantId = await createTenantWorkspace(user, mode === 'school' ? 'school' : 'solo');
        await startBillingCheckout(user, tenantId, mode === 'school' ? 'school' : 'solo');
        return;
      }

      router.replace(googleEmail === MAIN_ADMIN_EMAIL && mode === 'login' ? '/admin' : nextUrl);
    } catch (googleError) {
      setError(getAuthErrorMessage(googleError, 'google'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    setError('');
    setNotice('');

    if (!normalizedEmail.includes('@')) {
      setError('Enter your email first.');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, normalizedEmail);
      setNotice('Password reset email sent.');
    } catch (resetError) {
      setError(getAuthErrorMessage(resetError, 'email'));
    }
  };

  const title = mode === 'login' ? 'Welcome back' : mode === 'school' ? 'Create school workspace' : mode === 'solo' ? 'Create instructor workspace' : 'Accept school invite';
  const googleButtonLabel = mode === 'login'
    ? 'Continue with Google'
    : mode === 'school'
      ? 'Create school with Google'
      : mode === 'solo'
        ? 'Create instructor with Google'
        : 'Accept invite with Google';

  return (
    <div className="min-h-screen bg-[#F7F8FA] px-4 py-8 text-[#111827]">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>

        <Card className="overflow-hidden rounded-3xl border-0 shadow-2xl">
          <CardHeader className="bg-[#0D1B2A] px-6 py-7 text-white">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F4C430] text-[#0D1B2A]">
              {mode === 'school' ? <Building2 className="h-6 w-6" /> : <UserRound className="h-6 w-6" />}
            </div>
            <CardTitle className="text-2xl">{title}</CardTitle>
            <p className="mt-2 text-sm text-white/65">
              Manage students, schedules, payments, and instructors in one workspace.
            </p>
          </CardHeader>
          <CardContent className="space-y-5 p-6">
            {hasUnconnectedSession && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <p className="font-semibold">Signed in as {session.user?.email}</p>
                <p className="mt-1">This account is not connected to a workspace yet. Logout first if you want to create a new school or instructor account with a different email.</p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3 h-10 rounded-xl bg-white"
                  onClick={() => signOut(auth)}
                >
                  Logout current account
                </Button>
              </div>
            )}

            <div className="grid grid-cols-2 rounded-2xl bg-muted p-1">
              {([
                ['login', 'Login'],
                ['school', 'School'],
                ['solo', 'Individual'],
                ['invite', 'Invite'],
              ] as const).map(([value, label]) => (
                <Button
                  key={value}
                  type="button"
                  variant="ghost"
                  className={cn('rounded-xl', mode === value && 'bg-background shadow-sm')}
                  onClick={() => {
                    setMode(value);
                    setError('');
                  }}
                >
                  {label}
                </Button>
              ))}
            </div>

            {mode === 'invite' && (!inviteTenantId || !inviteId) && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Open the invite link from your school admin to accept a school instructor account.
              </div>
            )}

            <form className="space-y-4" onSubmit={handleSubmit}>
              {requiresName && (
                <div className="space-y-2">
                  <Label htmlFor="displayName">Your name</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="Enter your full name"
                    className="h-12 rounded-2xl"
                    autoComplete="name"
                  />
                </div>
              )}

              {mode === 'school' && (
                <div className="space-y-2">
                  <Label htmlFor="schoolName">School name</Label>
                  <Input
                    id="schoolName"
                    value={schoolName}
                    onChange={(event) => setSchoolName(event.target.value)}
                    placeholder="Example Driving School"
                    className="h-12 rounded-2xl"
                    autoComplete="organization"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Enter your email"
                    className="h-12 rounded-2xl pl-10"
                    autoComplete="email"
                    inputMode="email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter password"
                    className="h-12 rounded-2xl pl-10 pr-11"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 h-10 w-10 -translate-y-1/2 rounded-xl"
                    onClick={() => setShowPassword(value => !value)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <label className="flex items-center gap-3 rounded-2xl border bg-muted/30 px-3 py-3 text-sm">
                <Checkbox
                  checked={keepLoggedIn}
                  onCheckedChange={(checked) => setKeepLoggedIn(Boolean(checked))}
                />
                <span className="font-medium">Keep me logged in</span>
              </label>

              {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
              {!error && authLockMessage && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{authLockMessage}</div>}
              {notice && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}

              <Button type="submit" className="h-12 w-full rounded-2xl text-base font-bold" disabled={!canSubmit || Boolean(authLockMessage)}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === 'login' ? 'Login' : mode === 'invite' ? 'Accept Invite' : 'Create Workspace'}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="h-12 w-full rounded-2xl text-base font-bold"
              onClick={handleGoogleAuth}
              disabled={isSubmitting || (mode === 'school' && schoolName.trim().length < 2)}
            >
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {googleButtonLabel}
            </Button>

            <Button type="button" variant="link" className="h-auto w-full p-0 text-sm text-muted-foreground" onClick={handleResetPassword}>
              Forgot password?
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
