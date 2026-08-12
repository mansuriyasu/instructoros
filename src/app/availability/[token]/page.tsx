'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function AvailabilityPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10 text-slate-900">
      <section className="w-full max-w-md rounded-2xl border bg-white p-7 text-center shadow-sm">
        <p className="text-sm font-bold uppercase tracking-widest text-amber-700">Student portal</p>
        <h1 className="mt-2 text-2xl font-black">Availability is managed from your account</h1>
        <p className="mt-3 text-sm text-slate-600">Sign in to your verified Student Portal account to set weekly hours and date exceptions securely.</p>
        <Button asChild className="mt-6 h-12 w-full bg-amber-400 text-slate-950 hover:bg-amber-500">
          <Link href="/login?next=%2Fstudent-portal">Sign in to Student Portal</Link>
        </Button>
      </section>
    </main>
  );
}
