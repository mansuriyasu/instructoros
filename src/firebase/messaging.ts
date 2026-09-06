'use client';
import { initializeFirebase } from '@/firebase';
import { firebaseConfig } from './config';
import { getAuthenticatedHeaders } from '@/lib/authenticated-fetch';

export async function notificationRequest(query = '', body?: unknown) {
  const response = await fetch(`/api/notifications${query}`, { method: body ? 'POST' : 'GET', headers: { ...await getAuthenticatedHeaders(), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), cache: 'no-store' });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Could not update notifications.');
  return result;
}
export function installationId() {
  const existing = localStorage.getItem('instructoros-installation');
  if (existing) return existing;
  const id = crypto.randomUUID(); localStorage.setItem('instructoros-installation', id); return id;
}
export function platform() { return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'ios' : /Android/.test(navigator.userAgent) ? 'android' : 'desktop'; }
export function standalone() { return matchMedia('(display-mode: standalone)').matches || !!(navigator as Navigator & {standalone?: boolean}).standalone; }
export async function serviceWorker() {
  const config = { apiKey: firebaseConfig.apiKey, projectId: firebaseConfig.projectId, appId: firebaseConfig.appId, messagingSenderId: firebaseConfig.messagingSenderId };
  const registration = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?config=${encodeURIComponent(JSON.stringify(config))}`, { scope: '/', updateViaCache: 'none' });
  await navigator.serviceWorker.ready;
  return registration;
}
export async function setPushOwner(uid: string) {
  const registration = await navigator.serviceWorker.getRegistration('/');
  if (!registration?.active) return;
  await new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => { channel.port1.close(); reject(new Error('Please reopen InstructorOS and try again.')); }, 5000);
    channel.port1.onmessage = () => { clearTimeout(timer); channel.port1.close(); resolve(); };
    registration.active!.postMessage({ type: 'PUSH_OWNER', uid }, [channel.port2]);
  });
  if (uid) localStorage.setItem('instructoros-push-user', uid); else localStorage.removeItem('instructoros-push-user');
}
export async function registerPush() {
  if (!process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY) throw new Error('Mobile notifications are not configured yet.');
  const messaging = await import('firebase/messaging');
  if (!await messaging.isSupported()) throw new Error('Notifications are not supported on this browser.');
  const registration = await serviceWorker();
  const token = await messaging.getToken(messaging.getMessaging(initializeFirebase().firebaseApp), { vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY, serviceWorkerRegistration: registration });
  await notificationRequest('', { action: 'register', token, installationId: installationId(), platform: platform() });
  await setPushOwner(initializeFirebase().auth.currentUser?.uid || '');
  localStorage.setItem('instructoros-push-enabled', '1');
}
export async function disablePush() {
  await setPushOwner('');
  localStorage.removeItem('instructoros-push-enabled');
  try { await notificationRequest('', { action: 'disable', installationId: installationId() }); }
  finally {
    const messaging = await import('firebase/messaging');
    if (await messaging.isSupported()) await messaging.deleteToken(messaging.getMessaging(initializeFirebase().firebaseApp));
  }
}
