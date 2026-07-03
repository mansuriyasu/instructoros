import { NextRequest, NextResponse } from 'next/server';
import { createStudentViaFirebaseRest } from '@/lib/server/firebase-rest';
import { createEnhancedFaceThumbnail, createStoredLicenseImage } from '@/lib/server/license-images';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 9 * 1024 * 1024;

function unauthorized() {
  return NextResponse.json(
    { ok: false, error: 'Shortcut is not authorized.' },
    { status: 401 }
  );
}

function getShortcutSecret(request: NextRequest) {
  return (
    request.headers.get('x-sparkon-shortcut-secret') ||
    request.nextUrl.searchParams.get('secret') ||
    ''
  );
}

function getAppOrigin(request: NextRequest) {
  return (process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin).replace(/\/$/, '');
}

function getFileFromForm(formData: FormData) {
  const file =
    formData.get('license') ||
    formData.get('file') ||
    formData.get('image');

  return file instanceof File ? file : null;
}

async function fileToDataUri(file: File) {
  const bytes = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || 'image/jpeg';
  return `data:${mimeType};base64,${bytes.toString('base64')}`;
}

export async function POST(request: NextRequest) {
  const configuredSecret = process.env.SHORTCUT_SECRET;

  if (!configuredSecret) {
    return NextResponse.json(
      { ok: false, error: 'Shortcut secret is not configured on the server.' },
      { status: 500 }
    );
  }

  if (getShortcutSecret(request) !== configuredSecret) {
    return unauthorized();
  }

  try {
    const contentType = request.headers.get('content-type') || '';
    if (
      !contentType.includes('multipart/form-data') &&
      !contentType.includes('application/x-www-form-urlencoded')
    ) {
      return NextResponse.json(
        { ok: false, error: 'Please send the licence as a form file named license.' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const tenantId =
      (formData.get('tenantId') instanceof File ? '' : String(formData.get('tenantId') || '')) ||
      request.nextUrl.searchParams.get('tenantId') ||
      '';
    const file = getFileFromForm(formData);

    if (!file) {
      return NextResponse.json(
        { ok: false, error: 'Please share one licence photo or PDF.' },
        { status: 400 }
      );
    }

    if (!tenantId) {
      return NextResponse.json(
        { ok: false, error: 'Please include your InstructorOS workspace id as tenantId.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { ok: false, error: 'That file is too large. Please share a smaller licence photo.' },
        { status: 413 }
      );
    }

    const licenseFile = await fileToDataUri(file);
    const { extractLicenseDetailsSafe } = await import('@/ai/flows/extract-license-details');
    const scanResult = await extractLicenseDetailsSafe(licenseFile);

    if (!scanResult.ok) {
      return NextResponse.json(
        { ok: false, error: scanResult.error },
        { status: 422 }
      );
    }

    const details = scanResult.details;
    const [avatarUrl, licenseImageUrl] = await Promise.all([
      createEnhancedFaceThumbnail(licenseFile, details.faceBoundingBox),
      createStoredLicenseImage(licenseFile),
    ]);

    const studentData: any = {
      name: details.name || 'New Student',
      mobileNumber: '',
      address: details.address || '',
      birthdate: details.birthdate || '',
      licenseNumber: details.licenseNumber || '',
      licenseExpiry: details.licenseExpiry || '',
      licenseType: 'G2',
      comments: 'Added from iPhone Shortcut. Please review details.',
      registrationDate: new Date().toISOString(),
      status: 'active',
    };
    if (avatarUrl) {
      studentData.avatarUrl = avatarUrl;
    }
    if (licenseImageUrl) {
      studentData.licenseImageUrl = licenseImageUrl;
    }
    const studentId = await createStudentViaFirebaseRest(studentData, tenantId);

    return NextResponse.json({
      ok: true,
      studentId,
      student: studentData,
      editUrl: `${getAppOrigin(request)}/students/form?id=${studentId}`,
      message: `Student added: ${studentData.name}`,
    });
  } catch (error) {
    console.error('Shortcut license scan failed:', error);
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Could not add student from shortcut.',
      },
      { status: 500 }
    );
  }
}
