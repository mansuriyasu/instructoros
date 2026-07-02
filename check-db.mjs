import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const projectId =
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.FIREBASE_PROJECT_ID ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

if (!projectId) {
  throw new Error('Set FIREBASE_PROJECT_ID before running this database check.');
}

initializeApp({
  credential: applicationDefault(),
  projectId
});

const db = getFirestore();
const snapshot = await db.collection('finance_years').get();
console.log(`Found ${snapshot.size} years.`);
snapshot.forEach(doc => console.log(doc.id, '=>', doc.data()));

const snapshotAssets = await db.collection('finance_assets').get();
console.log(`Found ${snapshotAssets.size} assets.`);
snapshotAssets.forEach(doc => console.log(doc.id, '=>', doc.data().name));
