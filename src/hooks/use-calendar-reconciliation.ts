'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from '@/firebase';
import { calendarSyncSignature } from '@/lib/google-calendar-sync';
import type { CalendarEvent } from '@/lib/types';
type Queue = Record<string, string>;

export function useCalendarReconciliation(events: CalendarEvent[], connected: boolean, loading: boolean) {
  const { user, activeTenantId } = useSession();
  const scope = user && activeTenantId ? `${user.uid}:${activeTenantId}` : '';
  const key = `instructoros-calendar-pending:${scope}`;
  const queue = useRef<Queue>({});
  const acknowledged = useRef<Record<string, string>>({});
  const activeKey = useRef('');
  const running = useRef(false);
  const nextAttempt = useRef(0);
  const latest = useRef({ user, activeTenantId, connected, scope, key });
  latest.current = { user, activeTenantId, connected, scope, key };
  const [pending, setPending] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const restore = useCallback(() => {
    if (activeKey.current === key) return;
    activeKey.current = key;
    queue.current = {};
    acknowledged.current = {};
    nextAttempt.current = 0;
    setError(''); setConfirmed(false);
    try {
      const stored = JSON.parse(localStorage.getItem(key) || '{}');
      if (stored && typeof stored === 'object' && !Array.isArray(stored)) for (const [id, token] of Object.entries(stored)) {
        if (/^[a-zA-Z0-9_-]{1,160}$/.test(id) && typeof token === 'string') queue.current[id] = token;
      }
    } catch { setError('Pending changes could not be restored. Recheck this schedule after reconnecting.'); }
    setPending(Object.keys(queue.current).length);
  }, [key]);
  const persist = useCallback(() => {
    setPending(Object.keys(queue.current).length);
    try { localStorage.setItem(key, JSON.stringify(queue.current)); }
    catch { setError('This browser cannot retain retries. Keep Schedule open until Google confirms the updates.'); }
  }, [key]);
  const enqueue = useCallback((ids: string[], replace = true) => {
    if (!scope) return;
    restore();
    for (const id of ids) if (replace || !queue.current[id]) queue.current[id] = crypto.randomUUID();
    if (ids.length) setConfirmed(false);
    persist();
  }, [scope, restore, persist]);

  const process = useCallback(async () => {
    const context = latest.current;
    if (running.current || !context.user || !context.scope || !context.connected || !navigator.onLine || Date.now() < nextAttempt.current || activeKey.current !== context.key) return;
    const batch = Object.entries(queue.current).slice(0, 20);
    if (!batch.length) return;
    running.current = true; setBusy(true);
    // A single batched request, no more than one every 15 seconds. Failed
    // batches back off further; only server-confirmed entries leave the queue.
    nextAttempt.current = Date.now() + 15000;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 90000);
    try {
      const token = await context.user.getIdToken();
      if (latest.current.key !== context.key) return;
      const response = await fetch('/api/google-calendar/reconcile', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ tenantId: context.activeTenantId, ids: batch.map(([id]) => id) }), signal: controller.signal });
      const result = await response.json();
      if (latest.current.key !== context.key) return;
      if (!response.ok) throw new Error(result.error || 'Google Calendar did not confirm the update.');
      let failed = '';
      for (const [id, sentToken] of batch) {
        const entry = result.results?.find((item: { localId: string }) => item.localId === id);
        if (!entry || entry.error || (!entry.signature && !entry.removed)) { failed = entry?.error || 'Google has not confirmed every appointment.'; continue; }
        if (entry.signature) acknowledged.current[id] = entry.signature;
        // A second edit while this request was in flight must remain queued.
        if (queue.current[id] === sentToken) delete queue.current[id];
      }
      setError(failed);
      if (failed) nextAttempt.current = Date.now() + 60000;
      persist();
      setConfirmed(!failed && !Object.keys(queue.current).length);
    } catch (cause) {
      if (latest.current.key !== context.key) return;
      setError(cause instanceof Error ? cause.message : 'Google Calendar update failed.');
      nextAttempt.current = Date.now() + 60000;
    } finally {
      clearTimeout(timeout); running.current = false; setBusy(false);
    }
  }, [persist]);

  useEffect(() => {
    restore();
    if (!scope || loading || !connected || !user) return;
    const changed = events.filter(event => {
      const signature = calendarSyncSignature(event);
      return event.googleSyncSignatures?.[user.uid] !== signature && acknowledged.current[event.id] !== signature;
    }).map(event => event.id);
    // Even already-linked appointments are reconciled when their fields change.
    enqueue(changed, false);
    if (!changed.length && !Object.keys(queue.current).length && events.length) setConfirmed(true);
  }, [events, connected, loading, scope, user, restore, enqueue]);
  useEffect(() => {
    const tick = () => { if (!document.hidden) void process(); };
    const timer = window.setInterval(tick, 3000);
    window.addEventListener('online', tick);
    document.addEventListener('visibilitychange', tick);
    return () => { window.clearInterval(timer); window.removeEventListener('online', tick); document.removeEventListener('visibilitychange', tick); };
  }, [process]);
  return { enqueue, pending, busy, error, confirmed, retry: () => { nextAttempt.current = 0; void process(); } };
}
