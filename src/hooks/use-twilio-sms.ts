'use client';

import { useCallback } from 'react';
import { getAuthenticatedHeaders } from '@/lib/authenticated-fetch';
import { WhatsAppLog } from '@/lib/types';
import { addDocumentNonBlocking, useFirestore, useMemoFirebase, useTenantCollectionPath, useUser } from '@/firebase';
import { collection } from 'firebase/firestore';

export function useTwilioSms() {
  const firestore = useFirestore();
  const { user } = useUser();
  const smsLogsPath = useTenantCollectionPath('smsLogs');
  const smsLogsCollectionRef = useMemoFirebase(
    () => (firestore && user && smsLogsPath ? collection(firestore, smsLogsPath) : null),
    [firestore, user, smsLogsPath]
  );

  const sendSms = useCallback(async (to: string, body: string) => {
    const log = (entry: Omit<WhatsAppLog, 'id'>) => {
      if (smsLogsCollectionRef) addDocumentNonBlocking(smsLogsCollectionRef, entry);
    };
    let failureLogged = false;

    try {
      const response = await fetch('/api/twilio/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...await getAuthenticatedHeaders() },
        body: JSON.stringify({ to, body }),
      });
      const data = await response.json().catch(() => ({})) as { ok?: boolean; error?: string; code?: number | string; sid?: string };
      if (!response.ok || !data.ok) {
        const message = data.error || 'Could not send SMS.';
        const errorMessage = data.code ? `${message} (Twilio code ${data.code})` : message;
        log({ to, body, status: 'error', channel: 'sms', errorMessage, date: new Date().toISOString() });
        failureLogged = true;
        throw new Error(errorMessage);
      }
      log({ to, body, status: 'sent', channel: 'sms', date: new Date().toISOString() });
      return data;
    } catch (error) {
      if (!failureLogged) {
        log({ to, body, status: 'error', channel: 'sms', errorMessage: error instanceof Error ? error.message : 'Could not send SMS.', date: new Date().toISOString() });
      }
      throw error;
    }
  }, [smsLogsCollectionRef]);

  return { sendSms };
}
