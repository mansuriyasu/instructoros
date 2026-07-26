import type { AppRole, TenantMember } from './auth-config';

export function canViewExpenses(role?: AppRole | null, member?: Pick<TenantMember, 'expensesAccess'> | null) {
  return role === 'mainAdmin' || role === 'schoolAdmin' || role === 'soloInstructor' || member?.expensesAccess === true;
}

export function canViewUtility(role?: AppRole | null, member?: Pick<TenantMember, 'utilityAccess'> | null) {
  return role === 'mainAdmin' || role === 'schoolAdmin' || role === 'soloInstructor' || member?.utilityAccess === true;
}

export function canEditSharedFinance(role?: AppRole | null) {
  return role === 'mainAdmin' || role === 'schoolAdmin' || role === 'soloInstructor';
}
