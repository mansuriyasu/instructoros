import { NextRequest, NextResponse } from 'next/server';
import { requireRateLimitedUser, requestSecurityErrorResponse } from '@/lib/server/request-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_DATA_URI_LENGTH = 9_500_000;

export async function POST(request: NextRequest) {
  try {
    await requireRateLimitedUser(request, 'receipt-scan', 12);
    const { receiptFile } = (await request.json()) as { receiptFile?: unknown };

    if (typeof receiptFile !== 'string' || !receiptFile.startsWith('data:')) {
      return NextResponse.json(
        { ok: false, error: 'Please send a receipt image to scan.' },
        { status: 400 }
      );
    }

    if (receiptFile.length > MAX_DATA_URI_LENGTH) {
      return NextResponse.json(
        { ok: false, error: 'That receipt is too large to scan. Please try a smaller photo or screenshot.' },
        { status: 413 }
      );
    }

    const { extractReceiptExpenseSafe } = await import('@/ai/flows/extract-receipt-expense');
    const result = await extractReceiptExpenseSafe(receiptFile);

    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch (error) {
    console.error('Receipt scan API failed:', error);
    if (error instanceof Error && error.name === 'RequestSecurityError') {
      return requestSecurityErrorResponse(error, 'Could not scan the receipt.');
    }
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Could not scan the receipt.',
      },
      { status: 500 }
    );
  }
}
