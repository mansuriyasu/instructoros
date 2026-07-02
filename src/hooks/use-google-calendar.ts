"use client";

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

const GOOGLE_CALENDAR_API = '/api/google-calendar/events';
const GOOGLE_CALENDAR_STATUS_API = '/api/google-calendar/status?check=1';
const GOOGLE_CALENDAR_TIMEOUT_MS = 30000;

export type GoogleCalendarEvent = {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  status?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  extendedProperties?: {
    private?: Record<string, string>;
    shared?: Record<string, string>;
  };
};

type GoogleCalendarStatus = {
  configured: boolean;
  connected?: boolean;
  error?: string | null;
};

type GoogleCalendarErrorPayload = {
  error?: string;
  code?: string;
};

function getCalendarErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');

  if (/expired|revoked|invalid_grant|reconnect/i.test(message)) {
    return 'Google Calendar needs to be reconnected. The saved permanent token expired or was revoked.';
  }

  if (/not configured/i.test(message)) {
    return 'Google Calendar permanent connection is not configured on the server.';
  }

  if (/abort|timeout|timed out|did not respond/i.test(message)) {
    return 'Google Calendar did not respond in time. The schedule was saved in SparkOn; try calendar sync later.';
  }

  return message || 'Google Calendar request failed.';
}

export function useGoogleCalendar() {
  const [isClientLoaded, setIsClientLoaded] = useState(false);
  const [isServerConfigured, setIsServerConfigured] = useState(false);
  const [isServerConnected, setIsServerConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [gEvents, setGEvents] = useState<GoogleCalendarEvent[]>([]);
  const { toast } = useToast();

  const refreshStatus = useCallback(async () => {
    try {
      const response = await fetch(GOOGLE_CALENDAR_STATUS_API, { cache: 'no-store' });
      const status = await response.json() as GoogleCalendarStatus;
      setIsServerConfigured(Boolean(status.configured));
      setIsServerConnected(Boolean(status.connected));
      setConnectionError(status.error || null);
      return status;
    } catch (error) {
      const message = getCalendarErrorMessage(error);
      setIsServerConfigured(false);
      setIsServerConnected(false);
      setConnectionError(message);
      return { configured: false, connected: false, error: message } satisfies GoogleCalendarStatus;
    } finally {
      setIsClientLoaded(true);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const serverRequest = async <T,>(body: Record<string, unknown>) => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), GOOGLE_CALENDAR_TIMEOUT_MS);

    try {
      const response = await fetch(GOOGLE_CALENDAR_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({})) as GoogleCalendarErrorPayload;

      if (!response.ok) {
        if (data.code === 'GOOGLE_CALENDAR_RECONNECT_REQUIRED') {
          setIsServerConnected(false);
          setConnectionError(data.error || 'Google Calendar needs to be reconnected.');
        }
        throw new Error(data.error || 'Google Calendar request failed.');
      }

      return data as T;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('Google Calendar request timed out.');
      }
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const fetchEvents = async () => {
    try {
      const data = await serverRequest<{ items?: GoogleCalendarEvent[] }>({ action: 'fetch' });
      setGEvents(data.items || []);
      setIsServerConnected(true);
      setConnectionError(null);
      return data.items || [];
    } catch (error) {
      console.error(error);
      toast({
        title: "Google Calendar read failed",
        description: getCalendarErrorMessage(error),
        variant: "destructive"
      });
      return [];
    }
  };

  const connect = useCallback(async () => {
    const status = await refreshStatus();

    if (!status.configured) {
      toast({
        title: "Google Calendar is not configured",
        description: status.error || "Add the permanent Google Calendar environment variables on the server.",
        variant: "destructive"
      });
      return false;
    }

    if (!status.connected) {
      toast({
        title: "Google Calendar reconnect required",
        description: getCalendarErrorMessage(status.error),
        variant: "destructive"
      });
      return false;
    }

    await fetchEvents();
    toast({ title: "Google Calendar Connected", description: "Your permanent calendar sync is ready." });
    return true;
  }, [refreshStatus, toast]);

  const createEvent = async (event: Partial<GoogleCalendarEvent>) => {
    try {
      const data = await serverRequest<{ id?: string }>({ action: 'create', event });
      setConnectionError(null);
      return data.id || null;
    } catch (error) {
      console.error("Failed to create Google Calendar event", error);
      toast({
        title: "Google Calendar create failed",
        description: getCalendarErrorMessage(error),
        variant: "destructive"
      });
      return null;
    }
  };

  const updateEvent = async (eventId: string, event: Partial<GoogleCalendarEvent>) => {
    try {
      await serverRequest({ action: 'update', eventId, event });
      setConnectionError(null);
      return true;
    } catch (error) {
      console.error("Failed to update Google Calendar event", error);
      toast({
        title: "Google Calendar update failed",
        description: getCalendarErrorMessage(error),
        variant: "destructive"
      });
      return false;
    }
  };

  const deleteEvent = async (eventId: string) => {
    try {
      await serverRequest({ action: 'delete', eventId });
      setGEvents(prev => prev.filter(e => e.id !== eventId));
      setConnectionError(null);
      return true;
    } catch (error) {
      console.error("Failed to delete Google Calendar event", error);
      toast({
        title: "Google Calendar delete failed",
        description: getCalendarErrorMessage(error),
        variant: "destructive"
      });
      return false;
    }
  };

  const findEvent = async (sparkonEventId: string, fallbackEvent?: Partial<GoogleCalendarEvent>) => {
    try {
      const data = await serverRequest<{ id?: string }>({
        action: 'find',
        sparkonEventId,
        fallbackEvent,
      });
      setConnectionError(null);
      return data.id || null;
    } catch (error) {
      console.error("Failed to find Google Calendar event", error);
      return null;
    }
  };

  return {
    connect,
    isConnected: isServerConnected,
    isConfigured: isServerConfigured,
    connectionError,
    isClientLoaded,
    gEvents,
    fetchEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    findEvent,
    refreshStatus,
  };
}
