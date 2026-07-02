'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { Eye, EyeOff, Loader2, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth, useUser } from '@/firebase';
import { OWNER_EMAIL, isOwnerEmail } from '@/lib/auth-config';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/logo';

function getAuthErrorMessage(error: unknown) {
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
    return 'Email/password login is not enabled in Firebase yet.';
  }
  if (/auth\/too-many-requests/i.test(message)) {
    return 'Too many attempts. Please wait a little and try again.';
  }

  return 'Could not complete login. Please try again.';
}

export function LoginForm() {
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNextUrl = searchParams.get('next') || '/';
  const nextUrl = rawNextUrl.startsWith('/') && !rawNextUrl.startsWith('//') ? rawNextUrl : '/';

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const canSubmit = isOwnerEmail(normalizedEmail) && password.length >= 6 && !isSubmitting;

  useEffect(() => {
    if (isUserLoading || !user) return;

    if (isOwnerEmail(user.email)) {
      router.replace(nextUrl);
      return;
    }

    signOut(auth).catch(() => undefined);
    setError('This app is only for the SparkOn owner account.');
  }, [auth, isUserLoading, nextUrl, router, user]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setNotice('');

    if (!isOwnerEmail(normalizedEmail)) {
      setError(`Only ${OWNER_EMAIL} can use this app.`);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      await setPersistence(auth, keepLoggedIn ? browserLocalPersistence : browserSessionPersistence);

      if (mode === 'signup') {
        await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      } else {
        await signInWithEmailAndPassword(auth, normalizedEmail, password);
      }

      router.replace(nextUrl);
    } catch (submitError) {
      setError(getAuthErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    setError('');
    setNotice('');

    if (!isOwnerEmail(normalizedEmail)) {
      setError(`Enter ${OWNER_EMAIL} first.`);
      return;
    }

    try {
      await sendPasswordResetEmail(auth, normalizedEmail);
      setNotice('Password reset email sent.');
    } catch (resetError) {
      setError(getAuthErrorMessage(resetError));
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA] px-4 py-8 text-[#111827]">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>

        <Card className="overflow-hidden rounded-3xl border-0 shadow-2xl">
          <CardHeader className="bg-[#0D1B2A] px-6 py-7 text-white">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F4C430] text-[#0D1B2A]">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl">
              {mode === 'signup' ? 'Create owner login' : 'Welcome back'}
            </CardTitle>
            <p className="mt-2 text-sm text-white/65">
              Sign in to manage SparkOn students, payments, and schedule.
            </p>
          </CardHeader>
          <CardContent className="space-y-5 p-6">
            <div className="grid grid-cols-2 rounded-2xl bg-muted p-1">
              <Button
                type="button"
                variant="ghost"
                className={cn('rounded-xl', mode === 'login' && 'bg-background shadow-sm')}
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
              >
                Login
              </Button>
              <Button
                type="button"
                variant="ghost"
                className={cn('rounded-xl', mode === 'signup' && 'bg-background shadow-sm')}
                onClick={() => {
                  setMode('signup');
                  setError('');
                }}
              >
                First Signup
              </Button>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
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
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
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

              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {notice && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {notice}
                </div>
              )}

              <Button type="submit" className="h-12 w-full rounded-2xl text-base font-bold" disabled={!canSubmit}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === 'signup' ? 'Create Account' : 'Login'}
              </Button>
            </form>

            <Button
              type="button"
              variant="link"
              className="h-auto w-full p-0 text-sm text-muted-foreground"
              onClick={handleResetPassword}
            >
              Forgot password?
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
