'use client';

import { initializeFirebase } from '@/firebase';

export async function getAuthenticatedHeaders() {
  const { auth } = initializeFirebase();
  const user = auth.currentUser;
  if (!user) throw new Error('Please sign in before using this feature.');

  return { Authorization: `Bearer ${await user.getIdToken()}` };
}
