import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#f5f7f9] px-5 py-12 text-[#102033] sm:px-8">
      <article className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-7 shadow-sm sm:p-12">
        <Link href="/" className="text-sm font-bold text-amber-700 hover:text-amber-800">
          InstructorOS
        </Link>
        <h1 className="mt-8 text-3xl font-black sm:text-4xl">Privacy Policy</h1>
        <p className="mt-3 text-sm text-slate-500">Last updated: September 16, 2026</p>
        <div className="mt-8 space-y-7 text-[15px] leading-7 text-slate-700">
          <section>
            <h2 className="text-lg font-black text-[#102033]">Information we use</h2>
            <p className="mt-2">InstructorOS stores the information you provide to manage your driving instruction business, including account details, student records, schedules, payments, and workspace settings.</p>
          </section>
          <section>
            <h2 className="text-lg font-black text-[#102033]">How we use it</h2>
            <p className="mt-2">We use this information to provide the InstructorOS service, secure accounts, process subscriptions, generate records, and support features you choose to connect, such as Google Calendar.</p>
          </section>
          <section>
            <h2 className="text-lg font-black text-[#102033]">Google data</h2>
            <p className="mt-2">When you connect Google Calendar, InstructorOS uses the permission you grant to read and create calendar events for your workspace. We do not sell Google data or use it for advertising. You can disconnect Google Calendar from Settings at any time.</p>
          </section>
          <section>
            <h2 className="text-lg font-black text-[#102033]">Sharing and retention</h2>
            <p className="mt-2">Workspace information is shared only with members you authorize and service providers needed to operate the app, such as hosting, authentication, payments, and storage providers. You can export and delete your workspace data from the app where those controls are available.</p>
          </section>
          <section>
            <h2 className="text-lg font-black text-[#102033]">Student maps</h2>
            <p className="mt-2">When staff open Student Map, student addresses are sent to Google to locate them. Student names and phone numbers are used within InstructorOS and are not included in address lookup requests. Coordinates are temporarily cached in browser memory for up to one hour. Google Maps is subject to the <a className="underline" href="https://policies.google.com/privacy">Google Privacy Policy</a>.</p>
          </section>
          <section>
            <h2 className="text-lg font-black text-[#102033]">Offline access</h2>
            <p className="mt-2">If you enable offline access on a trusted device, a limited copy of student contact details and lessons, plus drafts you create, is stored on that device. Drafts upload when you return to the signed-in app with internet access. Logout clears this local data after warning about unsynced entries. Clearing browser storage may remove unsynced drafts.</p>
          </section>
          <section>
            <h2 className="text-lg font-black text-[#102033]">Contact</h2>
            <p className="mt-2">For privacy questions, contact sparkondrive@gmail.com.</p>
          </section>
        </div>
      </article>
    </main>
  );
}
