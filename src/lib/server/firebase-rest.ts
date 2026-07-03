import { firebaseConfig } from '@/firebase/config';

const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`;

type FirebaseAnonymousAuthResponse = {
  idToken?: string;
  error?: {
    message?: string;
  };
};

type FirestoreCreateResponse = {
  name?: string;
  error?: {
    message?: string;
  };
};

function toFirestoreFields(data: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      { stringValue: value },
    ])
  );
}

async function getAnonymousFirebaseIdToken() {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnSecureToken: true }),
      cache: 'no-store',
    }
  );
  const payload = (await response.json()) as FirebaseAnonymousAuthResponse;

  if (!response.ok || !payload.idToken) {
    throw new Error(payload.error?.message || 'Could not sign in to Firebase.');
  }

  return payload.idToken;
}

export async function createStudentViaFirebaseRest(data: Record<string, string>, tenantId: string) {
  if (!tenantId || !/^[A-Za-z0-9_-]+$/.test(tenantId)) {
    throw new Error('A valid InstructorOS workspace id is required.');
  }

  const idToken = await getAnonymousFirebaseIdToken();
  const response = await fetch(`${FIRESTORE_BASE_URL}/tenants/${tenantId}/students`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: toFirestoreFields(data) }),
    cache: 'no-store',
  });
  const payload = (await response.json()) as FirestoreCreateResponse;

  if (!response.ok || !payload.name) {
    throw new Error(payload.error?.message || 'Could not save student to Firebase.');
  }

  return payload.name.split('/').pop() || '';
}
