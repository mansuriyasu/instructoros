'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  Clock3,
  CreditCard,
  History,
  ReceiptText,
  Settings,
  Upload,
  Users,
  Wallet,
} from 'lucide-react';
import type { ElementType } from 'react';
import { useMemo } from 'react';
import { format } from 'date-fns';
import { NotificationsSheet } from '@/components/layout/notifications-sheet';
import { useEvents } from '@/hooks/use-events';
import { usePayments } from '@/hooks/use-payments';
import { useStudents } from '@/hooks/use-students';
import { useSession, useUser } from '@/firebase';
import { formatCurrency } from '@/lib/utils';
import { getCollectedAmount, getOutstandingAmount } from '@/lib/payment-utils';

function isToday(dateString: string | Date) {
  const date = new Date(dateString);
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

export function HomeMenu() {
  const { user } = useUser();
  const { payments } = usePayments();
  const { events } = useEvents();
  const { students } = useStudents();
  const { tenant, canManageTenant } = useSession();

  const firstName = user?.displayName?.split(' ')[0] || 'Instructor';

  const todaysRevenue = useMemo(() => {
    if (!payments) return 0;
    return payments
      .filter(payment => isToday(payment.paymentDate))
      .reduce((sum, payment) => sum + getCollectedAmount(payment), 0);
  }, [payments]);

  const todayLessons = useMemo(() => {
    if (!events) return [];
    return events
      .filter(event => isToday(event.start))
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }, [events]);

  const nextLesson = useMemo(() => {
    const now = Date.now();
    return (events || [])
      .filter(event => new Date(event.start).getTime() >= now)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())[0];
  }, [events]);

  const studentCounts = useMemo(() => {
    const active = (students || []).filter(student => student.status === 'active').length;
    const booked = (students || []).filter(student => student.status === 'booked').length;
    return { active, booked, current: active + booked };
  }, [students]);

  const unpaidPayments = useMemo(() => {
    if (!payments) return 0;
    return payments.reduce((sum, payment) => sum + getOutstandingAmount(payment), 0);
  }, [payments]);

  const showTrialPaymentPrompt = canManageTenant && tenant?.subscriptionStatus === 'trialing' && !tenant.stripeSubscriptionId;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 pb-24">
      <section className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              InstructorOS
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Good morning, {firstName}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your day, students, payments, and alerts in one place.
            </p>
          </div>
          <Link
            href="/app/schedule"
            className="inline-flex h-10 items-center justify-center rounded-full bg-[#0D1B2A] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#132840]"
          >
            Open schedule
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          icon={CalendarDays}
          label="Today"
          value={`${todayLessons.length}`}
          detail={`${todayLessons.length === 1 ? 'lesson' : 'lessons'} booked`}
          tone="blue"
        />
        <MetricCard
          icon={Users}
          label="Students"
          value={`${studentCounts.current}`}
          detail={`${studentCounts.active} active, ${studentCounts.booked} booked`}
          tone="gold"
        />
        <MetricCard
          icon={Wallet}
          label="Paid today"
          value={formatCurrency(todaysRevenue).replace('.00', '')}
          detail="Collected payments"
          tone="green"
        />
        <MetricCard
          icon={ReceiptText}
          label="Due"
          value={formatCurrency(unpaidPayments).replace('.00', '')}
          detail="Unpaid balance"
          tone="red"
        />
      </section>

      {showTrialPaymentPrompt && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-amber-950">Free trial is active</h2>
              <p className="mt-1 text-sm text-amber-900">
                Add payment details before the trial ends so service continues without interruption.
              </p>
            </div>
            <Link
              href="/app/billing"
              className="inline-flex h-10 items-center justify-center rounded-full bg-[#0D1B2A] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#132840]"
            >
              Manage billing
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </section>
      )}

      <section className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold">Next lesson</h2>
              <p className="text-xs text-muted-foreground">What needs attention first.</p>
            </div>
            <Link href="/app/schedule" className="text-xs font-semibold text-primary">
              Schedule
            </Link>
          </div>

          {nextLesson ? (
            <Link
              href={`/app/schedule?eventId=${nextLesson.id}`}
              className="flex items-center gap-3 rounded-xl bg-muted/40 p-3 transition-colors hover:bg-muted"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#EAF3FF] text-[#2563EB]">
                <Clock3 className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{nextLesson.studentName || nextLesson.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {format(new Date(nextLesson.start), 'EEE, MMM d')} at {format(new Date(nextLesson.start), 'h:mm a')}
                </p>
                {nextLesson.studentAddress && (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{nextLesson.studentAddress}</p>
                )}
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              No upcoming lesson found.
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold">Today list</h2>
              <p className="text-xs text-muted-foreground">Quick count of your current day.</p>
            </div>
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
              {todayLessons.length}
            </span>
          </div>
          <div className="space-y-2">
            {todayLessons.slice(0, 3).map(lesson => (
              <Link
                key={lesson.id}
                href={`/app/schedule?eventId=${lesson.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-2 text-sm hover:bg-muted/50"
              >
                <span className="min-w-0 truncate font-medium">{lesson.studentName || lesson.title}</span>
                <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                  {format(new Date(lesson.start), 'h:mm a')}
                </span>
              </Link>
            ))}
            {todayLessons.length === 0 && (
              <p className="rounded-xl border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                Nothing booked for today.
              </p>
            )}
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-base font-bold">Menu</h2>
          <p className="text-xs text-muted-foreground">Fast actions for daily work.</p>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          <ActionTile href="/app/students" icon={Users} label="Students" tone="gold" />
          <ActionTile href="/app/schedule" icon={CalendarDays} label="Schedule" tone="blue" />
          <ActionTile href="/app/payments" icon={Wallet} label="POS" tone="green" />
          <ActionTile href="/app/payments/history" icon={History} label="History" tone="purple" />
          <ActionTile href="/app/services" icon={BriefcaseBusiness} label="Services" tone="teal" />
          {canManageTenant && <ActionTile href="/app/billing" icon={CreditCard} label="Billing" tone="navy" />}
          <ActionTile href="/app/settings?tab=import-export" icon={Upload} label="Import" tone="blue" />
          <NotificationsTile />
          <ActionTile href="/app/settings" icon={Settings} label="Settings" tone="slate" />
        </div>
      </section>
    </div>
  );
}

type Tone = 'gold' | 'blue' | 'green' | 'red' | 'purple' | 'navy' | 'teal' | 'slate';

const toneClasses: Record<Tone, { card: string; icon: string }> = {
  gold: { card: 'bg-[#FFF8E7] border-[#FFE2A8]', icon: 'bg-[#FDBA21] text-white' },
  blue: { card: 'bg-[#EEF6FF] border-[#CFE6FF]', icon: 'bg-[#2563EB] text-white' },
  green: { card: 'bg-[#EDFBF2] border-[#BFECCF]', icon: 'bg-[#16A34A] text-white' },
  red: { card: 'bg-[#FFF1F2] border-[#FFD1D7]', icon: 'bg-[#E11D48] text-white' },
  purple: { card: 'bg-[#F6F0FF] border-[#DED0FF]', icon: 'bg-[#7C3AED] text-white' },
  navy: { card: 'bg-[#EEF2F6] border-[#D7DEE8]', icon: 'bg-[#0D1B2A] text-white' },
  teal: { card: 'bg-[#EAFBFA] border-[#BCEDEA]', icon: 'bg-[#0891B2] text-white' },
  slate: { card: 'bg-[#F8FAFC] border-[#E2E8F0]', icon: 'bg-[#64748B] text-white' },
};

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: ElementType;
  label: string;
  value: string;
  detail: string;
  tone: Tone;
}) {
  const classes = toneClasses[tone];
  return (
    <div className={`rounded-2xl border p-3 shadow-sm ${classes.card}`}>
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${classes.icon}`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-2xl font-black tracking-tight text-foreground">{value}</p>
      <p className="mt-1 truncate text-[11px] text-muted-foreground">{detail}</p>
    </div>
  );
}

function ActionTile({ href, icon: Icon, label, tone }: { href: string; icon: ElementType; label: string; tone: Tone }) {
  const classes = toneClasses[tone];
  return (
    <Link
      href={href}
      className={`aspect-square rounded-2xl border p-3 shadow-sm transition-transform active:scale-[0.98] ${classes.card}`}
    >
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${classes.icon}`}>
          <Icon className="h-5 w-5" />
        </div>
        <span className="text-xs font-bold leading-tight text-foreground">{label}</span>
      </div>
    </Link>
  );
}

function NotificationsTile() {
  return <NotificationsSheet triggerType="tile" />;
}
