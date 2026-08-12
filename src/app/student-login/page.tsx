"use client";

import { useState } from "react";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { Eye, EyeOff, Loader2, LogIn, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth, useUser } from "@/firebase";

function authMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (
    /auth\/invalid-credential|auth\/wrong-password|auth\/user-not-found/i.test(
      message,
    )
  )
    return "Email or password is not correct.";
  if (/auth\/too-many-requests/i.test(message))
    return "Too many attempts. Please wait a little and try again.";
  if (/auth\/popup-blocked/i.test(message))
    return "The Google sign-in popup was blocked. Allow popups for this site and try again.";
  if (/auth\/popup-closed-by-user|auth\/cancelled-popup-request/i.test(message))
    return "Google sign-in was cancelled.";
  if (/auth\/unauthorized-domain/i.test(message))
    return "This domain is not authorized for Firebase login yet.";
  return message || "Could not sign in to the student portal.";
}

export default function StudentLoginPage() {
  const auth = useAuth();
  const { user } = useUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const finishSignIn = async (accountUser: typeof user) => {
    if (!accountUser)
      throw new Error("Could not sign in to the student portal.");
    const response = await fetch("/api/student-portal", {
      headers: {
        Authorization: `Bearer ${await accountUser.getIdToken(true)}`,
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      await signOut(auth);
      throw new Error(
        data.error || "This account is not linked to a student portal.",
      );
    }
    window.location.assign("/student-portal");
  };

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (user) await signOut(auth);
      await setPersistence(
        auth,
        keepLoggedIn ? browserLocalPersistence : browserSessionPersistence,
      );
      const credential = await signInWithEmailAndPassword(
        auth,
        email.trim().toLowerCase(),
        password,
      );
      await finishSignIn(credential.user);
    } catch (cause) {
      setError(authMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const signInGoogle = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (user) await signOut(auth);
      await setPersistence(
        auth,
        keepLoggedIn ? browserLocalPersistence : browserSessionPersistence,
      );
      const credential = await signInWithPopup(auth, new GoogleAuthProvider());
      await finishSignIn(credential.user);
    } catch (cause) {
      setError(authMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    if (!email.trim()) {
      setError("Enter your email first so we can send a password reset link.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await sendPasswordResetEmail(auth, email.trim().toLowerCase());
      setNotice(
        "Password reset instructions were sent if a student account exists for that email.",
      );
    } catch (cause) {
      setError(authMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900 sm:px-6">
      <div className="mx-auto flex w-full max-w-md flex-col items-center">
        <Logo imageClassName="w-[190px]" />
        <section className="mt-8 w-full rounded-2xl border bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
              Student Portal
            </p>
            <h1 className="mt-2 text-3xl font-black">Welcome back</h1>
            <p className="mt-2 text-sm text-slate-600">
              View your lessons, availability, payments, and driving progress.
            </p>
          </div>
          {error && (
            <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}
          {notice && (
            <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
              {notice}
            </p>
          )}
          <form onSubmit={signIn} className="space-y-4">
            <label className="block text-sm font-semibold">
              Email address
              <Input
                className="mt-2"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label className="block text-sm font-semibold">
              Password
              <div className="relative mt-2">
                <Input
                  className="pr-11"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={keepLoggedIn}
                onChange={(event) => setKeepLoggedIn(event.target.checked)}
              />{" "}
              Keep me logged in
            </label>
            <Button
              disabled={busy}
              className="h-12 w-full bg-amber-400 font-bold text-slate-950 hover:bg-amber-500"
            >
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="mr-2 h-4 w-4" />
              )}
              Sign in to Student Portal
            </Button>
          </form>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={signInGoogle}
            className="mt-4 h-12 w-full"
          >
            Continue with Google
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={resetPassword}
            className="mt-2 w-full text-sm"
          >
            Forgot password?
          </Button>
          <div className="mt-6 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
            Only the student account linked to your registration can open this
            portal.
          </div>
          <p className="mt-6 text-center text-sm text-slate-600">
            Are you a school or instructor?{" "}
            <a className="font-semibold text-amber-700 underline" href="/login">
              Staff sign in
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
