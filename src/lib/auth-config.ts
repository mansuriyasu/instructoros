export const OWNER_EMAIL = 'yasin_mansuri@live.com';

export function isOwnerEmail(email?: string | null) {
  return (email || '').trim().toLowerCase() === OWNER_EMAIL;
}
