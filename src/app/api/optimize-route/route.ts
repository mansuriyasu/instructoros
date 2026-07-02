import { NextResponse } from 'next/server';
import { optimizeDailyRouteSafe } from '@/ai/flows/optimize-route';

export async function POST(req: Request) {
  try {
    const { events, startAddress } = await req.json();

    if (!events || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ ok: false, error: 'A list of events is required.' }, { status: 400 });
    }

    const result = await optimizeDailyRouteSafe(events, startAddress);

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, details: result.details });
  } catch (error) {
    console.error('Error in /api/optimize-route:', error);
    return NextResponse.json({ ok: false, error: 'Internal server error during optimization.' }, { status: 500 });
  }
}
