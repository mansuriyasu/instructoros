import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  CreditCard,
  GraduationCap,
  MessageSquareText,
  ShieldCheck,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { Logo } from '@/components/logo';

const features = [
  {
    icon: UsersRound,
    title: 'Student pipeline',
    text: 'Keep every lead, active student, license detail, note, balance, and lesson history organized in one place.',
  },
  {
    icon: CalendarDays,
    title: 'Scheduling',
    text: 'Plan lessons, road tests, instructor assignments, and daily work without jumping between calendars and spreadsheets.',
  },
  {
    icon: CreditCard,
    title: 'Payments and receipts',
    text: 'Record lesson payments, track balances, create receipts, and see what is paid or still outstanding.',
  },
  {
    icon: MessageSquareText,
    title: 'Communication',
    text: 'Send reminders, payment messages, birthday notes, and school updates with a cleaner record of what happened.',
  },
];

const audiences = [
  {
    icon: UserRound,
    title: 'Individual instructors',
    text: 'Run your own student list, bookings, payments, services, and records from one simple workspace.',
  },
  {
    icon: Building2,
    title: 'Driving schools',
    text: 'Manage instructors, assign students, see team activity, and keep operations consistent across the school.',
  },
  {
    icon: GraduationCap,
    title: 'School instructors',
    text: 'See assigned students and lessons clearly, without getting access to private owner-only business tools.',
  },
];

const schoolBenefits = ['10 users included', '$5 CAD/month per extra user', 'Team management', 'Instructor assignments'];
const instructorBenefits = ['One instructor workspace', 'Students and lessons', 'Payments and receipts', 'First month free'];

const detailedFeatures = [
  {
    icon: UsersRound,
    title: 'Student and lead management',
    summary:
      'Keep every learner organized from first contact to road test, with the details instructors need before each lesson.',
    items: [
      'Student profiles with phone, email, address, license details, notes, tags, and status',
      'Track leads, active students, completed students, and archived records without losing history',
      'Assign students to instructors so school owners can see who is responsible for each learner',
      'Store lesson history, balances, payment notes, and important updates in one profile',
    ],
  },
  {
    icon: CalendarDays,
    title: 'Lessons, schedules, and road tests',
    summary:
      'Plan the teaching day with a calendar built around driving school work, not a generic appointment tool.',
    items: [
      'Book lessons, choose instructors, set pickup/drop-off details, and update lesson status',
      'Use day, week, month, and list views to understand what is happening across the school',
      'Schedule road tests with pickup time, lesson time, arrival time, test time, and return time',
      'Choose whether to send a schedule message when an exam is booked',
    ],
  },
  {
    icon: CreditCard,
    title: 'Payments, receipts, and tax',
    summary:
      'Record payments clearly and give students professional receipts that match your school information.',
    items: [
      'Track payments, advances, remaining balances, discounts, services, and payment history',
      'Generate receipts with school name, logo, contact details, receipt notes, and HST where needed',
      'Use Ontario-ready HST defaults while keeping tax labels and rates configurable per workspace',
      'Review unpaid balances quickly so missed payments do not hide in message threads',
    ],
  },
  {
    icon: Building2,
    title: 'School and team workspace',
    summary:
      'Give a school one shared operating system while keeping access separated by role.',
    items: [
      'Support school owners, main admins, instructors, and individual instructor accounts',
      'Manage school profile details, branding, billing information, and subscription plan',
      'Add instructors, assign work, and keep each instructor focused on their own students and lessons',
      'Separate school workspaces so each school manages its own students, payments, and settings',
    ],
  },
  {
    icon: MessageSquareText,
    title: 'Student communication',
    summary:
      'Send clearer messages for lessons, payments, exams, birthdays, and updates without rebuilding the same text.',
    items: [
      'Prepare lesson reminders, payment messages, road test details, and student updates',
      'Open ready-to-send WhatsApp messages from student, schedule, and payment workflows',
      'Keep communication connected to the student record so the school has context later',
      'Avoid accidental exam messages with an explicit send-message checkbox on scheduling',
    ],
  },
  {
    icon: ShieldCheck,
    title: 'Admin control and reporting',
    summary:
      'Help owners understand the business while protecting operational data for each workspace.',
    items: [
      'Main admin area for users, workspaces, plans, schools, and operational oversight',
      'Reports for payments, expenses, lesson activity, service sales, and school performance',
      'Backup, import, and export tools for moving records safely when the business grows',
      'Role-based access so instructors do not see owner-only settings or private billing tools',
    ],
  },
];

export default function MarketingHomePage() {
  return (
    <main className="min-h-screen bg-[#f8fafc] text-[#111827]">
      <section className="relative overflow-hidden border-b border-slate-200 bg-[linear-gradient(135deg,#fffaf0_0%,#f8fafc_38%,#eef6ff_100%)]">
        <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/" aria-label="InstructorOS home">
            <Logo imageClassName="w-[168px]" />
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-600 md:flex">
            <a href="#who">Who it helps</a>
            <a href="#features">Features</a>
            <a href="#modules">Modules</a>
            <a href="#pricing">Pricing</a>
          </nav>
          <Link
            href="/login"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            Login
          </Link>
        </header>

        <div className="mx-auto grid min-h-[calc(100vh-82px)] w-full max-w-7xl items-center gap-10 px-5 pb-14 pt-6 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:pb-16">
          <div className="max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-white/80 px-3 py-2 text-sm font-bold text-amber-800 shadow-sm">
              <ShieldCheck className="h-4 w-4" />
              For instructors, made by an instructor
            </div>
            <h1 className="text-5xl font-black leading-[1.02] tracking-normal text-slate-950 sm:text-6xl lg:text-7xl">
              InstructorOS
            </h1>
            <p className="mt-6 max-w-xl text-lg font-medium leading-8 text-slate-700 sm:text-xl">
              Built from real instructor workflows: one place for driving instructors, schools, and teams to manage students, lessons, payments, schedules, and daily work.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login?mode=solo&next=/app"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#111827] px-6 text-sm font-black text-white shadow-lg shadow-slate-900/15 hover:bg-slate-800"
              >
                Start as instructor
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login?mode=school&next=/app"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-6 text-sm font-black text-slate-950 shadow-sm hover:bg-slate-50"
              >
                Start as school
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <p className="mt-5 text-sm font-semibold text-slate-500">
              No charge for the first month. Plans continue monthly after the trial.
            </p>
          </div>

          <div className="relative">
            <Image
              src="/assets/instructoros-dashboard-preview.png"
              alt="InstructorOS dashboard preview showing lessons, payments, instructors, and student pipeline"
              width={1400}
              height={900}
              priority
              className="w-full rounded-xl border border-white/80 shadow-2xl shadow-slate-900/20"
            />
          </div>
        </div>
      </section>

      <section id="who" className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-amber-600">Who can use it</p>
            <h2 className="mt-3 text-3xl font-black tracking-normal text-slate-950 sm:text-4xl">
              For instructors, made by an instructor.
            </h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {audiences.map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-lg border border-slate-200 bg-slate-50 p-6">
                <Icon className="h-7 w-7 text-slate-950" />
                <h3 className="mt-5 text-xl font-black">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="border-y border-slate-200 bg-[#f8fafc] py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.16em] text-sky-700">How it helps</p>
              <h2 className="mt-3 text-3xl font-black tracking-normal text-slate-950 sm:text-4xl">
                Less admin work, clearer school operations.
              </h2>
              <p className="mt-5 text-base leading-7 text-slate-600">
                InstructorOS replaces scattered notebooks, spreadsheets, payment notes, and chat threads with one workspace that keeps every student and lesson connected.
              </p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              {features.map(({ icon: Icon, title, text }) => (
                <article key={title} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                  <Icon className="h-6 w-6 text-sky-700" />
                  <h3 className="mt-4 text-lg font-black">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="modules" className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-end">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.16em] text-amber-600">App features</p>
              <h2 className="mt-3 text-3xl font-black tracking-normal text-slate-950 sm:text-4xl">
                Everything a driving instructor or school needs to run the day.
              </h2>
            </div>
            <p className="max-w-3xl text-base leading-7 text-slate-600 lg:justify-self-end">
              InstructorOS is built for the full driving-school workflow: finding students, booking lessons, preparing
              for road tests, collecting payments, keeping receipts professional, and giving schools a clear view of
              instructor activity.
            </p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {detailedFeatures.map(({ icon: Icon, title, summary, items }) => (
              <article key={title} className="rounded-lg border border-slate-200 bg-slate-50 p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-slate-950 shadow-sm">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-xl font-black text-slate-950">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{summary}</p>
                <ul className="mt-5 space-y-3 text-sm font-semibold leading-6 text-slate-700">
                  {items.map(item => (
                    <li key={item} className="flex gap-3">
                      <Check className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-emerald-700">Pricing</p>
            <h2 className="mt-3 text-3xl font-black tracking-normal text-slate-950 sm:text-4xl">
              Start free, then pay monthly.
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              Every new workspace gets the first month free. After that, billing continues month to month in CAD.
            </p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <article className="rounded-lg border border-slate-200 bg-slate-50 p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-black">Individual Instructor</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">For independent instructors managing their own students and schedule.</p>
                </div>
                <UserRound className="h-7 w-7 text-slate-950" />
              </div>
              <div className="mt-7 flex items-end gap-2">
                <span className="text-5xl font-black">$7</span>
                <span className="pb-2 text-sm font-bold text-slate-500">CAD/month after trial</span>
              </div>
              <ul className="mt-7 space-y-3 text-sm font-semibold text-slate-700">
                {instructorBenefits.map(item => (
                  <li key={item} className="flex items-center gap-3">
                    <Check className="h-4 w-4 text-emerald-600" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/login?mode=solo&next=/app"
                className="mt-8 inline-flex h-12 w-full items-center justify-center rounded-lg bg-[#111827] text-sm font-black text-white hover:bg-slate-800"
              >
                Start free month
              </Link>
            </article>

            <article className="rounded-lg border-2 border-slate-950 bg-white p-7 shadow-xl shadow-slate-900/10">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-black">School</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">For schools that need team access, instructor assignment, and shared operations.</p>
                </div>
                <Building2 className="h-7 w-7 text-slate-950" />
              </div>
              <div className="mt-7 flex items-end gap-2">
                <span className="text-5xl font-black">$50</span>
                <span className="pb-2 text-sm font-bold text-slate-500">CAD/month after trial</span>
              </div>
              <p className="mt-2 text-sm font-bold text-slate-600">Includes 10 users, then $5 CAD/month per extra user.</p>
              <ul className="mt-7 space-y-3 text-sm font-semibold text-slate-700">
                {schoolBenefits.map(item => (
                  <li key={item} className="flex items-center gap-3">
                    <Check className="h-4 w-4 text-emerald-600" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/login?mode=school&next=/app"
                className="mt-8 inline-flex h-12 w-full items-center justify-center rounded-lg bg-[#facc15] text-sm font-black text-slate-950 hover:bg-[#eab308]"
              >
                Start school trial
              </Link>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}
