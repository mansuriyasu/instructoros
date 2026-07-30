'use client';

import { useState } from 'react';
import { CalendarDays, CheckCircle2, Loader2, RefreshCw, Repeat2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSession } from '@/firebase';
import { useEvents } from '@/hooks/use-events';
import { useGoogleCalendar } from '@/hooks/use-google-calendar';
import { useToast } from '@/hooks/use-toast';
import type { CalendarEvent } from '@/lib/types';

const TIME_ZONE = 'America/Toronto';

function toGoogleDateTime(value: string) {
  return new Date(value).toISOString().replace(/\.\d{3}Z$/, '');
}

function toGoogleEvent(event: CalendarEvent) {
  return {
    summary: event.studentName && event.studentName !== 'N/A' ? event.studentName : event.title,
    description: [
      event.services?.map(service => service.name).join(', '),
      event.notes,
      'Synced from InstructorOS.',
    ].filter(Boolean).join('\n'),
    location: event.studentAddress || '',
    start: { dateTime: toGoogleDateTime(event.start), timeZone: TIME_ZONE },
    end: { dateTime: toGoogleDateTime(event.end), timeZone: TIME_ZONE },
    extendedProperties: { private: { sparkonEventId: event.id } },
  };
}

export function GoogleCalendarSettings() {
  const { user } = useSession();
  const { events, updateEvent } = useEvents();
  const { toast } = useToast();
  const {
    connect,
    changeAccount,
    isConnected,
    isConfigured,
    connectedEmail,
    connectionError,
    createEvent,
    updateEvent: updateGoogleEvent,
    findEvent,
    refreshStatus,
  } = useGoogleCalendar();
  const [isSyncing, setIsSyncing] = useState(false);

  const syncSchedule = async () => {
    if (!user) return;
    const status = await refreshStatus();
    if (!status.connected) {
      await connect();
      return;
    }

    setIsSyncing(true);
    try {
      let created = 0;
      let updated = 0;
      for (const event of (events || []) as CalendarEvent[]) {
        const googleEvent = toGoogleEvent(event);
        const savedGoogleId = event.googleEventIds?.[user.uid] || event.googleEventId;
        if (savedGoogleId) {
          if (await updateGoogleEvent(savedGoogleId, googleEvent)) updated += 1;
          continue;
        }

        const existingGoogleId = await findEvent(event.id, googleEvent);
        if (existingGoogleId) {
          if (await updateGoogleEvent(existingGoogleId, googleEvent)) {
            await updateEvent({ id: event.id, [`googleEventIds.${user.uid}`]: existingGoogleId } as Partial<CalendarEvent> & { id: string });
            updated += 1;
          }
          continue;
        }

        const googleEventId = await createEvent(googleEvent);
        if (googleEventId) {
          await updateEvent({ id: event.id, [`googleEventIds.${user.uid}`]: googleEventId } as Partial<CalendarEvent> & { id: string });
          created += 1;
        }
      }
      toast({ title: 'Google Calendar synced', description: `${created} added, ${updated} updated.` });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Card className="overflow-hidden border-white/75 shadow-elevated">
      <CardHeader className="border-b border-border/60 bg-secondary/30 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl"><CalendarDays className="h-5 w-5 text-primary" /> Google Calendar</CardTitle>
            <CardDescription className="mt-1">Connect each user’s own Google Calendar and sync scheduled lessons.</CardDescription>
          </div>
          <div className="rounded-2xl bg-card p-3 shadow-elevated"><CalendarDays className="h-5 w-5 text-primary" /></div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-5 sm:p-6">
        <div className="flex flex-col gap-3 rounded-2xl bg-secondary/45 p-4 shadow-inner sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-bold">{isConnected ? 'Calendar connected' : 'Calendar not connected'}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {isConnected ? (connectedEmail || 'Your Google account') : (connectionError || 'Connect an account to sync your lessons.')}
            </p>
          </div>
          {isConnected ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" /> : <span className="h-3 w-3 shrink-0 rounded-full bg-amber-400" />}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void syncSchedule()} disabled={isSyncing || !isConfigured} className="rounded-full shadow-elevated">
            {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            {isConnected ? 'Sync schedule' : 'Connect Google Calendar'}
          </Button>
          {isConnected && (
            <Button variant="outline" onClick={() => void changeAccount()} className="rounded-full shadow-inner">
              <Repeat2 className="mr-2 h-4 w-4" /> Change account
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Your calendar connection is private to your login. School team members can connect their own Google accounts separately.</p>
      </CardContent>
    </Card>
  );
}
