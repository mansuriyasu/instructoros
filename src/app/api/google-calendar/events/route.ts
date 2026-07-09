import { NextRequest, NextResponse } from 'next/server';
import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  findGoogleCalendarEvent,
  fetchGoogleCalendarEvents,
  getUserGoogleCalendarConnection,
  GoogleCalendarTokenError,
  updateGoogleCalendarEvent,
} from '@/lib/google-calendar-server';
import { getAdminAuth } from '@/lib/server/firebase-admin';

function getBearerToken(request: NextRequest) {
  const header = request.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || '';
}

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json(
        { error: 'Please sign in before syncing Google Calendar.' },
        { status: 401 }
      );
    }

    const decoded = await getAdminAuth().verifyIdToken(token);
    const calendarConfig = await getUserGoogleCalendarConnection(decoded.uid);

    if (!calendarConfig) {
      return NextResponse.json(
        { error: 'Connect your Google Calendar before syncing.' },
        { status: 412 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const action = body.action as 'fetch' | 'create' | 'update' | 'delete' | 'find';

    if (action === 'fetch') {
      return NextResponse.json({ items: await fetchGoogleCalendarEvents(calendarConfig) });
    }

    if (action === 'create') {
      const id = await createGoogleCalendarEvent(body.event, calendarConfig);
      return NextResponse.json({ id });
    }

    if (action === 'update') {
      await updateGoogleCalendarEvent(body.eventId, body.event, calendarConfig);
      return NextResponse.json({ ok: true });
    }

    if (action === 'find') {
      const id = await findGoogleCalendarEvent(body.sparkonEventId, body.fallbackEvent, calendarConfig);
      return NextResponse.json({ id });
    }

    if (action === 'delete') {
      await deleteGoogleCalendarEvent(body.eventId, calendarConfig);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown Google Calendar action.' }, { status: 400 });
  } catch (error) {
    if (error instanceof GoogleCalendarTokenError) {
      return NextResponse.json(
        { error: error.message, code: 'GOOGLE_CALENDAR_RECONNECT_REQUIRED' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Google Calendar request failed.' },
      { status: 500 }
    );
  }
}
