'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth, useSession } from '@/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { serviceWorker } from '@/firebase/messaging';
import { activateOffline, claimNextDraft, clearOffline, enableOffline, readOfflineState, saveSnapshot, setDraftResult, subscribeOffline, suspendOffline, type OfflineState } from '../../../public/offline-store';
import type { OfflineSnapshot } from '@/lib/offline-types';
import Link from 'next/link';
import { shouldRefreshOffline } from '@/lib/offline-refresh';

type OfflineContext = { state: OfflineState | null; enabled: boolean; online: boolean; busy: boolean; message: string; download: () => Promise<void>; enable: () => Promise<void> };
const Context = createContext<OfflineContext | null>(null);
export const useOffline = () => useContext(Context);

export function OfflineIdentityGuard() {
  const auth = useAuth();
  const { user, activeTenantId, tenant, member, isSessionLoading } = useSession();
  useEffect(() => {
    if (!user || !activeTenantId || isSessionLoading || !navigator.onLine) return;
    const scope = `${user.uid}:${activeTenantId}`;
    if (tenant?.status !== 'active' || member?.status !== 'active') void suspendOffline(scope).catch(() => {});
    else void activateOffline(scope).catch(() => {});
  }, [user, activeTenantId, tenant?.status, member?.status, isSessionLoading]);
  useEffect(() => onAuthStateChanged(auth, user => {
    void readOfflineState().then(state => {
      if (auth.currentUser?.uid !== user?.uid) return;
      if (state.config && (!user || !state.config.scope.startsWith(`${user.uid}:`))) return clearOffline();
    }).catch(() => {});
  }), [auth]);
  return null;
}

export function OfflineProvider({ children }: { children: ReactNode }) {
  const { user, activeTenantId, isSessionLoading } = useSession();
  const auth = useAuth();
  const scope = user && activeTenantId ? `${user.uid}:${activeTenantId}` : '';
  const scopeRef = useRef(scope); scopeRef.current = scope;
  const [state, setState] = useState<OfflineState | null>(null);
  const [online, setOnline] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const running = useRef(false);
  const nextAttempt = useRef(0);
  const enabled = !!scope && state?.config?.scope === scope && state.config.active;
  const refresh = useCallback(async () => {
    try { setState(await readOfflineState()); } catch (error) { setMessage(error instanceof Error ? error.message : 'Offline storage is unavailable.'); }
  }, []);

  const request = useCallback(async (path: string, body: unknown) => {
    if (!user || auth.currentUser?.uid !== user.uid || scopeRef.current !== scope) throw new Error('Your workspace changed. Please try again.');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const token = await Promise.race([user.getIdToken(), new Promise<never>((_, reject) => { controller.signal.addEventListener('abort', () => reject(new Error('Connection timed out. Your drafts remain saved.')), { once: true }); })]);
      const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body), signal: controller.signal, cache: 'no-store' });
      const result = await response.json();
      return { response, result };
    } finally { window.clearTimeout(timeout); }
  }, [user, auth, scope]);

  const download = useCallback(async () => {
    if (!navigator.onLine) throw new Error('Connect to the internet to download the latest data.');
    const { response, result } = await request('/api/offline/snapshot', { tenantId: activeTenantId });
    if (!response.ok) {
      if (response.status === 403) await suspendOffline(scope);
      throw new Error(result.error || 'Download failed. Your previous download remains available.');
    }
    if (scopeRef.current !== scope || auth.currentUser?.uid !== user?.uid) return;
    if (result.scope !== scope) throw new Error('The downloaded workspace did not match your account.');
    await saveSnapshot(result as OfflineSnapshot);
    setMessage('Students and seven days of lessons downloaded.');
    await refresh();
  }, [activeTenantId, request, scope, auth, user?.uid, refresh]);

  const sync = useCallback(async (force = false) => {
    if (running.current || !scope || isSessionLoading || !navigator.onLine || (!force && Date.now() < nextAttempt.current)) return;
    running.current = true;
    try {
      const current = await readOfflineState();
      if (!current.config?.active || current.config.scope !== scope) return;
      setBusy(true);
      let wrote = false;
      for (let count = 0; count < 30; count++) {
        if (!navigator.onLine || scopeRef.current !== scope || auth.currentUser?.uid !== user?.uid) break;
        const draft = await claimNextDraft(scope);
        if (!draft) break;
        try {
          const { response, result } = await request('/api/offline/sync', { tenantId: activeTenantId, id: draft.id, operation: { kind: draft.kind, payload: draft.payload } });
          if (response.ok && result.ok) {
            await setDraftResult(scope, draft.id, 'synced', 'Server confirmed this record is saved.', result.recordId);
            wrote = true;
            window.dispatchEvent(new Event('instructoros-offline-synced'));
          } else if (response.status === 409) {
            await setDraftResult(scope, draft.id, 'conflict', result.error || 'Review this draft against the latest record.');
            wrote = true; // refresh the snapshot for conflict review
          } else if ([400, 403, 404, 413].includes(response.status)) {
            await setDraftResult(scope, draft.id, 'blocked', result.error || 'This draft needs attention.');
          } else {
            await setDraftResult(scope, draft.id, 'pending', 'Upload not confirmed. It will retry with the same draft ID.');
            nextAttempt.current = Date.now() + (response.status === 429 ? 15 * 60000 : 30000);
            break;
          }
        } catch {
          await setDraftResult(scope, draft.id, 'pending', 'Connection interrupted. This draft is still saved on this phone.');
          nextAttempt.current = Date.now() + 30000;
          break;
        }
      }
      if (shouldRefreshOffline(current.snapshot?.downloadedAt, force, wrote)) await download();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Offline sync could not finish.'); nextAttempt.current = Date.now() + 30000; }
    finally { running.current = false; setBusy(false); await refresh(); }
  }, [scope, isSessionLoading, auth, user?.uid, request, activeTenantId, download, refresh]);

  useEffect(() => {
    setOnline(navigator.onLine);
    const onOnline = () => { setOnline(true); nextAttempt.current = 0; void sync(); };
    const onOffline = () => setOnline(false);
    const onVisible = () => { if (!document.hidden) void sync(); };
    window.addEventListener('online', onOnline); window.addEventListener('offline', onOffline); document.addEventListener('visibilitychange', onVisible);
    const unsubscribe = subscribeOffline(() => { void refresh(); });
    const timer = window.setInterval(() => { if (!document.hidden) void sync(); }, 15000);
    void activateOffline(scope).then(refresh).then(() => sync()).catch(() => {});
    return () => { unsubscribe(); window.clearInterval(timer); window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); document.removeEventListener('visibilitychange', onVisible); };
  }, [scope, refresh, sync]);

  const enable = async () => {
    setBusy(true);
    try {
      if (!scope || !navigator.onLine) throw new Error('Sign in with internet before enabling offline access.');
      const registration = await serviceWorker();
      const installing = registration.installing || registration.waiting;
      if (installing && installing.state !== 'activated') await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error('Offline screens are still downloading. Try again before leaving coverage.')), 20000);
        installing.addEventListener('statechange', () => {
          if (installing.state === 'activated') { window.clearTimeout(timeout); resolve(); }
          else if (installing.state === 'redundant') { window.clearTimeout(timeout); reject(new Error('Offline screens could not be installed. Try downloading again.')); }
        });
      });
      const cache = await caches.open('instructoros-shell-v2');
      if (!(await cache.match('/offline.html'))) throw new Error('Offline screens are not ready. Reload InstructorOS and try again.');
      await enableOffline(scope);
      await download();
      // Ask iOS for durable storage when supported; availability remains browser-controlled.
      void navigator.storage?.persist?.().catch(() => false);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not enable offline access.'); }
    finally { setBusy(false); await refresh(); }
  };
  return <Context.Provider value={{ state, enabled, online, busy, message, download: async () => { nextAttempt.current = 0; await sync(true); }, enable }}>{children}</Context.Provider>;
}

export function OfflineBanner() {
  const offline = useOffline();
  if (!offline) return null;
  const pending = offline.enabled ? offline.state?.drafts.filter(draft => draft.status !== 'synced').length || 0 : 0;
  return <details className="border-b bg-secondary/30 px-4 text-xs">
    <summary className="cursor-pointer py-2 font-medium">{!offline.online ? 'Offline' : offline.busy ? 'Offline copy · Syncing…' : pending ? `Offline copy · ${pending} pending` : 'Offline access'}</summary>
    <div className="space-y-2 pb-3">
    <span>{!offline.online ? 'Offline · ' : ''}{offline.busy ? 'Syncing…' : pending ? `${pending} saved on this phone · pending or needs review` : offline.enabled && offline.state?.snapshot ? `Offline copy saved ${new Date(offline.state.snapshot.downloadedAt).toLocaleString()}` : 'Offline access available on trusted devices'}</span>
    <div className="flex flex-wrap gap-3"><Link href="/app/offline" className="font-semibold underline">Offline access</Link>{offline.enabled && <a href="/offline.html" className="font-semibold underline">Open saved workspace</a>}</div>
    </div>
  </details>;
}
