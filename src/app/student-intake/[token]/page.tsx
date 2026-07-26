'use client';

import { use, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Logo } from '@/components/logo';

type FormInfo = { workspaceName: string; logoDataUrl?: string | null; expiresAt: string };
type Fields = { name: string; email: string; mobileNumber: string; address: string; birthdate: string; licenseNumber: string; licenseExpiry: string; licenseType: 'G' | 'G2'; comments: string };
const emptyFields: Fields = { name: '', email: '', mobileNumber: '', address: '', birthdate: '', licenseNumber: '', licenseExpiry: '', licenseType: 'G2', comments: '' };

export default function StudentIntakePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [info, setInfo] = useState<FormInfo | null>(null);
  const [fields, setFields] = useState<Fields>(emptyFields);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch(`/api/student-intake?token=${encodeURIComponent(token)}`)
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data; })
      .then(setInfo)
      .catch(error => setError(error.message || 'This form is unavailable.'))
      .finally(() => setLoading(false));
  }, [token]);

  const setField = (key: keyof Fields, value: string) => setFields(current => ({ ...current, [key]: value }));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setSubmitting(true);
    try {
      const response = await fetch('/api/student-intake', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, ...fields }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSubmitted(true);
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not submit the form.'); }
    finally { setSubmitting(false); }
  };

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-slate-50"><Loader2 className="h-8 w-8 animate-spin text-amber-500" /></main>;
  if (error && !info) return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5"><div className="w-full max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm"><h1 className="text-xl font-bold">Form unavailable</h1><p className="mt-3 text-sm text-slate-600">{error}</p></div></main>;
  if (submitted) return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5"><div className="w-full max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm"><CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" /><h1 className="mt-4 text-2xl font-bold">Information submitted</h1><p className="mt-3 text-slate-600">Thank you. {info?.workspaceName} has received your student information.</p></div></main>;

  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6"><div className="mx-auto w-full max-w-2xl"><div className="mb-6 flex justify-center"><Logo imageClassName="w-[180px]" /></div><section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-8"><div className="mb-7"><p className="text-sm font-semibold uppercase tracking-wide text-amber-700">Student registration</p><h1 className="mt-2 text-3xl font-black">Tell us about yourself</h1><p className="mt-2 text-slate-600">Complete this form for {info?.workspaceName}. Your information will be sent securely to the instructor.</p></div>{error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<form onSubmit={submit} className="space-y-5"><Field label="Full name" required><Input required value={fields.name} onChange={e => setField('name', e.target.value)} /></Field><div className="grid gap-5 sm:grid-cols-2"><Field label="Email"><Input type="email" value={fields.email} onChange={e => setField('email', e.target.value)} /></Field><Field label="Mobile number"><Input type="tel" value={fields.mobileNumber} onChange={e => setField('mobileNumber', e.target.value)} /></Field></div><Field label="Address"><Input value={fields.address} onChange={e => setField('address', e.target.value)} /></Field><div className="grid gap-5 sm:grid-cols-2"><Field label="Birthdate"><Input type="date" value={fields.birthdate} onChange={e => setField('birthdate', e.target.value)} /></Field><Field label="Licence type"><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={fields.licenseType} onChange={e => setField('licenseType', e.target.value)}><option value="G2">G2</option><option value="G">G</option></select></Field></div><div className="grid gap-5 sm:grid-cols-2"><Field label="Licence number"><Input value={fields.licenseNumber} onChange={e => setField('licenseNumber', e.target.value)} /></Field><Field label="Licence expiry"><Input type="date" value={fields.licenseExpiry} onChange={e => setField('licenseExpiry', e.target.value)} /></Field></div><Field label="Anything your instructor should know"><Textarea value={fields.comments} onChange={e => setField('comments', e.target.value)} className="min-h-28" /></Field><div className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />Your information is shared only with this InstructorOS workspace.</div><Button type="submit" disabled={submitting} className="h-12 w-full bg-amber-400 text-slate-950 hover:bg-amber-500">{submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{submitting ? 'Submitting...' : 'Submit information'}</Button></form></section></div></main>;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) { return <label className="block space-y-2"><span className="text-sm font-semibold">{label}{required ? ' *' : ''}</span>{children}</label>; }
