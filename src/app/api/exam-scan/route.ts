import { NextRequest, NextResponse } from 'next/server';
import { extractExamDetailsSafe } from '@/ai/flows/extract-exam-details';
import { requireRateLimitedUser, requestSecurityErrorResponse } from '@/lib/server/request-security';

export async function POST(req: NextRequest) {
  try {
    await requireRateLimitedUser(req, 'exam-scan', 8);
    const { photoDataUri } = await req.json();

    if (typeof photoDataUri !== 'string' || !photoDataUri.startsWith('data:') || photoDataUri.length > 9_500_000) {
      return NextResponse.json({ ok: false, error: 'No photo provided' }, { status: 400 });
    }

    const result = await extractExamDetailsSafe(photoDataUri);

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, details: result.details });
  } catch (error) {
    console.error('Error in /api/exam-scan:', error);
    if (error instanceof Error && error.name === 'RequestSecurityError') {
      return requestSecurityErrorResponse(error, 'Could not extract road-test details.');
    }
    return NextResponse.json({ ok: false, error: 'Internal server error during extraction.' }, { status: 500 });
  }
}
