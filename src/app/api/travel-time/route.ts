import { NextRequest, NextResponse } from 'next/server';
import { estimateTravelTimeSafe } from '@/ai/flows/estimate-travel-time';
import { requireRateLimitedUser, requestSecurityErrorResponse } from '@/lib/server/request-security';

export async function POST(req: NextRequest) {
  try {
    await requireRateLimitedUser(req, 'travel-time', 30);
    const { origin, destination } = await req.json();

    if (typeof origin !== 'string' || typeof destination !== 'string' || !origin.trim() || !destination.trim() || origin.length > 500 || destination.length > 500) {
      return NextResponse.json({ ok: false, error: 'Origin and destination are required.' }, { status: 400 });
    }

    const result = await estimateTravelTimeSafe(origin, destination);

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, details: result.details });
  } catch (error) {
    console.error('Error in /api/travel-time:', error);
    if (error instanceof Error && error.name === 'RequestSecurityError') {
      return requestSecurityErrorResponse(error, 'Could not calculate travel time.');
    }
    return NextResponse.json({ ok: false, error: 'Internal server error during calculation.' }, { status: 500 });
  }
}
