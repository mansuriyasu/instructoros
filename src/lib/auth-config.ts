import type { BillingPlan, BillingStatus } from './billing';

export const MAIN_ADMIN_EMAIL = 'yasin_mansuri@live.com';

export type TenantType = 'school' | 'solo';
export type TenantStatus = 'active' | 'suspended';
export type AppRole = 'mainAdmin' | 'schoolAdmin' | 'schoolInstructor' | 'soloInstructor';

export type AppUserProfile = {
  uid: string;
  email: string;
  displayName?: string;
  activeTenantId?: string;
  tenantIds?: string[];
  createdAt: string;
  updatedAt: string;
};

export type Tenant = {
  id: string;
  name: string;
  type: TenantType;
  status: TenantStatus;
  plan?: BillingPlan;
  seatLimit?: number;
  extraSeats?: number;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: BillingStatus;
  trialEndsAt?: string | null;
  currentPeriodEnd?: string | null;
  billingLocked?: boolean;
  freeAccessUntil?: string | null;
  freeAccessReason?: string;
  promoCodeApplied?: string;
  promoPercentOff?: number;
  receiptBusinessName?: string;
  receiptLogoDataUrl?: string;
  receiptPhone?: string;
  receiptEmail?: string;
  receiptWebsite?: string;
  receiptAddress?: string;
  messageSenderName?: string;
  hstNumber?: string;
  taxLabel?: string;
  taxRate?: number;
  taxEnabledByDefault?: boolean;
  profileSetupCompletedAt?: string;
  ownerUid: string;
  ownerEmail: string;
  createdAt: string;
  updatedAt: string;
};

export type TenantMember = {
  id: string;
  uid: string;
  email: string;
  displayName?: string;
  role: Exclude<AppRole, 'mainAdmin'>;
  status: 'active' | 'disabled';
  tenantId: string;
  inviteId?: string;
  createdAt: string;
  updatedAt: string;
};

export type TenantInvite = {
  id: string;
  email: string;
  role: 'schoolInstructor';
  status: 'pending' | 'accepted' | 'revoked';
  tenantId: string;
  createdByUid: string;
  createdAt: string;
  updatedAt?: string;
  acceptedAt?: string;
  acceptedByUid?: string;
};

export function normalizeEmail(email?: string | null) {
  return (email || '').trim().toLowerCase();
}

export function isMainAdminEmail(email?: string | null) {
  return normalizeEmail(email) === MAIN_ADMIN_EMAIL;
}

export function isOwnerEmail(email?: string | null) {
  return isMainAdminEmail(email);
}

export function roleLabel(role?: AppRole | null) {
  switch (role) {
    case 'mainAdmin':
      return 'Main Admin';
    case 'schoolAdmin':
      return 'School Admin';
    case 'schoolInstructor':
      return 'Instructor';
    case 'soloInstructor':
      return 'Individual Instructor';
    default:
      return 'Instructor';
  }
}

export function canManageTenant(role?: AppRole | null) {
  return role === 'mainAdmin' || role === 'schoolAdmin';
}

export function canUseFullWorkspace(role?: AppRole | null) {
  return role === 'mainAdmin' || role === 'schoolAdmin' || role === 'schoolInstructor';
}
