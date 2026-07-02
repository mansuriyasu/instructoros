import type { GoogleCalendarEvent } from '@/hooks/use-google-calendar';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars';
const SPARKON_EVENT_ID_PROPERTY = 'sparkonEventId';
const SPARKON_DESCRIPTION_MARKER = 'Synced from InstructorOS.';

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

type CalendarConfig = {
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  calendarId: string;
};

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

export class GoogleCalendarTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleCalendarTokenError';
  }
}

function isInvalidRefreshTokenError(data: TokenResponse) {
  return data.error === 'invalid_grant' || /expired|revoked/i.test(data.error_description || '');
}

export function getGoogleCalendarConfig(): CalendarConfig {
  return {
    clientId: process.env.GOOGLE_CALENDAR_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
    refreshToken: process.env.GOOGLE_CALENDAR_REFRESH_TOKEN,
    calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
  };
}

export function getGoogleCalendarStatus() {
  const config = getGoogleCalendarConfig();
  return {
    configured: Boolean(config.clientId && config.clientSecret && config.refreshToken),
    clientIdConfigured: Boolean(config.clientId),
    clientSecretConfigured: Boolean(config.clientSecret),
    refreshTokenConfigured: Boolean(config.refreshToken),
    calendarId: config.calendarId,
  };
}

export function getGoogleCalendarRedirectUri(origin: string) {
  return `${origin}/api/google-calendar/callback`;
}

export function assertSetupSecret(secret: string | null) {
  const expectedSecret = process.env.GOOGLE_CALENDAR_SETUP_SECRET || process.env.SHORTCUT_SECRET;
  if (!expectedSecret || secret !== expectedSecret) {
    throw new Error('Google Calendar setup is locked.');
  }
}

export async function exchangeCodeForRefreshToken(code: string, origin: string) {
  const config = getGoogleCalendarConfig();
  if (!config.clientId || !config.clientSecret) {
    throw new Error('Google Calendar client ID or secret is missing.');
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: getGoogleCalendarRedirectUri(origin),
      grant_type: 'authorization_code',
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.refresh_token) {
    throw new Error(data.error_description || data.error || 'Google did not return a refresh token.');
  }

  return data.refresh_token as string;
}

async function getAccessToken() {
  const config = getGoogleCalendarConfig();
  if (!config.clientId || !config.clientSecret || !config.refreshToken) {
    throw new Error('Google Calendar permanent connection is not configured.');
  }

  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now()) {
    return cachedAccessToken.token;
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const data = await response.json() as TokenResponse;
  if (!response.ok || !data.access_token) {
    cachedAccessToken = null;
    if (isInvalidRefreshTokenError(data)) {
      throw new GoogleCalendarTokenError('Google Calendar connection expired or was revoked. Reconnect Google Calendar and replace GOOGLE_CALENDAR_REFRESH_TOKEN on the server.');
    }
    throw new Error(data.error_description || data.error || 'Could not refresh Google Calendar access.');
  }

  cachedAccessToken = {
    token: data.access_token,
    expiresAt: Date.now() + Math.max((data.expires_in || 3600) - 60, 60) * 1000,
  };

  return cachedAccessToken.token;
}

export async function checkGoogleCalendarConnection() {
  const status = getGoogleCalendarStatus();
  if (!status.configured) {
    return {
      ...status,
      connected: false,
      error: 'Google Calendar permanent connection is not configured.',
    };
  }

  try {
    await getAccessToken();
    return {
      ...status,
      connected: true,
      error: null,
    };
  } catch (error) {
    return {
      ...status,
      connected: false,
      error: error instanceof Error ? error.message : 'Google Calendar connection failed.',
    };
  }
}

async function googleCalendarRequest<T>(path: string, init: RequestInit = {}) {
  const config = getGoogleCalendarConfig();
  const accessToken = await getAccessToken();
  const response = await fetch(`${GOOGLE_EVENTS_URL}/${encodeURIComponent(config.calendarId)}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });

  if (response.status === 204) return null as T;

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error?.message || 'Google Calendar request failed.');
  }

  return data as T;
}

async function googleCalendarDelete(path: string) {
  const config = getGoogleCalendarConfig();
  const accessToken = await getAccessToken();
  const response = await fetch(`${GOOGLE_EVENTS_URL}/${encodeURIComponent(config.calendarId)}${path}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.ok || response.status === 404 || response.status === 410) {
    return;
  }

  const data = await response.json().catch(() => ({}));
  throw new Error(data.error?.message || 'Google Calendar request failed.');
}

export async function fetchGoogleCalendarEvents() {
  const timeMin = new Date();
  timeMin.setMonth(timeMin.getMonth() - 1);
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
  });

  const data = await googleCalendarRequest<{ items?: GoogleCalendarEvent[] }>(`/events?${params.toString()}`);
  return data.items || [];
}

function dateTimeMinute(value?: string) {
  return value?.slice(0, 16) || '';
}

function isActiveGoogleEvent(event: GoogleCalendarEvent) {
  return event.id && event.status !== 'cancelled';
}

function isSparkonGeneratedEvent(event: GoogleCalendarEvent) {
  return event.description?.includes(SPARKON_DESCRIPTION_MARKER)
    || Boolean(event.extendedProperties?.private?.[SPARKON_EVENT_ID_PROPERTY]);
}

function googleEventMatchesFallback(event: GoogleCalendarEvent, fallbackEvent?: Partial<GoogleCalendarEvent>) {
  if (!fallbackEvent) return false;
  return event.summary === fallbackEvent.summary
    && dateTimeMinute(event.start?.dateTime) === dateTimeMinute(fallbackEvent.start?.dateTime)
    && dateTimeMinute(event.end?.dateTime) === dateTimeMinute(fallbackEvent.end?.dateTime);
}

function getFallbackSearchWindow(fallbackEvent?: Partial<GoogleCalendarEvent>) {
  const fallbackDateTime = fallbackEvent?.start?.dateTime || fallbackEvent?.end?.dateTime;
  if (!fallbackDateTime) return null;

  const baseDate = new Date(fallbackDateTime);
  if (Number.isNaN(baseDate.getTime())) return null;

  const timeMin = new Date(baseDate.getTime() - 36 * 60 * 60 * 1000);
  const timeMax = new Date(baseDate.getTime() + 36 * 60 * 60 * 1000);
  return { timeMin, timeMax };
}

export async function findGoogleCalendarEvent(
  sparkonEventId?: string,
  fallbackEvent?: Partial<GoogleCalendarEvent>
) {
  if (sparkonEventId) {
    const params = new URLSearchParams({
      privateExtendedProperty: `${SPARKON_EVENT_ID_PROPERTY}=${sparkonEventId}`,
      singleEvents: 'true',
      maxResults: '10',
    });
    const data = await googleCalendarRequest<{ items?: GoogleCalendarEvent[] }>(`/events?${params.toString()}`);
    const activeMatches = (data.items || []).filter(isActiveGoogleEvent);
    const timeMatch = activeMatches.find(event => googleEventMatchesFallback(event, fallbackEvent));
    const exactMatch = timeMatch || activeMatches[0];
    if (exactMatch?.id) return exactMatch.id;
  }

  const searchWindow = getFallbackSearchWindow(fallbackEvent);
  if (!searchWindow) return null;

  const params = new URLSearchParams({
    timeMin: searchWindow.timeMin.toISOString(),
    timeMax: searchWindow.timeMax.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '20',
  });

  if (fallbackEvent?.summary) {
    params.set('q', fallbackEvent.summary);
  }

  const data = await googleCalendarRequest<{ items?: GoogleCalendarEvent[] }>(`/events?${params.toString()}`);
  const fallbackMatch = (data.items || []).find(event => (
    isActiveGoogleEvent(event)
    && isSparkonGeneratedEvent(event)
    && googleEventMatchesFallback(event, fallbackEvent)
  ));

  return fallbackMatch?.id || null;
}

export async function createGoogleCalendarEvent(event: Partial<GoogleCalendarEvent>) {
  const data = await googleCalendarRequest<GoogleCalendarEvent>('/events', {
    method: 'POST',
    body: JSON.stringify(event),
  });
  return data.id;
}

export async function updateGoogleCalendarEvent(eventId: string, event: Partial<GoogleCalendarEvent>) {
  await googleCalendarRequest<GoogleCalendarEvent>(`/events/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    body: JSON.stringify(event),
  });
}

export async function deleteGoogleCalendarEvent(eventId: string) {
  await googleCalendarDelete(`/events/${encodeURIComponent(eventId)}`);
}
