import { NextRequest, NextResponse } from 'next/server';
import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  findGoogleCalendarEvent,
  fetchGoogleCalendarEvents,
  getGoogleCalendarStatus,
  GoogleCalendarTokenError,
  updateGoogleCalendarEvent,
} from '@/lib/google-calendar-server';

export async function POST(request: NextRequest) {
  try {
    if (!getGoogleCalendarStatus().configured) {
      return NextResponse.json(
        { error: 'Google Calendar permanent connection is not configured.' },
        { status: 412 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const action = body.action as 'fetch' | 'create' | 'update' | 'delete' | 'find';

    if (action === 'fetch') {
      return NextResponse.json({ items: await fetchGoogleCalendarEvents() });
    }

    if (action === 'create') {
      const id = await createGoogleCalendarEvent(body.event);
      return NextResponse.json({ id });
    }

    if (action === 'update') {
      await updateGoogleCalendarEvent(body.eventId, body.event);
      return NextResponse.json({ ok: true });
    }

    if (action === 'find') {
      const id = await findGoogleCalendarEvent(body.sparkonEventId, body.fallbackEvent);
      return NextResponse.json({ id });
    }

    if (action === 'delete') {
      await deleteGoogleCalendarEvent(body.eventId);
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
