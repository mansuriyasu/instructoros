"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileImage,
  Loader2,
  LogOut,
  Save,
  X,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddressAutocompleteInput } from "@/components/address-autocomplete-input";
import { useAuth, useUser } from "@/firebase";
import { getStudentPackageData } from "@/lib/package-utils";
import { prepareLicenseFileForAi, scanLicenseFile } from "@/lib/license-scan-client";
import { useStorage } from "@/hooks/use-storage";

type PortalData = {
  tenant: { name: string; logoDataUrl?: string | null };
  account: { email: string; status: string; lastLoginAt?: string };
  student: Record<string, any>;
  events: any[];
  payments: any[];
  evaluations: any[];
  availability: { weeklyWindows: any[]; overrides: any[]; timezone?: string };
};
type Tab =
  | "overview"
  | "profile"
  | "schedule"
  | "payments"
  | "availability"
  | "progress";
const weekdays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export default function StudentPortalPage() {
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const [data, setData] = useState<PortalData | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [availability, setAvailability] = useState({
    weeklyWindows: [] as any[],
    overrides: [] as any[],
    timezone: "America/Toronto",
  });

  const load = async () => {
    if (!user) return;
    const response = await fetch("/api/student-portal", {
      headers: { Authorization: `Bearer ${await user.getIdToken()}` },
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error || "Could not load your portal.");
    setData(result);
    setAvailability(result.availability);
  };
  useEffect(() => {
    if (!isUserLoading) load().catch((e) => setError(e.message));
  }, [isUserLoading, user]);

  const packageData = useMemo(
    () =>
      data
        ? getStudentPackageData(data.payments, data.events, data.student.id)
        : null,
    [data],
  );
  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !data) return;
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const body: Record<string, any> = Object.fromEntries(form.entries());
    body.licenseType = String(body.licenseType || "G2");
    body.guardianContact = {
      name: String(body["guardianContact.name"] || ""),
      phone: String(body["guardianContact.phone"] || ""),
      relationship: String(body["guardianContact.relationship"] || ""),
    };
    body.emergencyContact = {
      name: String(body["emergencyContact.name"] || ""),
      phone: String(body["emergencyContact.phone"] || ""),
      relationship: String(body["emergencyContact.relationship"] || ""),
    };
    delete body["guardianContact.name"];
    delete body["guardianContact.phone"];
    delete body["guardianContact.relationship"];
    delete body["emergencyContact.name"];
    delete body["emergencyContact.phone"];
    delete body["emergencyContact.relationship"];
    try {
      const response = await fetch("/api/student-portal", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${await user.getIdToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  };
  const saveAvailability = async () => {
    if (!user) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/student-portal/availability", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${await user.getIdToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(availability),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save availability.");
    } finally {
      setSaving(false);
    }
  };
  if (isUserLoading || (!data && !error))
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-600">
        Loading your student portal...
      </main>
    );
  if (error && !data)
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <section className="max-w-md rounded-2xl bg-white p-7 text-center shadow">
          <h1 className="text-xl font-bold">Student portal unavailable</h1>
          <p className="mt-3 text-sm text-slate-600">{error}</p>
          <Button className="mt-5" onClick={() => signOut(auth)}>
            Sign out
          </Button>
        </section>
      </main>
    );
  if (!data) return null;
  const student = data.student;
  const futureEvents = data.events
    .filter((event) => new Date(event.start).getTime() >= Date.now())
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  const outstanding = data.payments.reduce(
    (sum, payment) => sum + Number(payment.amountDue || 0),
    0,
  );
  const tabs: [Tab, string][] = [
    ["overview", "Overview"],
    ["profile", "Profile"],
    ["schedule", "Schedule"],
    ["payments", "Payments"],
    ["availability", "Availability"],
    ["progress", "Progress"],
  ];
  return (
    <main className="min-h-screen bg-slate-100 pb-10 text-slate-950">
      <header className="sticky top-0 z-10 border-b bg-white/95 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-amber-600">
              Student portal
            </p>
            <h1 className="text-xl font-black">{data.tenant.name}</h1>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Sign out"
            onClick={() => signOut(auth)}
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
        <nav className="mx-auto mt-4 flex max-w-5xl gap-2 overflow-x-auto pb-1">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${tab === key ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600"}`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>
      <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
        {error && (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
        {tab === "overview" && (
          <>
            <section className="rounded-2xl bg-slate-950 p-6 text-white">
              <p className="text-sm text-slate-300">Welcome back</p>
              <h2 className="mt-1 text-3xl font-black">{student.name}</h2>
              <p className="mt-2 text-slate-300">
                {student.licenseType || "Licence"} ·{" "}
                {student.drivingGoal || "Driving lessons"}
              </p>
            </section>
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat
                icon={<CalendarDays />}
                label="Upcoming lessons"
                value={String(futureEvents.length)}
              />
              <Stat
                icon={<CreditCard />}
                label="Outstanding"
                value={`$${outstanding.toFixed(2)}`}
              />
              <Stat
                icon={<CheckCircle2 />}
                label="Evaluations"
                value={String(data.evaluations.length)}
              />
            </div>
            <section className="rounded-2xl bg-white p-5 shadow-sm">
              <h2 className="font-bold">Package balance</h2>
              {packageData?.entitlements.length ? (
                packageData.entitlements.map((item) => (
                  <div
                    key={item.serviceId}
                    className="mt-3 flex justify-between border-b pb-3 text-sm"
                  >
                    <span>{item.serviceName}</span>
                    <span className="font-bold">
                      {item.remaining} remaining · {item.used} used
                    </span>
                  </div>
                ))
              ) : (
                <p className="mt-2 text-sm text-slate-500">
                  No package credits recorded yet.
                </p>
              )}
            </section>
          </>
        )}
        {tab === "profile" && (
          <div className="space-y-4">
            <LicenseUpload student={student} user={user} onSaved={load} />
            <ProfileForm student={student} saving={saving} onSubmit={saveProfile} />
          </div>
        )}
        {tab === "schedule" && (
          <ListSection title="Your schedule">
            {data.events
              .sort(
                (a, b) =>
                  new Date(b.start).getTime() - new Date(a.start).getTime(),
              )
              .map((event) => (
                <div key={event.id} className="rounded-xl border p-4">
                  <p className="font-bold">
                    {new Date(event.start).toLocaleString()}
                  </p>
                  <p className="text-sm text-slate-600">
                    {event.services
                      ?.map((service: any) => service.name)
                      .join(", ") || event.title}
                  </p>
                  <p className="text-sm text-slate-500">
                    {event.studentAddress || "Pickup address on file"} ·{" "}
                    {event.lessonStatus || "scheduled"}
                  </p>
                </div>
              ))}
          </ListSection>
        )}
        {tab === "payments" && (
          <ListSection title="Payments and balances">
            {data.payments.map((payment) => (
              <div key={payment.id} className="rounded-xl border p-4">
                <div className="flex justify-between">
                  <b>{new Date(payment.paymentDate).toLocaleDateString()}</b>
                  <b>${Number(payment.total || 0).toFixed(2)}</b>
                </div>
                <p className="text-sm text-slate-600">
                  {payment.status} · paid $
                  {Number(payment.paidAmount || 0).toFixed(2)} · due $
                  {Number(payment.amountDue || 0).toFixed(2)}
                </p>
              </div>
            ))}
          </ListSection>
        )}
        {tab === "availability" && (
          <AvailabilityPanel
            value={availability}
            onChange={setAvailability}
            onSave={saveAvailability}
            saving={saving}
          />
        )}
        {tab === "progress" && (
          <ListSection title="Driving progress">
            <p className="mb-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
              These are instructor estimates for practice only, not official
              DriveTest scores.
            </p>
            {data.evaluations.map((evaluation) => (
              <div key={evaluation.id} className="rounded-xl border p-4">
                <div className="flex justify-between">
                  <b>
                    {new Date(evaluation.date).toLocaleDateString()} ·{" "}
                    {evaluation.testType}
                  </b>
                  <b className="capitalize">{evaluation.verdict}</b>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {evaluation.minorCount || evaluation.minor_count || 0} minor ·{" "}
                  {evaluation.majorCount || evaluation.major_count || 0} major
                </p>
                {evaluation.notes && (
                  <p className="mt-3 text-sm">
                    Practise before booking: {evaluation.notes}
                  </p>
                )}
                <div className="mt-3 space-y-1 text-sm">
                  {(evaluation.items || []).map((item: any) => (
                    <p key={item.id}>
                      <b>{item.name}:</b> {item.status}
                      {item.tags?.length ? ` · ${item.tags.join(", ")}` : ""}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </ListSection>
        )}
      </div>
    </main>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-3 text-amber-600">{icon}</div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </section>
  );
}
function ListSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="text-xl font-black">{title}</h2>
      {children}
    </section>
  );
}
function ProfileForm({
  student,
  saving,
  onSubmit,
}: {
  student: Record<string, any>;
  saving: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-2xl bg-white p-5 shadow-sm"
    >
      <h2 className="text-xl font-black">Your profile</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="name" label="Name" defaultValue={student.name} />
        <Field
          name="email"
          label="Email"
          type="email"
          defaultValue={student.email}
        />
        <Field
          name="mobileNumber"
          label="Mobile"
          defaultValue={student.mobileNumber}
        />
        <Field
          name="birthdate"
          label="Birthdate"
          defaultValue={student.birthdate}
          type="date"
        />
        <Field
          name="licenseNumber"
          label="Licence number"
          defaultValue={student.licenseNumber}
        />
        <Field
          name="licenseExpiry"
          label="Licence expiry"
          defaultValue={student.licenseExpiry}
          type="date"
        />
      </div>
      <label className="space-y-2 text-sm font-semibold">
        Pickup address
        <AddressAutocompleteInput
          name="address"
          defaultValue={student.address || ""}
          placeholder="Start typing your pickup address"
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-semibold">
          Licence type
          <select
            name="licenseType"
            defaultValue={student.licenseType || "G2"}
            className="mt-2 h-10 w-full rounded-md border px-3 font-normal"
          >
            <option>G1</option>
            <option>G2</option>
            <option>G</option>
            <option>Other</option>
          </select>
        </label>
        <Field
          name="drivingGoal"
          label="Driving goal"
          defaultValue={student.drivingGoal}
        />
      </div>
      <label className="space-y-2 text-sm font-semibold">
        Notes
        <textarea
          name="studentSubmittedNotes"
          defaultValue={student.studentSubmittedNotes || ""}
          className="mt-2 min-h-28 w-full rounded-md border p-3 font-normal"
        />
      </label>
      <section className="rounded-xl border bg-slate-50 p-4">
        <h3 className="font-bold">Guardian and emergency contact</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field name="guardianContact.name" label="Guardian name" defaultValue={student.guardianContact?.name} />
          <Field name="guardianContact.phone" label="Guardian phone" defaultValue={student.guardianContact?.phone} />
          <Field name="guardianContact.relationship" label="Guardian relationship" defaultValue={student.guardianContact?.relationship} />
          <Field name="emergencyContact.name" label="Emergency contact name" defaultValue={student.emergencyContact?.name} />
          <Field name="emergencyContact.phone" label="Emergency contact phone" defaultValue={student.emergencyContact?.phone} />
          <Field name="emergencyContact.relationship" label="Emergency relationship" defaultValue={student.emergencyContact?.relationship} />
        </div>
      </section>
      <Button disabled={saving} className="w-full sm:w-auto">
        <Save className="mr-2 h-4 w-4" />
        {saving ? "Saving..." : "Save profile"}
      </Button>
    </form>
  );
}

function LicenseUpload({ student, user, onSaved }: { student: Record<string, any>; user: any; onSaved: () => Promise<void> }) {
  const { uploadLicenseFile, isUploading, uploadProgress } = useStorage();
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState("");
  const inputId = "student-portal-license";

  const upload = async (file: File) => {
    setScanning(true); setMessage("");
    try {
      const licenseImageUrl = await uploadLicenseFile(student.id, file);
      const details = await scanLicenseFile(await prepareLicenseFileForAi(file));
      const response = await fetch("/api/student-portal", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${await user.getIdToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          licenseImageUrl,
          licenseNumber: details.licenseNumber,
          licenseExpiry: details.licenseExpiry,
          address: details.address,
          birthdate: details.birthdate,
          ...(details.avatarUrl ? { avatarUrl: details.avatarUrl } : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save the licence.");
      await onSaved();
      setMessage("Licence saved and details updated. Please review them below.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not upload the licence.");
    } finally { setScanning(false); }
  };

  return <section className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-black">Licence record</h2><p className="mt-1 text-sm text-slate-600">Upload a clear photo of your licence. We save the image and read the licence details for your instructor to review.</p></div><FileImage className="h-6 w-6 shrink-0 text-amber-600" /></div><input id={inputId} type="file" accept="image/*,.heic,.heif,.pdf,application/pdf" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.currentTarget.value = ""; }} /><Button type="button" variant="outline" className="mt-4" disabled={scanning || isUploading} onClick={() => document.getElementById(inputId)?.click()}>{scanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileImage className="mr-2 h-4 w-4" />}{scanning ? "Reading licence..." : student.licenseImageUrl ? "Replace licence" : "Upload licence"}</Button>{isUploading && <p className="mt-2 text-xs text-slate-500">Preparing upload {Math.round(uploadProgress)}%</p>}{student.licenseImageUrl && <p className="mt-2 text-xs text-emerald-700">A licence image is saved on your record.</p>}{message && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{message}</p>}</section>;
}
function Field({
  name,
  label,
  defaultValue,
  type = "text",
}: {
  name: string;
  label: string;
  defaultValue?: string;
  type?: string;
}) {
  return (
    <label className="space-y-2 text-sm font-semibold">
      {label}
      <Input name={name} type={type} defaultValue={defaultValue || ""} />
    </label>
  );
}
function AvailabilityPanel({
  value,
  onChange,
  onSave,
  saving,
}: {
  value: { weeklyWindows: any[]; overrides: any[]; timezone?: string };
  onChange: (value: any) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const updateWindow = (
    targetIndex: number,
    key: "startTime" | "endTime",
    nextValue: string,
  ) =>
    onChange({
      ...value,
      weeklyWindows: value.weeklyWindows.map((window, index) =>
        index === targetIndex ? { ...window, [key]: nextValue } : window,
      ),
    });
  const removeWindow = (targetIndex: number) =>
    onChange({
      ...value,
      weeklyWindows: value.weeklyWindows.filter((_, index) => index !== targetIndex),
    });
  const addWindow = (weekday: number) =>
    onChange({
      ...value,
      weeklyWindows: [
        ...value.weeklyWindows,
        { weekday, startTime: "07:00", endTime: "20:00" },
      ],
    });
  return (
    <ListSection title="Your availability">
      <p className="text-sm text-slate-600">
        Set recurring hours from 7:00 AM to 8:00 PM. Your instructor sees
        these times when scheduling.
      </p>
      {weekdays.map((day, weekday) => (
        <div
          key={day}
          className="border-b py-3"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold">{day}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addWindow(weekday)}
            >
              Add time
            </Button>
          </div>
          <div className="mt-3 grid gap-2">
            {value.weeklyWindows
              .map((window, index) => ({ window, index }))
              .filter(({ window }) => window.weekday === weekday)
              .map(({ window, index }) => (
                <div
                  key={`${day}-${index}`}
                  className="grid grid-cols-[1fr_1fr_auto] items-end gap-2 rounded-xl bg-slate-50 p-3"
                >
                  <label className="space-y-1 text-xs font-semibold text-slate-600">
                    From
                    <Input
                      type="time"
                      min="07:00"
                      max="20:00"
                      step="900"
                      value={window.startTime || "07:00"}
                      onChange={(event) =>
                        updateWindow(index, "startTime", event.target.value)
                      }
                    />
                  </label>
                  <label className="space-y-1 text-xs font-semibold text-slate-600">
                    To
                    <Input
                      type="time"
                      min="07:00"
                      max="20:00"
                      step="900"
                      value={window.endTime || "20:00"}
                      onChange={(event) =>
                        updateWindow(index, "endTime", event.target.value)
                      }
                    />
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mb-0.5"
                    onClick={() => removeWindow(index)}
                    aria-label={`Remove ${day} availability`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            {value.weeklyWindows
              .filter((window) => window.weekday === weekday).length === 0 && (
              <p className="text-sm text-slate-500">Not available</p>
            )}
          </div>
        </div>
      ))}
      <Button type="button" onClick={onSave} disabled={saving} className="mt-4">
        <Clock3 className="mr-2 h-4 w-4" />
        {saving ? "Saving..." : "Save availability"}
      </Button>
    </ListSection>
  );
}
