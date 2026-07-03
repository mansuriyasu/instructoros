"use client";

import { SmsLog } from '@/lib/types';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, useUser, useTenantCollectionPath } from '@/firebase';
import { collection, orderBy, query } from 'firebase/firestore';

type SendMessageResult = {
  ok?: boolean;
  error?: string;
  sid?: string;
  channel?: 'whatsapp' | 'sms';
  fallbackFrom?: 'whatsapp';
  fallbackReason?: string;
};

type WhatsAppTemplateOptions = {
  templateKey?: 'schedule' | 'payment' | 'welcome';
  variables?: Record<string, string>;
};

export function useSmsLogs() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const smsLogsPath = useTenantCollectionPath('smsLogs');

  const smsLogsCollectionRef = useMemoFirebase(
    () => (firestore && user && smsLogsPath ? collection(firestore, smsLogsPath) : null),
    [firestore, user, smsLogsPath]
  );

  const smsLogsQuery = useMemoFirebase(
    () => (smsLogsCollectionRef ? query(smsLogsCollectionRef, orderBy('date', 'desc')) : null),
    [smsLogsCollectionRef]
  );

  const { data: smsLogs, isLoading } = useCollection<SmsLog>(smsLogsQuery);

  const sendAndLogSms = async (to: string, body: string, whatsappTemplate?: WhatsAppTemplateOptions) => {
    if (!user || !smsLogsCollectionRef) {
      throw new Error('Firebase sign-in is not ready or database is not available.');
    }

    try {
      const response = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, body, preferChannel: 'whatsapp', whatsappTemplate }),
      });
      const result: SendMessageResult = await response.json().catch(() => ({}));

      if (!response.ok || !result.ok) {
        // Log the error
        addDocumentNonBlocking(smsLogsCollectionRef, {
          to,
          body,
          status: 'error',
          channel: result.channel,
          errorMessage: result.error || 'Twilio could not send the text message.',
          date: new Date().toISOString(),
        } as Omit<SmsLog, 'id'>);

        return { ok: false, error: result.error || 'Twilio could not send the text message.' };
      }

      // Log the success
      addDocumentNonBlocking(smsLogsCollectionRef, {
        to,
        body,
        status: 'sent',
        channel: result.channel || 'sms',
        fallbackFrom: result.fallbackFrom,
        fallbackReason: result.fallbackReason,
        sid: result.sid,
        date: new Date().toISOString(),
      } as Omit<SmsLog, 'id'>);

      return {
        ok: true,
        channel: result.channel || 'sms',
        fallbackFrom: result.fallbackFrom,
        fallbackReason: result.fallbackReason,
      };
    } catch (error) {
      // Log the network error
      addDocumentNonBlocking(smsLogsCollectionRef, {
        to,
        body,
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Could not reach the SMS service.',
        date: new Date().toISOString(),
      } as Omit<SmsLog, 'id'>);

      return { ok: false, error: 'Could not reach the SMS service.' };
    }
  };

  return { smsLogs, loading: isUserLoading || isLoading, sendAndLogSms };
}
