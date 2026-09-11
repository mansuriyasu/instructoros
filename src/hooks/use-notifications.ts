'use client';
import { createContext, createElement, useContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useSession } from '@/firebase';
import { notificationRequest } from '@/firebase/messaging';
export type InboxItem = { id: string; title: string; message: string; createdAt: string; read: boolean; type: string; studentId?: string };
function useInbox() {
  const { user, activeTenantId, isSessionLoading } = useSession();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const refresh = useCallback(async (next?: string) => {
    if (!user || !activeTenantId || isSessionLoading) return;
    const current = generation.current;
    try {
      const result = await notificationRequest(next ? `?cursor=${next}` : '');
      if (current !== generation.current) return;
      setItems(old => next ? [...old, ...result.items.filter((i: InboxItem) => !old.some(o => o.id === i.id))] : result.items);
      setUnread(result.unread); setCursor(result.cursor); setError('');
      const badge = navigator as Navigator & {setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void>};
      if (result.unread) void badge.setAppBadge?.(result.unread).catch(() => {}); else void badge.clearAppBadge?.().catch(() => {});
    } catch (e) { if (current === generation.current) setError((e as Error).message); }
  }, [user, activeTenantId, isSessionLoading]);
  useEffect(() => {
    const currentGeneration = ++generation.current; setItems([]); setUnread(0); setCursor(null);
    void refresh();
    const reload = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('focus', reload); window.addEventListener('instructoros-notifications', reload);
    const timer = setInterval(reload, 120000);
    return () => { generation.current = currentGeneration + 1; clearInterval(timer); window.removeEventListener('focus', reload); window.removeEventListener('instructoros-notifications', reload); };
  }, [refresh]);
  const markRead = async (id?: string) => {
    try { let result; do { result = await notificationRequest('', { action: 'read', ...(id ? { id } : {}) }); } while (result.more); await refresh(); } catch (e) { setError((e as Error).message); }
  };
  return { items, unread, error, refresh, markRead, more: cursor ? () => refresh(cursor) : undefined };
}
const InboxContext = createContext<ReturnType<typeof useInbox> | null>(null);
export function NotificationsProvider({ children }: { children: ReactNode }) {
  return createElement(InboxContext.Provider, { value: useInbox() }, children);
}
export function useNotifications() {
  const inbox = useContext(InboxContext);
  if (!inbox) throw new Error('Notification provider is missing.');
  return inbox;
}
