"use client";

import { use, useEffect, useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { signInWithCustomToken } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Logo } from "@/components/logo";
import { useAuth } from "@/firebase";
import { compressImage } from "@/lib/image-utils";

type FormInfo = {
  workspaceName: string;
  logoDataUrl?: string | null;
  expiresAt?: string | null;
};
type Fields = {
  name: string;
  email: string;
  mobileNumber: string;
  address: string;
  birthdate: string;
  licenseNumber: string;
  licenseExpiry: string;
  licenseType: "G1" | "G2" | "G" | "Other";
  drivingGoal: string;
  experienceLevel: string;
  studentSubmittedNotes: string;
  comments: string;
  guardianName: string;
  guardianPhone: string;
  guardianRelationship: string;
  emergencyName: string;
  emergencyPhone: string;
  emergencyRelationship: string;
};
const emptyFields: Fields = {
  name: "",
  email: "",
  mobileNumber: "",
  address: "",
  birthdate: "",
  licenseNumber: "",
  licenseExpiry: "",
  licenseType: "G2",
  drivingGoal: "beginner",
  experienceLevel: "none",
  studentSubmittedNotes: "",
  comments: "",
  guardianName: "",
  guardianPhone: "",
  guardianRelationship: "",
  emergencyName: "",
  emergencyPhone: "",
  emergencyRelationship: "",
};

export default function StudentIntakePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const auth = useAuth();
  const [info, setInfo] = useState<FormInfo | null>(null);
  const [fields, setFields] = useState<Fields>(emptyFields);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [submission, setSubmission] = useState<{
    claimToken: string;
    possibleDuplicate: boolean;
  } | null>(null);
  const [pin, setPin] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [licenseImageData, setLicenseImageData] = useState("");
  const [licenseUploadError, setLicenseUploadError] = useState("");

  useEffect(() => {
    fetch(`/api/student-intake?token=${encodeURIComponent(token)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        return data;
      })
      .then(setInfo)
      .catch((error) => setError(error.message || "This form is unavailable."))
      .finally(() => setLoading(false));
  }, [token]);

  const setField = (key: keyof Fields, value: string) =>
    setFields((current) => ({ ...current, [key]: value }));
  const sendOtp = async () => {
    if (!submission) return;
    setOtpSending(true);
    setError("");
    try {
      const response = await fetch("/api/student-portal/claim-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          claimToken: submission.claimToken,
          action: "send",
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Could not send the SMS code.");
      setOtpSent(true);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not send the SMS code.",
      );
    } finally {
      setOtpSending(false);
    }
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch("/api/student-intake", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...fields, licenseImageData }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      sessionStorage.setItem("studentPortalClaimToken", data.claimToken);
      setSubmission({
        claimToken: data.claimToken,
        possibleDuplicate: Boolean(data.possibleDuplicate),
      });
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not submit the form.",
      );
    } finally {
      setSubmitting(false);
    }
  };
  const createAccount = async () => {
    setError("");
    setCreating(true);
    try {
      await sendOtp();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not send the SMS code.",
      );
    } finally {
      setCreating(false);
    }
  };
  const verifyOtp = async () => {
    if (!submission) return;
    setCreating(true);
    setError("");
    try {
      const response = await fetch("/api/student-portal/claim-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          claimToken: submission.claimToken,
          action: "verify",
          code: otpCode,
          pin,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Could not verify the SMS code.");
      if (typeof data.customToken !== "string") {
        throw new Error("Could not open the student portal.");
      }
      await signInWithCustomToken(auth, data.customToken);
      window.location.assign("/student-portal");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not verify the SMS code.",
      );
    } finally {
      setCreating(false);
    }
  };

  if (loading)
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </main>
    );
  if (error && !info)
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
        <div className="w-full max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold">Form unavailable</h1>
          <p className="mt-3 text-sm text-slate-600">{error}</p>
        </div>
      </main>
    );
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 flex justify-center">
          <Logo imageClassName="w-[180px]" />
        </div>
        <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-8">
          <div className="mb-7">
            <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">
              Student registration
            </p>
            <h1 className="mt-2 text-3xl font-black">Tell us about yourself</h1>
            <p className="mt-2 text-slate-600">
              Complete this secure form for {info?.workspaceName}. Email is
              required to create your student portal account.
            </p>
          </div>
          {error && (
            <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}
          {!submission ? (
            <form onSubmit={submit} className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Full legal name" required>
                  <Input
                    required
                    value={fields.name}
                    onChange={(e) => setField("name", e.target.value)}
                  />
                </Field>
                <Field label="Email address" required>
                  <Input
                    required
                    type="email"
                    value={fields.email}
                    onChange={(e) => setField("email", e.target.value)}
                  />
                </Field>
                <Field label="Mobile number" required>
                  <Input
                    required
                    type="tel"
                    value={fields.mobileNumber}
                    onChange={(e) => setField("mobileNumber", e.target.value)}
                  />
                </Field>
                <Field label="Birthdate">
                  <Input
                    type="date"
                    value={fields.birthdate}
                    onChange={(e) => setField("birthdate", e.target.value)}
                  />
                </Field>
              </div>
              <div className="rounded-xl border bg-slate-50 p-4">
                <h2 className="font-bold">Licence document</h2>
                <p className="mt-1 text-xs text-slate-600">
                  Upload a clear photo or screenshot of your licence. Your
                  instructor will review the saved image and confirm the
                  extracted details.
                </p>
                <label className="mt-4 flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white px-4 py-5 text-sm font-semibold hover:bg-slate-50">
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      event.currentTarget.value = "";
                      if (!file) return;
                      setLicenseUploadError("");
                      if (!file.type.startsWith("image/")) {
                        setLicenseUploadError(
                          "Please choose a JPG, PNG, or HEIC image.",
                        );
                        return;
                      }
                      try {
                        let value = await compressImage(file, 1200, 0.72);
                        if (value.length > 1_800_000) {
                          value = await compressImage(file, 900, 0.58);
                        }
                        if (value.length > 1_800_000) {
                          setLicenseUploadError(
                            "This image is still too large after resizing. Please take a closer screenshot of the licence and try again.",
                          );
                          return;
                        }
                        setLicenseImageData(value);
                      } catch {
                        setLicenseUploadError(
                          "Could not read that image. Please try again.",
                        );
                      }
                    }}
                  />
                  {licenseImageData
                    ? "Licence image selected - change image"
                    : "Choose licence image"}
                </label>
                {licenseImageData && (
                  <img
                    src={licenseImageData}
                    alt="Selected licence preview"
                    className="mt-3 max-h-44 w-full rounded-lg border object-contain"
                  />
                )}
                {licenseUploadError && (
                  <p className="mt-2 text-sm text-red-700">
                    {licenseUploadError}
                  </p>
                )}
                <p className="mt-2 text-xs text-slate-500">
                  After you activate your account, InstructorOS can read the
                  licence details and save your face profile image.
                </p>
              </div>
              <Field label="Pickup address">
                <Input
                  value={fields.address}
                  onChange={(e) => setField("address", e.target.value)}
                />
              </Field>
              <div className="rounded-xl border bg-slate-50 p-4">
                <h2 className="font-bold">Guardian and emergency contact</h2>
                <p className="mt-1 text-xs text-slate-600">
                  Provide a guardian if applicable and someone we can contact in
                  an emergency.
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label="Guardian name">
                    <Input
                      value={fields.guardianName}
                      onChange={(e) => setField("guardianName", e.target.value)}
                    />
                  </Field>
                  <Field label="Guardian phone">
                    <Input
                      type="tel"
                      value={fields.guardianPhone}
                      onChange={(e) =>
                        setField("guardianPhone", e.target.value)
                      }
                    />
                  </Field>
                  <Field label="Guardian relationship">
                    <Input
                      placeholder="Parent, spouse, etc."
                      value={fields.guardianRelationship}
                      onChange={(e) =>
                        setField("guardianRelationship", e.target.value)
                      }
                    />
                  </Field>
                  <Field label="Emergency contact name">
                    <Input
                      value={fields.emergencyName}
                      onChange={(e) =>
                        setField("emergencyName", e.target.value)
                      }
                    />
                  </Field>
                  <Field label="Emergency contact phone">
                    <Input
                      type="tel"
                      value={fields.emergencyPhone}
                      onChange={(e) =>
                        setField("emergencyPhone", e.target.value)
                      }
                    />
                  </Field>
                  <Field label="Emergency relationship">
                    <Input
                      placeholder="Parent, spouse, etc."
                      value={fields.emergencyRelationship}
                      onChange={(e) =>
                        setField("emergencyRelationship", e.target.value)
                      }
                    />
                  </Field>
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Licence type">
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={fields.licenseType}
                    onChange={(e) => setField("licenseType", e.target.value)}
                  >
                    <option>G1</option>
                    <option>G2</option>
                    <option>G</option>
                    <option>Other</option>
                  </select>
                </Field>
                <Field label="Licence number">
                  <Input
                    value={fields.licenseNumber}
                    onChange={(e) => setField("licenseNumber", e.target.value)}
                  />
                </Field>
                <Field label="Licence expiry">
                  <Input
                    type="date"
                    value={fields.licenseExpiry}
                    onChange={(e) => setField("licenseExpiry", e.target.value)}
                  />
                </Field>
                <Field label="Driving goal">
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={fields.drivingGoal}
                    onChange={(e) => setField("drivingGoal", e.target.value)}
                  >
                    <option value="beginner">Beginner driving lessons</option>
                    <option value="g2-prep">G2 road-test preparation</option>
                    <option value="g-prep">G road-test preparation</option>
                    <option value="refresher">Refresher lessons</option>
                    <option value="other">Other</option>
                  </select>
                </Field>
                <Field label="Driving experience">
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={fields.experienceLevel}
                    onChange={(e) =>
                      setField("experienceLevel", e.target.value)
                    }
                  >
                    <option value="none">No experience</option>
                    <option value="beginner">Beginner</option>
                    <option value="some">Some experience</option>
                    <option value="experienced">Experienced</option>
                  </select>
                </Field>
              </div>
              <Field label="Anything your instructor should know">
                <Textarea
                  value={fields.studentSubmittedNotes}
                  onChange={(e) =>
                    setField("studentSubmittedNotes", e.target.value)
                  }
                  className="min-h-28"
                />
              </Field>
              <div className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                Your information is shared only with this InstructorOS
                workspace.
              </div>
              <Button
                type="submit"
                disabled={submitting}
                className="h-12 w-full bg-amber-400 text-slate-950 hover:bg-amber-500"
              >
                {submitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {submitting ? "Submitting..." : "Continue to account setup"}
              </Button>
            </form>
          ) : (
            <div className="space-y-5">
              <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">
                <CheckCircle2 className="mb-2 h-6 w-6" />
                Your information is registered.{" "}
                {submission.possibleDuplicate
                  ? "The workspace will review a possible duplicate before confirming it."
                  : ""}
              </div>
              <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                Registration email: <strong>{fields.email}</strong>
              </p>
              {otpSent && (
                <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                  We sent a 6-digit verification code by text message to your
                  registered mobile number. The code expires in 10 minutes.
                </p>
              )}
                <Field label="Create a 6-digit portal PIN" required>
                <Input
                  type="password"
                  inputMode="numeric"
                  autoComplete="new-password"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="6 digits"
                />
              </Field>
              {!otpSent ? (
                <Button
                  disabled={creating || pin.length !== 6}
                  onClick={createAccount}
                  className="h-12 w-full bg-amber-400 text-slate-950 hover:bg-amber-500"
                >
                  {creating ? "Creating account..." : "Send SMS code"}
                </Button>
              ) : (
                <>
                  <Field label="SMS verification code" required>
                    <Input
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) =>
                        setOtpCode(e.target.value.replace(/\D/g, ""))
                      }
                      placeholder="6-digit code"
                    />
                  </Field>
                  <Button
                    disabled={creating || otpCode.length !== 6}
                    onClick={verifyOtp}
                    className="h-12 w-full bg-amber-400 text-slate-950 hover:bg-amber-500"
                  >
                    {creating
                      ? "Activating portal..."
                      : "Verify code and activate portal"}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={otpSending || creating}
                    onClick={sendOtp}
                    className="h-11 w-full"
                  >
                    {otpSending ? "Sending code..." : "Send a new code"}
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                onClick={() => window.location.assign("/student-login")}
                className="w-full"
              >
                I already have a student account
              </Button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold">
        {label}
        {required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}
