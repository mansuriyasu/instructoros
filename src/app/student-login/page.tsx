"use client";

import { useState } from "react";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence,
  signInWithCustomToken,
  signOut,
} from "firebase/auth";
import { Loader2, LogIn, MessageSquareText, ShieldCheck } from "lucide-react";
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
  const [otpCode, setOtpCode] = useState("");
  const [otpPin, setOtpPin] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [mode, setMode] = useState<"pin" | "otp">("pin");
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

  const sendOtp = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/student-portal/login-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", mobileNumber }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Could not send the verification code.");
      }
      setOtpSent(true);
      setNotice(data.message || "A verification code was sent by text message.");
    } catch (cause) {
      setError(authMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async (event: React.FormEvent) => {
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
      const response = await fetch("/api/student-portal/login-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          mobileNumber,
          code: otpCode,
          pin: otpPin,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || typeof data.customToken !== "string") {
        throw new Error(data.error || "Could not verify the code.");
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
              Use your mobile number and PIN, or verify by text message if you need to set or reset your PIN.
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
          <div className="mb-4 grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-sm font-semibold">
            <button
              type="button"
              className={`rounded-lg px-3 py-2 ${mode === "pin" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"}`}
              onClick={() => {
                setMode("pin");
                setError("");
                setNotice("");
              }}
            >
              PIN login
            </button>
            <button
              type="button"
              className={`rounded-lg px-3 py-2 ${mode === "otp" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"}`}
              onClick={() => {
                setMode("otp");
                setError("");
                setNotice("");
              }}
            >
              OTP / set PIN
            </button>
          </div>

          <form onSubmit={mode === "pin" ? signIn : verifyOtp} className="space-y-4">
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
            {mode === "pin" ? (
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
            ) : (
              <div className="space-y-4 rounded-xl border border-amber-100 bg-amber-50/60 p-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">No PIN yet?</p>
                  <p className="mt-1 text-xs text-slate-600">
                    We will text a code to the mobile number on your student record. After verification, create a 6-digit PIN for next time.
                  </p>
                </div>
                {!otpSent ? (
                  <Button
                    type="button"
                    disabled={busy}
                    className="h-11 w-full bg-slate-950 font-bold text-white hover:bg-slate-800"
                    onClick={sendOtp}
                  >
                    {busy ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <MessageSquareText className="mr-2 h-4 w-4" />
                    )}
                    Send OTP
                  </Button>
                ) : (
                  <>
                    <label className="block text-sm font-semibold">
                      6-digit text code
                      <Input
                        className="mt-2 tracking-[0.35em]"
                        required
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={otpCode}
                        onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, ""))}
                      />
                    </label>
                    <label className="block text-sm font-semibold">
                      Create/reset 6-digit PIN
                      <Input
                        className="mt-2 tracking-[0.35em]"
                        type="password"
                        required
                        inputMode="numeric"
                        autoComplete="new-password"
                        maxLength={6}
                        value={otpPin}
                        onChange={(event) => setOtpPin(event.target.value.replace(/\D/g, ""))}
                      />
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      className="w-full"
                      onClick={sendOtp}
                    >
                      Send a new code
                    </Button>
                  </>
                )}
              </div>
            )}
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={keepLoggedIn}
                onChange={(event) => setKeepLoggedIn(event.target.checked)}
              />{" "}
              Keep me logged in
            </label>
            <Button
              disabled={
                busy ||
                (mode === "otp" && (!otpSent || otpCode.length !== 6 || otpPin.length !== 6))
              }
              className="h-12 w-full bg-amber-400 font-bold text-slate-950 hover:bg-amber-500"
            >
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="mr-2 h-4 w-4" />
              )}
              {mode === "pin" ? "Sign in to Student Portal" : "Verify OTP and open portal"}
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
