'use client';

import { useState } from 'react';
import { CalendarDays, Check, Loader2, RefreshCw, Unplug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useGoogleCalendar } from '@/hooks/use-google-calendar';
import { cn } from '@/lib/utils';

export function GoogleCalendarSettings() {
  const {
    connect,
    changeAccount,
    disconnect,
    isConnected,
    connectedEmail,
    isConfigured,
    connectionError,
    isClientLoaded,
  } = useGoogleCalendar();
  const [isBusy, setIsBusy] = useState(false);

  const run = async (action: () => Promise<unknown>) => {
    setIsBusy(true);
    try {
      await action();
    } finally {
      setIsBusy(false);
    }
  };

  const statusLabel = !isClientLoaded
    ? 'Checking connection…'
    : isConnected
      ? connectedEmail
        ? `Connected as ${connectedEmail}`
        : 'Connected'
      : isConfigured
        ? 'Not connected yet'
        : 'Google Calendar is not configured on the server';

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          Google Calendar
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Connect a Google account to keep your lessons in sync with Google Calendar. Once connected, you can sync from the Schedule page.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3 rounded-lg border p-3">
          <span
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
              isConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'
            )}
          >
            {isConnected ? <Check className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{statusLabel}</p>
            {connectionError ? (
              <p className="mt-0.5 text-xs text-destructive">{connectionError}</p>
            ) : (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {isConnected
                  ? 'Your calendar sync is active.'
                  : 'Connect to enable two-way calendar sync.'}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {isConnected ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => void run(changeAccount)}
                disabled={isBusy}
                className="rounded-lg"
              >
                {isBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Change account
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => void run(disconnect)}
                disabled={isBusy}
                className="rounded-lg text-destructive hover:bg-destructive/10"
              >
                <Unplug className="mr-2 h-4 w-4" />
                Disconnect
              </Button>
            </>
          ) : (
            <Button
              type="button"
              onClick={() => void run(connect)}
              disabled={isBusy || !isClientLoaded || !isConfigured}
              className="rounded-lg"
            >
              {isBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarDays className="mr-2 h-4 w-4" />}
              Connect Google Calendar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
