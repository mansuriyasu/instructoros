import { NextRequest, NextResponse } from 'next/server';
import { createEnhancedFaceThumbnail } from '@/lib/server/license-images';
import { requireRateLimitedUser, requestSecurityErrorResponse } from '@/lib/server/request-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_DATA_URI_LENGTH = 9_500_000;

export async function POST(request: NextRequest) {
  try {
    await requireRateLimitedUser(request, 'license-scan', 8);
    const { licenseFile } = (await request.json()) as { licenseFile?: unknown };

    if (typeof licenseFile !== 'string' || !licenseFile.startsWith('data:')) {
      return NextResponse.json(
        { ok: false, error: 'Please send a licence image or PDF to scan.' },
        { status: 400 }
      );
    }

    if (licenseFile.length > MAX_DATA_URI_LENGTH) {
      return NextResponse.json(
        { ok: false, error: 'That file is too large to scan. Please try a smaller photo or screenshot of the license.' },
        { status: 413 }
      );
    }

    const { extractLicenseDetailsSafe } = await import('@/ai/flows/extract-license-details');
    const result = await extractLicenseDetailsSafe(licenseFile);

    if (result.ok) {
      const avatarUrl = await createEnhancedFaceThumbnail(licenseFile, result.details.faceBoundingBox);
      return NextResponse.json(
        { ok: true, details: { ...result.details, avatarUrl: avatarUrl || undefined } },
        { status: 200 }
      );
    }

    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch (error) {
    console.error('License scan API failed:', error);
    if (error instanceof Error && (error.name === 'RequestSecurityError')) {
      return requestSecurityErrorResponse(error, 'Could not scan the licence.');
    }
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Could not scan the licence.',
      },
      { status: 500 }
    );
  }
}
