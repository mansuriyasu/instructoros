"use client";

import { useState } from "react";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence,
  signInWithCustomToken,
  signOut,
} from "firebase/auth";
import { Loader2, LogIn, ShieldCheck } from "lucide-react";
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
    return "Mobile number or PIN is not correct.";
  if (/auth\/too-many-requests/i.test(message))
    return "Too many attempts. Please wait a little and try again.";
  return message || "Could not sign in to the student portal.";
}

export default function StudentLoginPage() {
  const auth = useAuth();
  const { user } = useUser();
  const [mobileNumber, setMobileNumber] = useState("");
  const [pin, setPin] = useState("");
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);
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
      const response = await fetch("/api/student-portal/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobileNumber, pin }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || typeof data.customToken !== "string") {
        throw new Error(data.error || "Mobile number or PIN is not correct.");
      }
      const credential = await signInWithCustomToken(auth, data.customToken);
      await finishSignIn(credential.user);
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
              Use the mobile number verified by SMS and your 6-digit PIN.
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
              Mobile number
              <Input
                className="mt-2"
                type="tel"
                required
                inputMode="tel"
                autoComplete="tel"
                placeholder="416 555 0123"
                value={mobileNumber}
                onChange={(event) => setMobileNumber(event.target.value)}
              />
            </label>
            <label className="block text-sm font-semibold">
              6-digit PIN
              <Input
                className="mt-2 tracking-[0.35em]"
                type="password"
                required
                inputMode="numeric"
                autoComplete="current-password"
                maxLength={6}
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
              />
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
          <div className="mt-6 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
            Only the student account linked to your registration can open this
            portal.
          </div>
        </section>
      </div>
    </main>
  );
}
