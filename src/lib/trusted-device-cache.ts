'use client';

import {
  clearIndexedDbPersistence,
  terminate,
  type Firestore,
} from 'firebase/firestore';

const CACHE_ENABLED_KEY = 'instructoros-trusted-cache-enabled-v1';
const CACHE_OWNER_KEY = 'instructoros-trusted-cache-owner-v1';
const CACHE_SCOPE_KEY = 'instructoros-trusted-cache-scope-v1';
const CACHE_ENABLED_AT_KEY = 'instructoros-trusted-cache-enabled-at-v1';
const CACHE_DECISION_PREFIX = 'instructoros-trusted-cache-choice-v1:';

export type TrustedDeviceChoice = 'enabled' | 'declined';

function storageAvailable() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}
export function isTrustedDeviceCacheEnabled() {
  if (!storageAvailable()) return false;
  try {
    return localStorage.getItem(CACHE_ENABLED_KEY) === '1';
  } catch {
    return false;
  }
}

export function getTrustedDeviceCacheOwner() {
  if (!storageAvailable()) return null;
  try {
    return localStorage.getItem(CACHE_OWNER_KEY);
  } catch {
    return null;
  }
}

export function getTrustedDeviceCacheInfo() {
  if (!storageAvailable()) return { enabled: false, ownerUid: null, scope: null, enabledAt: null };
  try {
    return {
      enabled: localStorage.getItem(CACHE_ENABLED_KEY) === '1',
      ownerUid: localStorage.getItem(CACHE_OWNER_KEY),
      scope: localStorage.getItem(CACHE_SCOPE_KEY),
      enabledAt: localStorage.getItem(CACHE_ENABLED_AT_KEY),
    };
  } catch {
    return { enabled: false, ownerUid: null, scope: null, enabledAt: null };
  }
}

export function getTrustedDeviceChoice(uid: string): TrustedDeviceChoice | null {
  if (!storageAvailable()) return null;
  try {
    const choice = localStorage.getItem(`${CACHE_DECISION_PREFIX}${uid}`);
    return choice === 'enabled' || choice === 'declined' ? choice : null;
  } catch {
    return null;
  }
}

export function enableTrustedDeviceCache(uid: string, scope: string) {
  localStorage.setItem(CACHE_ENABLED_KEY, '1');
  localStorage.setItem(CACHE_OWNER_KEY, uid);
  localStorage.setItem(CACHE_SCOPE_KEY, scope);
  localStorage.setItem(CACHE_ENABLED_AT_KEY, new Date().toISOString());
  localStorage.setItem(`${CACHE_DECISION_PREFIX}${uid}`, 'enabled');
}

export function declineTrustedDeviceCache(uid: string) {
  forgetTrustedDeviceCache();
  localStorage.setItem(`${CACHE_DECISION_PREFIX}${uid}`, 'declined');
}

export function forgetTrustedDeviceCache(uid?: string) {
  if (!storageAvailable()) return;
  localStorage.removeItem(CACHE_ENABLED_KEY);
  localStorage.removeItem(CACHE_OWNER_KEY);
  localStorage.removeItem(CACHE_SCOPE_KEY);
  localStorage.removeItem(CACHE_ENABLED_AT_KEY);
  if (uid) localStorage.removeItem(`${CACHE_DECISION_PREFIX}${uid}`);
}

export async function clearFirestoreDeviceCache(firestore: Firestore) {
  await terminate(firestore);
  await clearIndexedDbPersistence(firestore);
}
