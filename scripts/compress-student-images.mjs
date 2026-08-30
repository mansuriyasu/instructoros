import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import sharp from 'sharp';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const APPLY = process.argv.includes('--apply');
const MAX_INLINE_LENGTH = 320_000;
const MAX_AVATAR_LENGTH = 70_000;

function getAdminApp() {
  if (getApps().length) return getApps()[0];

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const encodedPrivateKey = process.env.FIREBASE_PRIVATE_KEY_BASE64;
  const resolvedPrivateKey = encodedPrivateKey
    ? Buffer.from(encodedPrivateKey, 'base64').toString('utf8')
    : privateKey;

  if (serviceAccountJson) {
    return initializeApp({ credential: cert(JSON.parse(serviceAccountJson)), projectId });
  }

  if (projectId && clientEmail && resolvedPrivateKey) {
    return initializeApp({
      credential: cert({ projectId, clientEmail, privateKey: resolvedPrivateKey }),
      projectId,
    });
  }

  throw new Error('Firebase Admin credentials are required. Add service account env vars before running this script.');
}

function dataUriToBuffer(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/^data:([^;]+);base64,(.+)$/);
  if (!match || !match[1].startsWith('image/')) return null;
  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  };
}

async function compressImageDataUri(value, maxLength, size = 900) {
  const source = dataUriToBuffer(value);
  if (!source) return value;

  const widths = [size, 760, 620, 520, 440];
  const qualities = [68, 58, 48, 38, 30];

  for (const width of widths) {
    for (const quality of qualities) {
      const buffer = await sharp(source.buffer)
        .rotate()
        .resize({ width, height: width, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();
      const dataUri = `data:image/jpeg;base64,${buffer.toString('base64')}`;
      if (dataUri.length <= maxLength || dataUri.length < value.length) return dataUri;
    }
  }

  return value;
}

const db = getFirestore(getAdminApp());
const tenantsSnap = await db.collection('tenants').get();

let checked = 0;
let changed = 0;
let beforeBytes = 0;
let afterBytes = 0;
const sample = [];

for (const tenantDoc of tenantsSnap.docs) {
  const studentsSnap = await tenantDoc.ref.collection('students').get();
  for (const studentDoc of studentsSnap.docs) {
    checked += 1;
    const student = studentDoc.data();
    const updates = {};
    const beforeLicenseLength = typeof student.licenseImageUrl === 'string' ? student.licenseImageUrl.length : 0;
    const beforeAvatarLength = typeof student.avatarUrl === 'string' ? student.avatarUrl.length : 0;
    let afterLicenseLength = beforeLicenseLength;
    let afterAvatarLength = beforeAvatarLength;

    if (beforeLicenseLength > MAX_INLINE_LENGTH && student.licenseImageUrl.startsWith('data:image/')) {
      updates.licenseImageUrl = await compressImageDataUri(student.licenseImageUrl, MAX_INLINE_LENGTH);
      afterLicenseLength = updates.licenseImageUrl.length;
    }

    if (beforeAvatarLength > MAX_AVATAR_LENGTH && student.avatarUrl.startsWith('data:image/')) {
      updates.avatarUrl = await compressImageDataUri(student.avatarUrl, MAX_AVATAR_LENGTH, 260);
      afterAvatarLength = updates.avatarUrl.length;
    }

    if (Object.keys(updates).length > 0) {
      changed += 1;
      beforeBytes += beforeLicenseLength + beforeAvatarLength;
      afterBytes += afterLicenseLength + afterAvatarLength;
      if (sample.length < 10) {
        sample.push({
          tenantId: tenantDoc.id,
          studentId: studentDoc.id,
          name: student.name || '',
          beforeKB: Math.round((beforeLicenseLength + beforeAvatarLength) / 1024),
          afterKB: Math.round((afterLicenseLength + afterAvatarLength) / 1024),
        });
      }

      if (APPLY) {
        await studentDoc.ref.update({
          ...updates,
          imageOptimizedAt: new Date().toISOString(),
        });
      }
    }
  }
}

console.log(JSON.stringify({
  mode: APPLY ? 'apply' : 'dry-run',
  studentsChecked: checked,
  studentsWithOversizedInlineImages: changed,
  estimatedBeforeMB: Number((beforeBytes / 1024 / 1024).toFixed(2)),
  estimatedAfterMB: Number((afterBytes / 1024 / 1024).toFixed(2)),
  estimatedSavedMB: Number(((beforeBytes - afterBytes) / 1024 / 1024).toFixed(2)),
  sample,
}, null, 2));
