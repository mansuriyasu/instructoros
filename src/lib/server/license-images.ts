import sharp from 'sharp';

const MAX_INLINE_LICENSE_LENGTH = 700_000;

export function dataUriToBuffer(dataUri: string) {
  const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  };
}

export async function createEnhancedFaceThumbnail(licenseFile: string, faceBoundingBox?: number[]) {
  if (!faceBoundingBox || faceBoundingBox.length !== 4) return '';

  const source = dataUriToBuffer(licenseFile);
  if (!source || !source.mimeType.startsWith('image/')) return '';

  try {
    const normalizedBuffer = await sharp(source.buffer).rotate().toBuffer();
    const image = sharp(normalizedBuffer);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) return '';

    const [ymin, xmin, ymax, xmax] = faceBoundingBox.map(value =>
      Math.max(0, Math.min(1000, Number(value) || 0))
    );

    const left = Math.floor((xmin / 1000) * metadata.width);
    const top = Math.floor((ymin / 1000) * metadata.height);
    const width = Math.max(1, Math.floor(((xmax - xmin) / 1000) * metadata.width));
    const height = Math.max(1, Math.floor(((ymax - ymin) / 1000) * metadata.height));

    if (width <= 1 || height <= 1) return '';

    const centerX = left + width / 2;
    const centerY = top + height / 2;
    const squareSize = Math.max(width * 1.9, height * 1.95, 140);
    const extractLeft = Math.max(0, Math.floor(centerX - squareSize / 2));
    const extractTop = Math.max(0, Math.floor(centerY - squareSize / 2));
    const extractSize = Math.floor(
      Math.min(squareSize, metadata.width - extractLeft, metadata.height - extractTop)
    );

    if (extractSize <= 1) return '';

    const croppedBuffer = await image
      .extract({ left: extractLeft, top: extractTop, width: extractSize, height: extractSize })
      .resize(360, 360, {
        fit: 'cover',
        kernel: sharp.kernel.lanczos3,
      })
      .flatten({ background: '#ffffff' })
      .normalise()
      .modulate({ brightness: 1.04, saturation: 1.06 })
      .sharpen({ sigma: 1.05 })
      .jpeg({ quality: 86, mozjpeg: true })
      .toBuffer();

    return `data:image/jpeg;base64,${croppedBuffer.toString('base64')}`;
  } catch (error) {
    console.error('Failed to create enhanced license face thumbnail:', error);
    return '';
  }
}

export async function createStoredLicenseImage(licenseFile: string) {
  const source = dataUriToBuffer(licenseFile);
  if (!source) return '';

  if (!source.mimeType.startsWith('image/')) {
    return licenseFile.length <= MAX_INLINE_LICENSE_LENGTH ? licenseFile : '';
  }

  const widths = [1400, 1200, 1000, 850, 700];
  const qualities = [78, 70, 62, 54, 46];

  for (const width of widths) {
    for (const quality of qualities) {
      const buffer = await sharp(source.buffer)
        .rotate()
        .resize({ width, height: width, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();
      const dataUri = `data:image/jpeg;base64,${buffer.toString('base64')}`;
      if (dataUri.length <= MAX_INLINE_LICENSE_LENGTH) {
        return dataUri;
      }
    }
  }

  return '';
}
