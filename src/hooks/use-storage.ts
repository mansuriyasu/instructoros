'use client';

import { useState } from 'react';

const MAX_INLINE_LICENSE_LENGTH = 700_000;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read the selected license file.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not prepare this license image for saving. Please try a JPG or PNG photo.'));
    image.src = src;
  });
}

async function compressLicenseImage(file: File): Promise<string> {
  const sourceDataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(sourceDataUrl);
  const maxDimensions = [1600, 1400, 1200, 1000, 800];
  const qualities = [0.82, 0.72, 0.62, 0.52, 0.42];

  for (const maxDimension of maxDimensions) {
    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not prepare this license image for saving.');
    }

    context.drawImage(image, 0, 0, width, height);

    for (const quality of qualities) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      if (dataUrl.length <= MAX_INLINE_LICENSE_LENGTH) {
        return dataUrl;
      }
    }
  }

  throw new Error('That license image is too large to save. Please try a clearer screenshot or smaller photo.');
}

async function createInlineLicenseFile(file: File): Promise<string> {
  if (file.type.startsWith('image/')) {
    return compressLicenseImage(file);
  }

  const dataUrl = await readFileAsDataUrl(file);
  if (dataUrl.length > MAX_INLINE_LICENSE_LENGTH) {
    throw new Error('That PDF is too large to save with the student record. Please upload a JPG or PNG photo of the license.');
  }
  return dataUrl;
}

export function useStorage() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadLicenseFile = async (studentId: string, file: File): Promise<string> => {
    void studentId;
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const inlineFile = await createInlineLicenseFile(file);
      setUploadProgress(100);
      return inlineFile;
    } finally {
      setIsUploading(false);
    }
  };

  return {
    uploadLicenseFile,
    isUploading,
    uploadProgress
  };
}
