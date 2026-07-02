import { NextResponse } from 'next/server';
import { checkGoogleCalendarConnection, getGoogleCalendarStatus } from '@/lib/google-calendar-server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get('check') === '1') {
    return NextResponse.json(await checkGoogleCalendarConnection());
  }

  return NextResponse.json(getGoogleCalendarStatus());
}
