import { NextRequest, NextResponse } from 'next/server';
import { optimizeDailyRouteSafe } from '@/ai/flows/optimize-route';
import { requireRateLimitedUser, requestSecurityErrorResponse } from '@/lib/server/request-security';

export async function POST(req: NextRequest) {
  try {
    await requireRateLimitedUser(req, 'route-optimization', 10);
    const { events, startAddress } = await req.json();

    if (!events || !Array.isArray(events) || events.length === 0 || events.length > 25) {
      return NextResponse.json({ ok: false, error: 'A list of events is required.' }, { status: 400 });
    }

    const result = await optimizeDailyRouteSafe(events, startAddress);

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, details: result.details });
  } catch (error) {
    console.error('Error in /api/optimize-route:', error);
    if (error instanceof Error && error.name === 'RequestSecurityError') {
      return requestSecurityErrorResponse(error, 'Could not optimize this route.');
    }
    return NextResponse.json({ ok: false, error: 'Internal server error during optimization.' }, { status: 500 });
  }
}
