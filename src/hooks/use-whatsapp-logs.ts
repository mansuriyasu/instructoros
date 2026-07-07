"use client";

import { WhatsAppLog } from '@/lib/types';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, useUser, useTenantCollectionPath } from '@/firebase';
import { collection, orderBy, query } from 'firebase/firestore';

type SendMessageResult = {
  ok?: boolean;
  error?: string;
  channel?: 'whatsapp';
};

type WhatsAppTemplateOptions = {
  templateKey?: 'schedule' | 'payment' | 'welcome';
  variables?: Record<string, string>;
};

function normalizeWhatsAppPhone(phoneNumber: string) {
  const digits = phoneNumber.replace(/\D/g, '');
  if (digits.length === 10) return `1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return digits;
  return digits;
}

function openWhatsAppMessage(to: string, body: string) {
  const phone = normalizeWhatsAppPhone(to);
  if (!phone) {
    return false;
  }

  const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(body)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

export function useWhatsAppLogs() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const whatsAppLogsPath = useTenantCollectionPath('whatsappLogs');

  const whatsAppLogsCollectionRef = useMemoFirebase(
    () => (firestore && user && whatsAppLogsPath ? collection(firestore, whatsAppLogsPath) : null),
    [firestore, user, whatsAppLogsPath]
  );

  const whatsAppLogsQuery = useMemoFirebase(
    () => (whatsAppLogsCollectionRef ? query(whatsAppLogsCollectionRef, orderBy('date', 'desc')) : null),
    [whatsAppLogsCollectionRef]
  );

  const { data: whatsAppLogs, isLoading } = useCollection<WhatsAppLog>(whatsAppLogsQuery);

  const sendAndLogWhatsApp = async (to: string, body: string, _whatsappTemplate?: WhatsAppTemplateOptions): Promise<SendMessageResult> => {
    void _whatsappTemplate;

    if (!user || !whatsAppLogsCollectionRef) {
      throw new Error('Firebase sign-in is not ready or database is not available.');
    }

    try {
      const didOpen = openWhatsAppMessage(to, body);
      if (!didOpen) {
        addDocumentNonBlocking(whatsAppLogsCollectionRef, {
          to,
          body,
          status: 'error',
          channel: 'whatsapp',
          errorMessage: 'Phone number is missing or invalid.',
          date: new Date().toISOString(),
        } as Omit<WhatsAppLog, 'id'>);

        return { ok: false, error: 'Phone number is missing or invalid.', channel: 'whatsapp' };
      }

      addDocumentNonBlocking(whatsAppLogsCollectionRef, {
        to,
        body,
        status: 'sent',
        channel: 'whatsapp',
        date: new Date().toISOString(),
      } as Omit<WhatsAppLog, 'id'>);

      return {
        ok: true,
        channel: 'whatsapp',
      };
    } catch (error) {
      addDocumentNonBlocking(whatsAppLogsCollectionRef, {
        to,
        body,
        status: 'error',
        channel: 'whatsapp',
        errorMessage: error instanceof Error ? error.message : 'Could not open WhatsApp.',
        date: new Date().toISOString(),
      } as Omit<WhatsAppLog, 'id'>);

      return { ok: false, error: 'Could not open WhatsApp.', channel: 'whatsapp' };
    }
  };

  return { whatsAppLogs, loading: isUserLoading || isLoading, sendAndLogWhatsApp, openWhatsAppMessage };
}
