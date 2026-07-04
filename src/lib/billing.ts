export type BillingPlan = 'instructor' | 'school';

export type BillingStatus =
  | 'not_started'
  | 'checkout_pending'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused';

export const PLAN_DETAILS: Record<BillingPlan, {
  label: string;
  monthlyPrice: number;
  includedSeats: number;
  trialDays: number;
  stripePriceEnv: string;
}> = {
  instructor: {
    label: 'Individual Instructor',
    monthlyPrice: 7,
    includedSeats: 1,
    trialDays: 30,
    stripePriceEnv: 'STRIPE_PRICE_INSTRUCTOR_MONTHLY',
  },
  school: {
    label: 'School',
    monthlyPrice: 50,
    includedSeats: 10,
    trialDays: 30,
    stripePriceEnv: 'STRIPE_PRICE_SCHOOL_MONTHLY',
  },
};

export const SCHOOL_EXTRA_SEAT_PRICE = 5;

export function isBillingPlan(value: unknown): value is BillingPlan {
  return value === 'instructor' || value === 'school';
}

export function getIncludedSeats(plan: BillingPlan) {
  return PLAN_DETAILS[plan].includedSeats;
}

export function getBillingLocked(status?: BillingStatus | string | null) {
  return Boolean(status && !['trialing', 'active'].includes(status));
}

export function getPlanForTenantType(type: 'school' | 'solo'): BillingPlan {
  return type === 'school' ? 'school' : 'instructor';
}

export function getExtraSeats(totalSeats: number) {
  return Math.max(0, Math.ceil(totalSeats) - PLAN_DETAILS.school.includedSeats);
}
