import { NextRequest, NextResponse } from 'next/server';
import { assertSetupSecret, exchangeCodeForRefreshToken } from '@/lib/google-calendar-server';

function html(content: string, status = 200) {
  return new NextResponse(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Google Calendar Setup</title>
    <style>
      body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; padding: 32px; color: #171717; background: #fafafa; }
      main { max-width: 720px; margin: 0 auto; background: white; border: 1px solid #e5e5e5; border-radius: 16px; padding: 24px; box-shadow: 0 12px 40px rgba(0,0,0,.08); }
      h1 { margin-top: 0; font-size: 24px; }
      code { display: block; white-space: pre-wrap; word-break: break-all; background: #f4f4f5; border-radius: 10px; padding: 14px; }
      p { line-height: 1.5; }
    </style>
  </head>
  <body><main>${content}</main></body>
</html>`, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');
    const error = request.nextUrl.searchParams.get('error');

    if (error) {
      return html(`<h1>Google Calendar was not connected</h1><p>${error}</p>`, 400);
    }

    assertSetupSecret(state);
    if (!code) throw new Error('Google did not return an authorization code.');

    const refreshToken = await exchangeCodeForRefreshToken(code, request.nextUrl.origin);

    return html(`
      <h1>Google Calendar is ready</h1>
      <p>This is the one-time permanent connection token for the server. Add it as an environment variable named <strong>GOOGLE_CALENDAR_REFRESH_TOKEN</strong>.</p>
      <code>GOOGLE_CALENDAR_REFRESH_TOKEN=${refreshToken}</code>
      <p>After it is added to the live app environment, Schedule will stay connected to this Google account without reconnecting in the browser.</p>
    `);
  } catch (error) {
    return html(
      `<h1>Google Calendar setup needs attention</h1><p>${error instanceof Error ? error.message : 'Setup failed.'}</p>`,
      400
    );
  }
}
