import { NextResponse } from 'next/server';

const disabledResponse = () => NextResponse.json(
  { ok: false, error: 'Availability is now managed from the verified Student Portal account.' },
  { status: 410 },
);

export async function GET() {
  return disabledResponse();
}

export async function POST() {
  return disabledResponse();
}
