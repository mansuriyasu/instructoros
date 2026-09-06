'use client';
import { useEffect } from 'react';
import { useSession } from '@/firebase';
import { registerPush, serviceWorker, setPushOwner } from '@/firebase/messaging';
import { initializeFirebase } from '@/firebase';

export function PwaProvider() {
  const { user, activeTenantId } = useSession();
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    void serviceWorker().then(async () => {
      if (cancelled) return;
      await setPushOwner(user?.uid || '');
      if (!user || !activeTenantId) return;
      if ('Notification' in window && Notification.permission === 'granted' && localStorage.getItem('instructoros-push-enabled') === '1') await registerPush();
      const messaging = await import('firebase/messaging');
      if (!cancelled && await messaging.isSupported()) unsubscribe = messaging.onMessage(messaging.getMessaging(initializeFirebase().firebaseApp), () => window.dispatchEvent(new Event('instructoros-notifications')));
    }).catch(() => { /* Setup errors are surfaced in Notification Settings. */ });
    return () => { cancelled = true; unsubscribe?.(); };
  }, [user, activeTenantId]);
  return null;
}
