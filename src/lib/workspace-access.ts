import type { Tenant } from '@/lib/auth-config';

export type WorkspaceAccessSource =
  | 'suspended'
  | 'admin_grant'
  | 'paid_subscription'
  | 'trial'
  | 'active_legacy'
  | 'expired'
  | 'billing_locked';

export type WorkspaceAccess = {
  source: WorkspaceAccessSource;
  canRead: boolean;
  canWrite: boolean;
  isFreeAccess: boolean;
  isTrial: boolean;
  isPaid: boolean;
  endsAt: string | null;
};

function toMillis(value?: string | { toMillis?: () => number } | null) {
  if (!value) return null;
  if (typeof value !== 'string' && typeof value.toMillis === 'function') return value.toMillis();
  const time = new Date(String(value)).getTime();
  return Number.isFinite(time) ? time : null;
}

export function getWorkspaceAccess(tenant: Pick<Tenant, 'status' | 'subscriptionStatus' | 'billingLocked' | 'freeAccessUntil' | 'freeAccessUntilAt' | 'trialEndsAt' | 'stripeSubscriptionId'> | null | undefined, now = Date.now()): WorkspaceAccess {
  if (!tenant || tenant.status !== 'active') {
    return { source: 'suspended', canRead: false, canWrite: false, isFreeAccess: false, isTrial: false, isPaid: false, endsAt: null };
  }

  const freeAccessUntil = toMillis(tenant.freeAccessUntilAt) ?? toMillis(tenant.freeAccessUntil);
  if (freeAccessUntil !== null && freeAccessUntil > now) {
    return { source: 'admin_grant', canRead: true, canWrite: true, isFreeAccess: true, isTrial: false, isPaid: false, endsAt: tenant.freeAccessUntil || null };
  }

  const trialEndsAt = toMillis(tenant.trialEndsAt);
  if (tenant.subscriptionStatus === 'trialing' && (trialEndsAt === null || trialEndsAt > now)) {
    return { source: 'trial', canRead: true, canWrite: true, isFreeAccess: true, isTrial: true, isPaid: false, endsAt: tenant.trialEndsAt || null };
  }

  if (tenant.subscriptionStatus === 'active' && tenant.stripeSubscriptionId) {
    return { source: 'paid_subscription', canRead: true, canWrite: true, isFreeAccess: false, isTrial: false, isPaid: true, endsAt: null };
  }

  if (tenant.subscriptionStatus === 'active' && !tenant.billingLocked) {
    return { source: 'active_legacy', canRead: true, canWrite: true, isFreeAccess: true, isTrial: false, isPaid: false, endsAt: tenant.freeAccessUntil || null };
  }

  if (freeAccessUntil !== null && freeAccessUntil <= now) {
    return { source: 'expired', canRead: true, canWrite: false, isFreeAccess: false, isTrial: false, isPaid: false, endsAt: tenant.freeAccessUntil || null };
  }

  return { source: 'billing_locked', canRead: true, canWrite: false, isFreeAccess: false, isTrial: false, isPaid: false, endsAt: null };
}

export function hasAdminGrantedFreeAccess(tenant: Pick<Tenant, 'freeAccessUntil' | 'freeAccessUntilAt'> | null | undefined) {
  const until = toMillis(tenant?.freeAccessUntilAt) ?? toMillis(tenant?.freeAccessUntil);
  return until !== null && until > Date.now();
}
