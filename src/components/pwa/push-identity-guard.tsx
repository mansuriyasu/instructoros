'use client';
import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { useAuth } from '@/firebase';
import { setPushOwner } from '@/firebase/messaging';

export function PushIdentityGuard() {
  const auth = useAuth();
  useEffect(() => onAuthStateChanged(auth, user => {
    const owner = localStorage.getItem('instructoros-push-user');
    if ('serviceWorker' in navigator && owner && owner !== user?.uid) {
      localStorage.removeItem('instructoros-push-enabled');
      void setPushOwner('').catch(() => {});
    }
  }), [auth]);
  return null;
}
