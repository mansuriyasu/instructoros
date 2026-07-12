import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  CreditCard,
  MessageSquareText,
  Rocket,
  ShieldCheck,
  TrendingUp,
  UserPlus,
  UserRound,
  UsersRound,
  Wallet,
} from 'lucide-react';
import { Logo } from '@/components/logo';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { PLAN_DETAILS, SCHOOL_EXTRA_SEAT_PRICE } from '@/lib/billing';

const navLinks = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
];

const features = [
  {
    icon: UsersRound,
    title: 'Student Management',
    text: 'Profiles, license details, notes, tags, and status for every lead and active student in one place.',
  },
  {
    icon: CalendarDays,
    title: 'Lesson Scheduling',
    text: 'Book lessons and road tests with instructor assignments, pickup details, and day/week/month views.',
  },
  {
    icon: CreditCard,
    title: 'Payments & Receipts',
    text: 'Track balances, record payments, and generate professional receipts with HST where needed.',
  },
  {
    icon: MessageSquareText,
    title: 'Student Communication',
    text: 'Send lesson reminders, payment messages, and exam updates straight from the student record.',
  },
  {
    icon: Building2,
    title: 'School & Team Workspace',
    text: 'Add instructors, assign students, and keep each workspace scoped to its own school.',
  },
  {
    icon: ShieldCheck,
    title: 'Admin Control & Reporting',
    text: 'Role-based access plus reports on payments, lesson activity, and school performance.',
  },
];

const steps = [
  { icon: UserPlus, title: 'Add Students', text: 'Import or add your students in seconds.' },
  { icon: CalendarDays, title: 'Schedule Lessons', text: 'Create lessons and assign instructors.' },
  { icon: Check, title: 'Conduct Lessons', text: 'Track progress and mark lessons complete.' },
  { icon: Wallet, title: 'Receive Payments', text: 'Get paid and keep receipts organized.' },
  { icon: TrendingUp, title: 'Grow Your Business', text: 'Use reports to manage and scale your school.' },
];

const instructorBenefits = ['1 instructor workspace', 'Students and lessons', 'Payments and receipts', 'First month free'];
const schoolBenefits = [
  `${PLAN_DETAILS.school.includedSeats} users included`,
  `$${SCHOOL_EXTRA_SEAT_PRICE} CAD/month per extra user`,
  'Team management',
  'Instructor assignments',
];

const faqs = [
  {
    q: 'What is InstructorOS?',
    a: 'InstructorOS is a workspace for driving instructors and driving schools to manage students, lessons, schedules, payments, and receipts in one place.',
  },
  {
    q: 'Is there a free trial?',
    a: 'Yes. Every new workspace starts with a 30-day free trial on either the Individual Instructor or School plan.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Billing is month to month in CAD with no long-term contract, so you can cancel whenever you need to.',
  },
  {
    q: 'Do you offer support?',
    a: 'Yes. Reach out from inside your workspace and we will help you with setup, billing, or anything else you run into.',
  },
  {
    q: 'Is my data secure?',
    a: 'Each school and instructor workspace is kept separate, with role-based access so instructors only see what they need to.',
  },
];

export default function MarketingHomePage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-white text-[#102033]">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" aria-label="InstructorOS home">
            <Logo imageClassName="w-[150px]" />
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-bold text-[#102033]/70 md:flex">
            {navLinks.map(link => (
              <a key={link.href} href={link.href} className="hover:text-[#102033]">
                {link.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden text-sm font-black text-[#102033]/70 hover:text-[#102033] sm:inline"
            >
              Log in
            </Link>
            <Link
              href="/login?next=/app"
              className="inline-flex h-10 items-center justify-center rounded-md bg-[#facc15] px-5 text-sm font-black text-[#102033] shadow-sm hover:bg-[#eab308]"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </header>

      <section className="bg-gradient-to-b from-[#f5f7f9] to-white py-16 sm:py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-[1fr_1fr]">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-black text-amber-700">
              <ShieldCheck className="h-4 w-4" />
              All-in-One Platform for Driving Schools
            </div>
            <h1 className="max-w-xl text-4xl font-black leading-[1.05] tracking-normal text-[#102033] sm:text-5xl lg:text-6xl">
              Run Your Driving School
              <br />
              <span className="text-[#f59e0b]">Smarter, Not Harder.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-8 text-slate-600">
              InstructorOS is the workspace built to help driving instructors and schools manage
              students, lessons, schedules, and payments — all in one place.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login?mode=solo&next=/app"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[#facc15] px-6 text-sm font-black text-[#102033] shadow-lg shadow-amber-900/10 hover:bg-[#eab308]"
              >
                Start as instructor
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login?mode=school&next=/app"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-6 text-sm font-black text-[#102033] hover:bg-slate-50"
              >
                Start as school
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-sm">
              <div>
                <p className="font-black text-[#102033]">First Month Free</p>
                <p className="text-slate-500">Then billed monthly</p>
              </div>
              <div>
                <p className="font-black text-[#102033]">Cancel Anytime</p>
                <p className="text-slate-500">No long-term contracts</p>
              </div>
              <div>
                <p className="font-black text-[#102033]">Canadian Built</p>
                <p className="text-slate-500">CAD billing, Ontario tax-ready</p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10">
              <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
              </div>
              <Image
                src="/assets/instructoros-coaching-session.png"
                alt="Driving instructor reviewing a lesson plan with a student"
                width={1672}
                height={941}
                priority
                className="aspect-[16/9] h-auto w-full object-cover"
              />
            </div>
            <div className="absolute -bottom-5 -left-4 max-w-[230px] rounded-md border border-slate-200 bg-white p-4 shadow-xl sm:-left-6">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-amber-600">Made for the road</p>
              <p className="mt-1 text-sm font-bold leading-5 text-[#102033]">Keep every lesson, student, and payment moving together.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white py-16 sm:py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 sm:px-8 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-xl shadow-slate-900/10">
            <Image
              src="/assets/instructoros-school-team.png"
              alt="Driving school team planning instructor schedules together"
              width={1672}
              height={941}
              className="aspect-[16/9] h-auto w-full object-cover"
            />
          </div>
          <div className="lg:pl-8">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-amber-600">For schools that grow</p>
            <h2 className="mt-3 max-w-xl text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
              One clear view of your whole teaching team.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">
              See instructor availability, assign students, coordinate road tests, and keep the office
              in sync without chasing spreadsheets or group messages.
            </p>
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              {[
                ['Shared schedules', 'Know who is teaching what and when.'],
                ['Assigned students', 'Give every instructor the right context.'],
                ['Clear payments', 'Keep balances and receipts close to the lesson.'],
                ['Room to grow', 'Add your team without losing the big picture.'],
              ].map(([title, text]) => (
                <div key={title} className="border-l-2 border-[#facc15] pl-4">
                  <p className="text-sm font-black text-[#102033]">{title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#102033] py-16 sm:py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 sm:px-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="text-white">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-[#facc15]">Your day, organized</p>
            <h2 className="mt-3 max-w-xl text-3xl font-black leading-tight sm:text-4xl">
              From the first booking to the final receipt.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-white/70">
              InstructorOS brings the practical details of a driving business into one workspace so
              you can spend less time on admin and more time teaching.
            </p>
            <Link
              href="/login?next=/app"
              className="mt-7 inline-flex h-11 items-center gap-2 rounded-md bg-[#facc15] px-5 text-sm font-black text-[#102033] hover:bg-[#eab308]"
            >
              See how it works
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="overflow-hidden rounded-xl border border-white/10 bg-white shadow-2xl">
            <Image
              src="/assets/instructoros-dashboard-preview.png"
              alt="InstructorOS workspace dashboard with scheduling and business activity"
              width={1400}
              height={900}
              className="h-auto w-full"
            />
          </div>
        </div>
      </section>

      <section id="features" className="border-y border-slate-200 bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-black tracking-normal text-slate-950 sm:text-4xl">
              Everything You Need to <span className="text-[#f59e0b]">Succeed</span>
            </h2>
            <p className="mt-3 text-base leading-7 text-slate-600">
              Built specifically for the way driving schools and instructors work.
            </p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex h-11 w-11 items-center justify-center rounded-md bg-amber-50 text-amber-600">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-black">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="bg-[#f5f7f9] py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <h2 className="text-center text-3xl font-black tracking-normal text-slate-950 sm:text-4xl">
            How InstructorOS Works
          </h2>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
            {steps.map(({ icon: Icon, title, text }, index) => (
              <div key={title} className="relative text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#facc15] text-sm font-black text-[#102033] shadow-sm">
                  {index + 1}
                </div>
                <div className="mx-auto mt-3 flex h-10 w-10 items-center justify-center rounded-md bg-white text-[#102033] shadow-sm ring-1 ring-slate-200">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-black">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="border-t border-slate-200 bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-black tracking-normal text-slate-950 sm:text-4xl">
              Choose the <span className="text-[#f59e0b]">Perfect Plan</span>
            </h2>
            <p className="mt-3 text-base leading-7 text-slate-600">
              Start with a 30-day free trial, then pay monthly in CAD.
            </p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            <article className="rounded-md border border-slate-200 bg-white p-7 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-black">{PLAN_DETAILS.instructor.label}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    For independent instructors managing their own students and schedule.
                  </p>
                </div>
                <UserRound className="h-7 w-7 text-slate-950" />
              </div>
              <div className="mt-7 flex items-end gap-2">
                <span className="text-5xl font-black">${PLAN_DETAILS.instructor.monthlyPrice}</span>
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
                className="mt-8 inline-flex h-12 w-full items-center justify-center rounded-md border border-slate-300 text-sm font-black text-[#102033] hover:bg-slate-50"
              >
                Start Free Trial
              </Link>
            </article>

            <article className="relative rounded-md border-2 border-[#facc15] bg-white p-7 shadow-xl shadow-amber-900/10">
              <span className="absolute -top-3 left-7 rounded-full bg-[#facc15] px-3 py-1 text-xs font-black text-[#102033]">
                Most Popular
              </span>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-black">{PLAN_DETAILS.school.label}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    For schools that need team access, instructor assignment, and shared operations.
                  </p>
                </div>
                <Building2 className="h-7 w-7 text-slate-950" />
              </div>
              <div className="mt-7 flex items-end gap-2">
                <span className="text-5xl font-black">${PLAN_DETAILS.school.monthlyPrice}</span>
                <span className="pb-2 text-sm font-bold text-slate-500">CAD/month after trial</span>
              </div>
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
                className="mt-8 inline-flex h-12 w-full items-center justify-center rounded-md bg-[#facc15] text-sm font-black text-[#102033] hover:bg-[#eab308]"
              >
                Start Free Trial
              </Link>
            </article>
          </div>

          <div id="faq" className="mx-auto mt-20 max-w-3xl">
            <h2 className="text-center text-3xl font-black tracking-normal text-slate-950 sm:text-4xl">
              Frequently Asked <span className="text-[#f59e0b]">Questions</span>
            </h2>
            <Accordion type="single" collapsible className="mt-8">
              {faqs.map(({ q, a }) => (
                <AccordionItem key={q} value={q}>
                  <AccordionTrigger className="text-left text-base font-black text-[#102033]">
                    {q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm leading-6 text-slate-600">{a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      <section className="bg-[#102033] py-14">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-5 text-center sm:flex-row sm:justify-between sm:text-left sm:px-8">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-[#facc15] text-[#102033]">
              <Rocket className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">Ready to Transform Your Driving School?</h2>
              <p className="mt-1 text-sm font-semibold text-white/65">
                Start your 30-day free trial today — no long-term contract.
              </p>
            </div>
          </div>
          <Link
            href="/login?next=/app"
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-md bg-[#facc15] px-6 text-sm font-black text-[#102033] hover:bg-[#eab308]"
          >
            Start Free Trial
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="bg-white px-5 py-10 text-[#102033] sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 border-t border-slate-200 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <Logo imageClassName="w-[140px]" />
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-bold text-slate-500">
            {navLinks.map(link => (
              <a key={link.href} href={link.href} className="hover:text-[#102033]">
                {link.label}
              </a>
            ))}
            <Link href="/login" className="hover:text-[#102033]">Log in</Link>
          </nav>
          <p className="text-sm font-semibold text-slate-500">© 2026 InstructorOS. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}
