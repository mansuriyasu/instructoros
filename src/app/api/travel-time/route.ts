import { NextResponse } from 'next/server';
import { estimateTravelTimeSafe } from '@/ai/flows/estimate-travel-time';

export async function POST(req: Request) {
  try {
    const { origin, destination } = await req.json();

    if (!origin || !destination) {
      return NextResponse.json({ ok: false, error: 'Origin and destination are required.' }, { status: 400 });
    }

    const result = await estimateTravelTimeSafe(origin, destination);

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, details: result.details });
  } catch (error) {
    console.error('Error in /api/travel-time:', error);
    return NextResponse.json({ ok: false, error: 'Internal server error during calculation.' }, { status: 500 });
  }
}
