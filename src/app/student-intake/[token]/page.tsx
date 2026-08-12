'use client';

import { use, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { GoogleAuthProvider, createUserWithEmailAndPassword, sendEmailVerification, signInWithPopup, signOut } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Logo } from '@/components/logo';
import { useAuth, useUser } from '@/firebase';

type FormInfo = { workspaceName: string; logoDataUrl?: string | null; expiresAt: string };
type Fields = {
  name: string; email: string; mobileNumber: string; address: string; birthdate: string;
  licenseNumber: string; licenseExpiry: string; licenseType: 'G1' | 'G2' | 'G' | 'Other';
  drivingGoal: string; experienceLevel: string; studentSubmittedNotes: string; comments: string;
};
const emptyFields: Fields = { name: '', email: '', mobileNumber: '', address: '', birthdate: '', licenseNumber: '', licenseExpiry: '', licenseType: 'G2', drivingGoal: 'beginner', experienceLevel: 'none', studentSubmittedNotes: '', comments: '' };

export default function StudentIntakePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const auth = useAuth();
  const { user } = useUser();
  const [info, setInfo] = useState<FormInfo | null>(null);
  const [fields, setFields] = useState<Fields>(emptyFields);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [submission, setSubmission] = useState<{ claimToken: string; possibleDuplicate: boolean } | null>(null);
  const [password, setPassword] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);

  useEffect(() => {
    fetch(`/api/student-intake?token=${encodeURIComponent(token)}`)
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data; })
      .then(setInfo).catch(error => setError(error.message || 'This form is unavailable.')).finally(() => setLoading(false));
  }, [token]);

  const setField = (key: keyof Fields, value: string) => setFields(current => ({ ...current, [key]: value }));
  const activate = async (accountUser: typeof user) => {
    if (!accountUser || !submission) return;
    const idToken = await accountUser.getIdToken(true);
    const response = await fetch('/api/student-portal/claim', { method: 'POST', headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ claimToken: submission.claimToken }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not activate your portal.');
    window.location.assign('/student-portal');
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setSubmitting(true);
    try {
      const response = await fetch('/api/student-intake', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, ...fields }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      sessionStorage.setItem('studentPortalClaimToken', data.claimToken);
      setSubmission({ claimToken: data.claimToken, possibleDuplicate: Boolean(data.possibleDuplicate) });
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not submit the form.'); }
    finally { setSubmitting(false); }
  };
  const createAccount = async () => {
    setError(''); setCreating(true);
    try {
      const registrationEmail = fields.email.trim().toLowerCase();
      // The owner or another user may already be signed in in this browser.
      // Never use that session to claim a student record for a different email.
      if (user && user.email?.toLowerCase() !== registrationEmail) {
        await signOut(auth);
      }
      const accountUser = user && user.email?.toLowerCase() === registrationEmail
        ? user
        : (await createUserWithEmailAndPassword(auth, registrationEmail, password)).user;
      if (!accountUser.emailVerified) {
        await sendEmailVerification(accountUser);
        setVerificationSent(true);
        return;
      }
      await activate(accountUser);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not create your student account.';
      setError(/auth\/email-already-in-use/i.test(message)
        ? 'An account already exists for this registration email. Use “I already have a verified account” and sign in with that email.'
        : message);
    }
    finally { setCreating(false); }
  };
  const continueWithGoogle = async () => {
    setError(''); setCreating(true);
    try { await activate((await signInWithPopup(auth, new GoogleAuthProvider())).user); }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not connect Google.'); }
    finally { setCreating(false); }
  };

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-slate-50"><Loader2 className="h-8 w-8 animate-spin text-amber-500" /></main>;
  if (error && !info) return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5"><div className="w-full max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm"><h1 className="text-xl font-bold">Form unavailable</h1><p className="mt-3 text-sm text-slate-600">{error}</p></div></main>;
  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6"><div className="mx-auto w-full max-w-2xl"><div className="mb-6 flex justify-center"><Logo imageClassName="w-[180px]" /></div><section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-8"><div className="mb-7"><p className="text-sm font-semibold uppercase tracking-wide text-amber-700">Student registration</p><h1 className="mt-2 text-3xl font-black">Tell us about yourself</h1><p className="mt-2 text-slate-600">Complete this secure form for {info?.workspaceName}. Email is required to create your student portal account.</p></div>{error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{!submission ? <form onSubmit={submit} className="space-y-5"><div className="grid gap-5 sm:grid-cols-2"><Field label="Full legal name" required><Input required value={fields.name} onChange={e => setField('name', e.target.value)} /></Field><Field label="Email address" required><Input required type="email" value={fields.email} onChange={e => setField('email', e.target.value)} /></Field><Field label="Mobile number" required><Input required type="tel" value={fields.mobileNumber} onChange={e => setField('mobileNumber', e.target.value)} /></Field><Field label="Birthdate"><Input type="date" value={fields.birthdate} onChange={e => setField('birthdate', e.target.value)} /></Field></div><Field label="Pickup address"><Input value={fields.address} onChange={e => setField('address', e.target.value)} /></Field><div className="grid gap-5 sm:grid-cols-2"><Field label="Licence type"><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={fields.licenseType} onChange={e => setField('licenseType', e.target.value)}><option>G1</option><option>G2</option><option>G</option><option>Other</option></select></Field><Field label="Licence number"><Input value={fields.licenseNumber} onChange={e => setField('licenseNumber', e.target.value)} /></Field><Field label="Licence expiry"><Input type="date" value={fields.licenseExpiry} onChange={e => setField('licenseExpiry', e.target.value)} /></Field><Field label="Driving goal"><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={fields.drivingGoal} onChange={e => setField('drivingGoal', e.target.value)}><option value="beginner">Beginner driving lessons</option><option value="g2-prep">G2 road-test preparation</option><option value="g-prep">G road-test preparation</option><option value="refresher">Refresher lessons</option><option value="other">Other</option></select></Field></div><Field label="Anything your instructor should know"><Textarea value={fields.studentSubmittedNotes} onChange={e => setField('studentSubmittedNotes', e.target.value)} className="min-h-28" /></Field><div className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />Your information is shared only with this InstructorOS workspace.</div><Button type="submit" disabled={submitting} className="h-12 w-full bg-amber-400 text-slate-950 hover:bg-amber-500">{submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{submitting ? 'Submitting...' : 'Continue to account setup'}</Button></form> : <div className="space-y-5"><div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900"><CheckCircle2 className="mb-2 h-6 w-6" />Your information is registered. {submission.possibleDuplicate ? 'The workspace will review a possible duplicate before confirming it.' : ''}</div><p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">Registration email: <strong>{fields.email}</strong></p>{verificationSent && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">We sent a verification email to {fields.email}. Verify it, then click the button below.</p>}<Field label="Create a password" required><Input type="password" minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" /></Field><Button disabled={creating || password.length < 6} onClick={createAccount} className="h-12 w-full bg-amber-400 text-slate-950 hover:bg-amber-500">{creating ? 'Creating account...' : verificationSent ? 'I verified my email - activate portal' : 'Create student account'}</Button><div className="flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" />OR<span className="h-px flex-1 bg-slate-200" /></div><Button variant="outline" disabled={creating} onClick={continueWithGoogle} className="h-12 w-full">Continue with Google</Button><Button variant="ghost" onClick={() => window.location.assign('/login?next=%2Fstudent-portal')} className="w-full">I already have a verified account</Button></div>}</section></div></main>;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) { return <label className="block space-y-2"><span className="text-sm font-semibold">{label}{required ? ' *' : ''}</span>{children}</label>; }
