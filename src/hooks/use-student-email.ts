'use client';

import { useCallback } from 'react';
import { getAuthenticatedHeaders } from '@/lib/authenticated-fetch';
import { useSession } from '@/firebase';

export type StudentEmailTemplate = 'payment' | 'lesson' | 'welcome';

export class StudentEmailError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
  }
}

/** Emails a student through /api/messages/email. The server picks the address and logs the send. */
export function useStudentEmail() {
  const { activeTenantId } = useSession();

  const sendStudentEmail = useCallback(async (studentId: string, template: StudentEmailTemplate, data: Record<string, unknown> = {}) => {
    if (!activeTenantId) throw new StudentEmailError('Choose a workspace first.');
    const response = await fetch('/api/messages/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...await getAuthenticatedHeaders() },
      body: JSON.stringify({ tenantId: activeTenantId, studentId, template, data }),
    });
    const result = await response.json().catch(() => ({})) as { ok?: boolean; error?: string; code?: string; to?: string };
    if (!response.ok || !result.ok) {
      throw new StudentEmailError(result.error || 'Could not send the email.', result.code);
    }
    return { to: result.to || 'the student' };
  }, [activeTenantId]);

  return { sendStudentEmail };
}
