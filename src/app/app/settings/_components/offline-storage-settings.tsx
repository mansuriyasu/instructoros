'use client';

import { HardDrive, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { useOffline } from '@/components/offline/offline-provider';
import { Button } from '@/components/ui/button';
import { getTrustedDeviceCacheInfo } from '@/lib/trusted-device-cache';

function formatBytes(bytes: number | null) {
  if (bytes === null) return 'Storage estimate unavailable';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB used by InstructorOS`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB used by InstructorOS`;
}
export function OfflineStorageSettings() {
  const offline = useOffline();
  if (!offline) return null;

  const cacheInfo = getTrustedDeviceCacheInfo();
  const lastSyncedAt = offline.state?.snapshot?.downloadedAt;

  return (
    <section className="space-y-5 rounded-[22px] border border-white/75 bg-card p-5 shadow-elevated sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <HardDrive className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-bold">Offline & device storage</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Keep frequently used data on a personal phone for faster opening and limited offline access.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border bg-muted/25 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4" />
            Trusted-device cache
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {offline.cacheEnabled ? 'Enabled on this device' : 'Not enabled'}
          </p>
          {cacheInfo.enabledAt && (
            <p className="mt-1 text-xs text-muted-foreground">Enabled {new Date(cacheInfo.enabledAt).toLocaleString()}</p>
          )}
        </div>
        <div className="rounded-2xl border bg-muted/25 p-4">
          <p className="text-sm font-semibold">Saved data</p>
          <p className="mt-2 text-sm text-muted-foreground">{formatBytes(offline.storageUsage)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {lastSyncedAt ? `Last synced ${new Date(lastSyncedAt).toLocaleString()}` : 'No offline snapshot downloaded'}
          </p>
        </div>
      </div>

      {offline.message && <p role="status" className="rounded-xl bg-secondary p-3 text-sm">{offline.message}</p>}

      <div className="flex flex-wrap gap-2">
        {!offline.enabled ? (
          <Button disabled={offline.busy || !offline.online} onClick={() => void offline.enable()}>
            <ShieldCheck className="mr-2 h-4 w-4" />
            {offline.busy ? 'Preparing…' : 'Enable on this trusted device'}
          </Button>
        ) : (
          <Button disabled={offline.busy || !offline.online} onClick={() => void offline.download()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Sync saved data
          </Button>
        )}
        {(offline.enabled || offline.cacheEnabled) && (
          <Button variant="destructive" disabled={offline.busy} onClick={() => void offline.remove()}>
            <Trash2 className="mr-2 h-4 w-4" />
            Remove saved data
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Use this only on a personal device. Removing saved data does not delete anything from your online InstructorOS workspace.
      </p>
    </section>
  );
}
