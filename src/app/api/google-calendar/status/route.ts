import { NextResponse } from 'next/server';
import { checkGoogleCalendarConnection, checkUserGoogleCalendarConnection, getGoogleCalendarStatus } from '@/lib/google-calendar-server';
import { getAdminAuth } from '@/lib/server/firebase-admin';

function getBearerToken(request: Request) {
  const header = request.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || '';
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = getBearerToken(request);
  if (token) {
    try {
      const decoded = await getAdminAuth().verifyIdToken(token);
      return NextResponse.json(await checkUserGoogleCalendarConnection(decoded.uid));
    } catch (error) {
      return NextResponse.json({
        ...getGoogleCalendarStatus(),
        configured: false,
        connected: false,
        error: error instanceof Error ? error.message : 'Could not check your Google Calendar connection.',
      });
    }
  }

  if (url.searchParams.get('check') === '1') {
    return NextResponse.json(await checkGoogleCalendarConnection());
  }

  return NextResponse.json(getGoogleCalendarStatus());
}
