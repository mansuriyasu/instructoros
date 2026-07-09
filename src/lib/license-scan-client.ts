'use client';

import { getAuthenticatedHeaders } from '@/lib/authenticated-fetch';

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read the selected image.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('This image format could not be loaded. Please try a JPG or PNG photo.'));
    image.src = src;
  });
}

async function normalizeImageForAi(file: File): Promise<string> {
  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);
  const maxDimension = 1600;
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Could not prepare the image for scanning.');
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.9);
}

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

export type LicenseScanDetails = {
  name: string;
  address: string;
  birthdate: string;
  licenseNumber: string;
  licenseExpiry: string;
  avatarUrl?: string;
};

export async function prepareLicenseFileForAi(file: File): Promise<string> {
  if (isImageFile(file)) {
    const normalizedImage = await normalizeImageForAi(file);
    if (normalizedImage.length > 9_000_000) {
      throw new Error('That file is too large to scan. Please try a smaller photo or screenshot of the license.');
    }
    return normalizedImage;
  }

  const dataUrl = await readFileAsDataUrl(file);
  if (dataUrl.length > 9_000_000) {
    throw new Error('That file is too large to scan. Please try a smaller photo or screenshot of the license.');
  }
  return dataUrl;
}

export function getScanErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/unsupported mime|image format|could not be loaded|invalid image/i.test(message)) {
    return 'That file format is not supported. Please try a clear JPG, PNG, or PDF copy of the license.';
  }
  if (/api key|permission|unauthorized|forbidden/i.test(message)) {
    return 'The AI service is not authorized. Please check the Gemini API key.';
  }
  if (/quota|rate limit|resource exhausted/i.test(message)) {
    return 'The AI service is temporarily rate limited. Please try again shortly.';
  }
  if (/too large|payload|body|request entity/i.test(message)) {
    return 'That file is too large to scan. Please try a smaller photo or screenshot of the license.';
  }
  return message || 'Could not extract details from the image. Please enter them manually.';
}

export async function scanLicenseFile(licenseFile: string): Promise<LicenseScanDetails> {
  const response = await fetch('/api/license-scan', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(await getAuthenticatedHeaders()),
    },
    body: JSON.stringify({ licenseFile }),
  });

  const result = await response.json();
  if (!response.ok || !result.ok) {
    throw new Error(result.error || 'Could not extract details from the image. Please enter them manually.');
  }

  return result.details as LicenseScanDetails;
}
