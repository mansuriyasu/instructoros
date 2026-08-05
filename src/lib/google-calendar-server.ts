import type { GoogleCalendarEvent } from '@/hooks/use-google-calendar';
import crypto from 'crypto';
import { getAdminFirestore } from '@/lib/server/firebase-admin';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars';
const SPARKON_EVENT_ID_PROPERTY = 'sparkonEventId';
const SPARKON_DESCRIPTION_MARKER = 'Synced from InstructorOS.';
const GOOGLE_CALENDAR_SCOPES = 'https://www.googleapis.com/auth/calendar.events';
const GOOGLE_REQUEST_TIMEOUT_MS = 12000;
const GOOGLE_RETRY_DELAYS_MS = [350, 900];

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
  connectedEmail?: string;
};

type UserCalendarState = {
  uid: string;
  email?: string;
  returnTo?: string;
  createdAt: number;
};

type UserCalendarConnection = {
  refreshToken?: string;
  calendarId?: string;
  connectedEmail?: string;
};

const cachedAccessTokens = new Map<string, { token: string; expiresAt: number }>();

export class GoogleCalendarTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleCalendarTokenError';
  }
}

type GoogleCalendarHttpError = Error & { status?: number };

function getGoogleCalendarErrorStatus(error: unknown) {
  return typeof error === 'object' && error !== null && 'status' in error
    ? (error as GoogleCalendarHttpError).status
    : undefined;
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

function getStateSecret() {
  return process.env.GOOGLE_CALENDAR_STATE_SECRET
    || '';
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signState(payload: string) {
  const secret = getStateSecret();
  if (!secret) {
    throw new Error('Google Calendar state secret is not configured.');
  }
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createUserCalendarState(state: Omit<UserCalendarState, 'createdAt'>) {
  const payload = base64UrlEncode(JSON.stringify({ ...state, createdAt: Date.now() }));
  return `${payload}.${signState(payload)}`;
}

export function parseUserCalendarState(rawState: string | null): UserCalendarState | null {
  if (!rawState || !rawState.includes('.')) return null;
  const [payload, signature] = rawState.split('.');
  if (!payload || !signature || signState(payload) !== signature) return null;

  const state = JSON.parse(base64UrlDecode(payload)) as UserCalendarState;
  const isFresh = Date.now() - state.createdAt < 15 * 60 * 1000;
  return state.uid && isFresh ? state : null;
}

export function getGoogleCalendarStatus() {
  const config = getGoogleCalendarConfig();
  return {
    // The production flow stores one OAuth refresh token per signed-in user.
    // A server-wide refresh token is optional legacy configuration and must not
    // prevent users from connecting their own Google Calendar.
    configured: Boolean(config.clientId && config.clientSecret),
    clientIdConfigured: Boolean(config.clientId),
    clientSecretConfigured: Boolean(config.clientSecret),
    refreshTokenConfigured: Boolean(config.refreshToken),
    calendarId: config.calendarId,
  };
}

export function getGoogleCalendarRedirectUri(origin: string) {
  return `${origin}/api/google-calendar/callback`;
}

export function getGoogleCalendarAppOrigin(fallbackOrigin: string) {
  return (process.env.NEXT_PUBLIC_APP_URL || fallbackOrigin).replace(/\/$/, '');
}

export function createUserGoogleCalendarAuthUrl(params: {
  uid: string;
  email?: string;
  origin: string;
  returnTo?: string;
  forceAccountSelection?: boolean;
}) {
  const config = getGoogleCalendarConfig();
  if (!config.clientId || !config.clientSecret) {
    throw new Error('Google Calendar client ID or secret is missing.');
  }

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', config.clientId);
  authUrl.searchParams.set('redirect_uri', getGoogleCalendarRedirectUri(params.origin));
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', GOOGLE_CALENDAR_SCOPES);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', params.forceAccountSelection ? 'consent select_account' : 'consent');
  authUrl.searchParams.set('include_granted_scopes', 'true');
  authUrl.searchParams.set('state', createUserCalendarState({
    uid: params.uid,
    email: params.email,
    returnTo: params.returnTo || '/app/schedule',
  }));

  return authUrl.toString();
}

export function assertSetupSecret(secret: string | null) {
  const expectedSecret = process.env.GOOGLE_CALENDAR_SETUP_SECRET;
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

export async function saveUserGoogleCalendarConnection(uid: string, connection: UserCalendarConnection) {
  await getAdminFirestore()
    .collection('users')
    .doc(uid)
    .collection('integrations')
    .doc('googleCalendar')
    .set({
      refreshToken: connection.refreshToken,
      calendarId: connection.calendarId || 'primary',
      connectedEmail: connection.connectedEmail || '',
      connectedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });
}

export async function getUserGoogleCalendarConnection(uid: string): Promise<CalendarConfig | null> {
  const config = getGoogleCalendarConfig();
  if (!config.clientId || !config.clientSecret) return null;

  const snapshot = await getAdminFirestore()
    .collection('users')
    .doc(uid)
    .collection('integrations')
    .doc('googleCalendar')
    .get();

  if (!snapshot.exists) return null;

  const connection = snapshot.data() as UserCalendarConnection;
  if (!connection.refreshToken) return null;

  return {
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    refreshToken: connection.refreshToken,
    calendarId: connection.calendarId || 'primary',
    connectedEmail: connection.connectedEmail || '',
  };
}

export async function deleteUserGoogleCalendarConnection(uid: string) {
  await getAdminFirestore()
    .collection('users')
    .doc(uid)
    .collection('integrations')
    .doc('googleCalendar')
    .delete();
  cachedAccessTokens.delete(uid);
}

export async function checkUserGoogleCalendarConnection(uid: string) {
  const baseStatus = getGoogleCalendarStatus();
  if (!baseStatus.clientIdConfigured || !baseStatus.clientSecretConfigured) {
    return {
      ...baseStatus,
      configured: false,
      connected: false,
      error: 'Google Calendar OAuth client ID or secret is not configured on the server.',
    };
  }

  const connection = await getUserGoogleCalendarConnection(uid);
  if (!connection) {
    return {
      ...baseStatus,
      configured: true,
      refreshTokenConfigured: false,
      connected: false,
      error: 'Connect your Google Calendar before syncing.',
    };
  }

  try {
    await getAccessToken(connection);
    return {
      ...baseStatus,
      configured: true,
      refreshTokenConfigured: true,
      calendarId: connection.calendarId,
      connectedEmail: connection.connectedEmail || null,
      connected: true,
      error: null,
    };
  } catch (error) {
    return {
      ...baseStatus,
      configured: true,
      refreshTokenConfigured: true,
      calendarId: connection.calendarId,
      connected: false,
      error: error instanceof Error ? error.message : 'Google Calendar connection failed.',
    };
  }
}

async function getAccessToken(config = getGoogleCalendarConfig()) {
  if (!config.clientId || !config.clientSecret || !config.refreshToken) {
    throw new Error('Google Calendar permanent connection is not configured.');
  }

  const cacheKey = config.refreshToken;
  const cachedAccessToken = cachedAccessTokens.get(cacheKey);
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
    cachedAccessTokens.delete(cacheKey);
    if (isInvalidRefreshTokenError(data)) {
      throw new GoogleCalendarTokenError('Google Calendar connection expired or was revoked. Reconnect Google Calendar and replace GOOGLE_CALENDAR_REFRESH_TOKEN on the server.');
    }
    throw new Error(data.error_description || data.error || 'Could not refresh Google Calendar access.');
  }

  cachedAccessTokens.set(cacheKey, {
    token: data.access_token,
    expiresAt: Date.now() + Math.max((data.expires_in || 3600) - 60, 60) * 1000,
  });

  return data.access_token;
}

export async function checkGoogleCalendarConnection() {
  const status = getGoogleCalendarStatus();
  if (!status.clientIdConfigured || !status.clientSecretConfigured) {
    return {
      ...status,
      connected: false,
      error: 'Google Calendar OAuth client ID or secret is not configured on the server.',
    };
  }

  if (!status.refreshTokenConfigured) {
    return {
      ...status,
      connected: false,
      error: 'Per-user Google Calendar connection is configured. Connect a user account before syncing.',
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

async function googleCalendarRequest<T>(path: string, init: RequestInit = {}, config = getGoogleCalendarConfig()) {
  let accessToken = await getAccessToken(config);
  const method = (init.method || 'GET').toUpperCase();
  const canRetry = method === 'GET' || method === 'PATCH';
  let lastError: unknown;

  for (let attempt = 0; attempt <= (canRetry ? GOOGLE_RETRY_DELAYS_MS.length : 0); attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GOOGLE_REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${GOOGLE_EVENTS_URL}/${encodeURIComponent(config.calendarId)}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          ...init.headers,
        },
      });

      if (response.status === 401 && attempt < GOOGLE_RETRY_DELAYS_MS.length) {
        cachedAccessTokens.delete(config.refreshToken || '');
        accessToken = await getAccessToken(config);
        continue;
      }

      if (response.status >= 500 && attempt < GOOGLE_RETRY_DELAYS_MS.length && canRetry) {
        await new Promise(resolve => setTimeout(resolve, GOOGLE_RETRY_DELAYS_MS[attempt]));
        continue;
      }

      if (response.status === 204) return null as T;

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(data.error?.message || 'Google Calendar request failed.') as GoogleCalendarHttpError;
        error.status = response.status;
        throw error;
      }

      return data as T;
    } catch (error) {
      lastError = error instanceof DOMException && error.name === 'AbortError'
        ? new Error('Google Calendar request timed out.')
        : error;
      if (attempt >= GOOGLE_RETRY_DELAYS_MS.length || !canRetry) throw lastError;
      await new Promise(resolve => setTimeout(resolve, GOOGLE_RETRY_DELAYS_MS[attempt]));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Google Calendar request failed.');
}

async function googleCalendarDelete(path: string, config = getGoogleCalendarConfig()) {
  let accessToken = await getAccessToken(config);
  for (let attempt = 0; attempt <= GOOGLE_RETRY_DELAYS_MS.length; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GOOGLE_REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${GOOGLE_EVENTS_URL}/${encodeURIComponent(config.calendarId)}${path}`, {
        method: 'DELETE',
        signal: controller.signal,
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (response.status === 401 && attempt < GOOGLE_RETRY_DELAYS_MS.length) {
        cachedAccessTokens.delete(config.refreshToken || '');
        accessToken = await getAccessToken(config);
        continue;
      }

      if (response.ok || response.status === 404 || response.status === 410) return;
      if (response.status >= 500 && attempt < GOOGLE_RETRY_DELAYS_MS.length) {
        await new Promise(resolve => setTimeout(resolve, GOOGLE_RETRY_DELAYS_MS[attempt]));
        continue;
      }

      const data = await response.json().catch(() => ({}));
      const error = new Error(data.error?.message || 'Google Calendar request failed.') as GoogleCalendarHttpError;
      error.status = response.status;
      throw error;
    } catch (error) {
      if (attempt >= GOOGLE_RETRY_DELAYS_MS.length) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw new Error('Google Calendar request timed out.');
        }
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, GOOGLE_RETRY_DELAYS_MS[attempt]));
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export async function fetchGoogleCalendarEvents(
  config?: CalendarConfig,
  range?: { timeMin?: Date; timeMax?: Date },
) {
  const defaultTimeMin = new Date();
  defaultTimeMin.setMonth(defaultTimeMin.getMonth() - 1);
  const params = new URLSearchParams({
    timeMin: (range?.timeMin || defaultTimeMin).toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '2500',
  });
  if (range?.timeMax) params.set('timeMax', range.timeMax.toISOString());

  const items: GoogleCalendarEvent[] = [];
  let pageToken: string | undefined;
  let pageCount = 0;
  do {
    if (pageToken) params.set('pageToken', pageToken);
    const data = await googleCalendarRequest<{ items?: GoogleCalendarEvent[]; nextPageToken?: string }>(`/events?${params.toString()}`, {}, config);
    items.push(...(data.items || []));
    pageToken = data.nextPageToken;
    pageCount += 1;
  } while (pageToken && pageCount < 10);

  return items;
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
  fallbackEvent?: Partial<GoogleCalendarEvent>,
  config?: CalendarConfig
) {
  if (sparkonEventId) {
    const params = new URLSearchParams({
      privateExtendedProperty: `${SPARKON_EVENT_ID_PROPERTY}=${sparkonEventId}`,
      singleEvents: 'true',
      maxResults: '10',
    });
    const data = await googleCalendarRequest<{ items?: GoogleCalendarEvent[] }>(`/events?${params.toString()}`, {}, config);
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

  const data = await googleCalendarRequest<{ items?: GoogleCalendarEvent[] }>(`/events?${params.toString()}`, {}, config);
  const fallbackMatch = (data.items || []).find(event => (
    isActiveGoogleEvent(event)
    && isSparkonGeneratedEvent(event)
    && googleEventMatchesFallback(event, fallbackEvent)
  ));

  return fallbackMatch?.id || null;
}

export async function createGoogleCalendarEvent(event: Partial<GoogleCalendarEvent>, config?: CalendarConfig) {
  const data = await googleCalendarRequest<GoogleCalendarEvent>('/events', {
    method: 'POST',
    body: JSON.stringify(event),
  }, config);
  return data.id;
}

export async function updateGoogleCalendarEvent(eventId: string, event: Partial<GoogleCalendarEvent>, config?: CalendarConfig) {
  await googleCalendarRequest<GoogleCalendarEvent>(`/events/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    body: JSON.stringify(event),
  }, config);
}

export async function deleteGoogleCalendarEvent(eventId: string, config?: CalendarConfig) {
  await googleCalendarDelete(`/events/${encodeURIComponent(eventId)}`, config);
}

export type GoogleCalendarSyncEntry = {
  localId: string;
  googleEventId?: string;
  event: Partial<GoogleCalendarEvent>;
};

export type GoogleCalendarSyncResult = {
  localId: string;
  googleEventId?: string;
  action?: 'created' | 'updated';
  error?: string;
};

/**
 * Reconciles a schedule in one authenticated server request. Keeping the
 * Google API work server-side avoids a long chain of browser requests and
 * makes imported schedules idempotent when an old Google event ID is stale.
 */
export async function syncGoogleCalendarEvents(
  entries: GoogleCalendarSyncEntry[],
  config?: CalendarConfig,
) {
  const calendarConfig = config || getGoogleCalendarConfig();
  await getAccessToken(calendarConfig);

  const entriesWithoutIds = entries.filter(entry => !entry.googleEventId);
  const existingGoogleEventsPromise: Promise<GoogleCalendarEvent[] | null> = entriesWithoutIds.length > 0
    ? (async () => {
      const timestamps = entriesWithoutIds.flatMap(entry => [entry.event.start?.dateTime, entry.event.end?.dateTime])
        .map(value => value ? new Date(value).getTime() : Number.NaN)
        .filter(value => Number.isFinite(value));
      const timeMin = timestamps.length ? new Date(Math.min(...timestamps) - 24 * 60 * 60 * 1000) : undefined;
      const timeMax = timestamps.length ? new Date(Math.max(...timestamps) + 24 * 60 * 60 * 1000) : undefined;
      const lookup = fetchGoogleCalendarEvents(calendarConfig, { timeMin, timeMax });
      const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), 5000));
      return Promise.race([lookup, timeout]);
    })()
    : Promise.resolve([]);

  const claimedGoogleEventIds = new Set<string>();

  const findExistingEventId = (entry: GoogleCalendarSyncEntry, existingGoogleEvents: GoogleCalendarEvent[]) => {
    const existingBySparkonId = new Map<string, string>();
    for (const event of existingGoogleEvents) {
      const localId = event.extendedProperties?.private?.[SPARKON_EVENT_ID_PROPERTY];
      if (localId && event.id && isActiveGoogleEvent(event)) existingBySparkonId.set(localId, event.id);
    }
    const markedId = existingBySparkonId.get(entry.localId);
    if (markedId && !claimedGoogleEventIds.has(markedId)) return markedId;

    const fallbackEvent = entry.event;
    const fallbackId = existingGoogleEvents.find(event => (
      event.id
      && !claimedGoogleEventIds.has(event.id)
      && isSparkonGeneratedEvent(event)
      && googleEventMatchesFallback(event, fallbackEvent)
    ))?.id;
    return fallbackId || null;
  };

  const results: GoogleCalendarSyncResult[] = [];
  let nextIndex = 0;
  const workerCount = Math.min(4, Math.max(entries.length, 1));

  const syncEntry = async (entry: GoogleCalendarSyncEntry) => {
    let googleEventId = entry.googleEventId;
    const hadKnownGoogleEventId = Boolean(googleEventId);
    let action: 'created' | 'updated' = 'updated';

    if (googleEventId) {
      try {
        await updateGoogleCalendarEvent(googleEventId, entry.event, calendarConfig);
      } catch (error) {
        const status = getGoogleCalendarErrorStatus(error);
        if (status !== 404 && status !== 410) throw error;
        // The event was deleted in Google Calendar. Recreate it and repair the
        // local mapping instead of leaving future edits permanently broken.
        googleEventId = undefined;
      }
    }

    if (!googleEventId) {
      const existingGoogleEvents = await existingGoogleEventsPromise;
      if (!existingGoogleEvents && !hadKnownGoogleEventId) {
        throw new Error('Google Calendar lookup timed out; no duplicate event was created. Try sync again later.');
      }

      const matchedGoogleEventId = findExistingEventId(entry, existingGoogleEvents || []);
      if (matchedGoogleEventId) {
        googleEventId = matchedGoogleEventId;
        claimedGoogleEventIds.add(googleEventId);
        await updateGoogleCalendarEvent(googleEventId, entry.event, calendarConfig);
      } else {
        googleEventId = await createGoogleCalendarEvent(entry.event, calendarConfig);
        action = 'created';
      }
    }

    results.push({ localId: entry.localId, googleEventId, action });
  };

  const worker = async () => {
    while (nextIndex < entries.length) {
      const entry = entries[nextIndex];
      nextIndex += 1;
      try {
        await syncEntry(entry);
      } catch (error) {
        results.push({
          localId: entry.localId,
          error: error instanceof Error ? error.message : 'Google Calendar event sync failed.',
        });
      }
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results.sort((a, b) => a.localId.localeCompare(b.localId));
}
