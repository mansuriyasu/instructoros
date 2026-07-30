import Link from 'next/link';

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#f5f7f9] px-5 py-12 text-[#102033] sm:px-8">
      <article className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-7 shadow-sm sm:p-12">
        <Link href="/" className="text-sm font-bold text-amber-700 hover:text-amber-800">
          InstructorOS
        </Link>
        <h1 className="mt-8 text-3xl font-black sm:text-4xl">Terms of Service</h1>
        <p className="mt-3 text-sm text-slate-500">Last updated: July 30, 2026</p>
        <div className="mt-8 space-y-7 text-[15px] leading-7 text-slate-700">
          <section>
            <h2 className="text-lg font-black text-[#102033]">Using InstructorOS</h2>
            <p className="mt-2">InstructorOS is a business management service for driving instructors and driving schools. You are responsible for the accuracy of information you enter and for using the service in compliance with applicable law.</p>
          </section>
          <section>
            <h2 className="text-lg font-black text-[#102033]">Your account</h2>
            <p className="mt-2">Keep your login information secure and give workspace access only to people who should have it. Workspace owners are responsible for managing members, permissions, and customer records.</p>
          </section>
          <section>
            <h2 className="text-lg font-black text-[#102033]">Payments and subscriptions</h2>
            <p className="mt-2">Paid plans are billed according to the plan shown at checkout. Trial access and administrator-granted access may have separate end dates. You can manage or cancel a subscription from the Billing area.</p>
          </section>
          <section>
            <h2 className="text-lg font-black text-[#102033]">Service limits</h2>
            <p className="mt-2">Do not use InstructorOS to upload unlawful, abusive, malicious, or unauthorized content, or to interfere with the service. We may limit or suspend access when necessary to protect users, data, or the service.</p>
          </section>
          <section>
            <h2 className="text-lg font-black text-[#102033]">Contact</h2>
            <p className="mt-2">Questions about these terms can be sent to sparkondrive@gmail.com.</p>
          </section>
        </div>
      </article>
    </main>
  );
}
