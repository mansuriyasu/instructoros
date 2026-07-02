import { NextRequest, NextResponse } from 'next/server';
import {
  assertSetupSecret,
  getGoogleCalendarConfig,
  getGoogleCalendarRedirectUri,
} from '@/lib/google-calendar-server';

const SCOPES = 'https://www.googleapis.com/auth/calendar.events';

export async function GET(request: NextRequest) {
  try {
    const setupSecret = request.nextUrl.searchParams.get('secret');
    assertSetupSecret(setupSecret);

    const config = getGoogleCalendarConfig();
    if (!config.clientId || !config.clientSecret) {
      return NextResponse.json(
        { error: 'Google Calendar client ID or secret is missing on the server.' },
        { status: 412 }
      );
    }

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', config.clientId);
    authUrl.searchParams.set('redirect_uri', getGoogleCalendarRedirectUri(request.nextUrl.origin));
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', SCOPES);
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');
    authUrl.searchParams.set('include_granted_scopes', 'true');
    authUrl.searchParams.set('state', setupSecret || '');

    return NextResponse.redirect(authUrl);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Google Calendar setup failed.' },
      { status: 401 }
    );
  }
}
