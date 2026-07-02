import { NextResponse } from 'next/server';
import { extractExamDetailsSafe } from '@/ai/flows/extract-exam-details';

export async function POST(req: Request) {
  try {
    const { photoDataUri } = await req.json();

    if (!photoDataUri) {
      return NextResponse.json({ ok: false, error: 'No photo provided' }, { status: 400 });
    }

    const result = await extractExamDetailsSafe(photoDataUri);

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, details: result.details });
  } catch (error) {
    console.error('Error in /api/exam-scan:', error);
    return NextResponse.json({ ok: false, error: 'Internal server error during extraction.' }, { status: 500 });
  }
}
