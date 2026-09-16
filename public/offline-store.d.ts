import type { OfflineDraft, OfflineSnapshot } from '../src/lib/offline-types';
export type OfflineState = { config: { scope: string; active: boolean } | null; snapshot: OfflineSnapshot | null; drafts: OfflineDraft[] };
export function readOfflineState(): Promise<OfflineState>;
export function subscribeOffline(callback: () => void): () => void;
export function enableOffline(scope: string): Promise<void>;
export function activateOffline(scope: string): Promise<void>;
export function clearOffline(): Promise<void>;
export function saveSnapshot(snapshot: OfflineSnapshot): Promise<void>;
export function saveDraft(scope: string, kind: OfflineDraft['kind'], label: string, payload: Record<string, unknown>, replacesId?: string): Promise<string>;
export function setDraftResult(scope: string, id: string, status: OfflineDraft['status'], message: string, recordId?: string): Promise<void>;
export function deleteDraft(scope: string, id: string): Promise<void>;
export function retryDraft(scope: string, id: string): Promise<void>;

export function claimNextDraft(scope: string): Promise<OfflineDraft | null>;
export function suspendOffline(scope: string): Promise<void>;
