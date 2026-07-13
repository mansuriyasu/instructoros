import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

export function getStripe() {
  if (stripeClient) return stripeClient;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured.');
  }
  if (secretKey.startsWith('pk_')) {
    throw new Error('STRIPE_SECRET_KEY is set to a publishable key. Replace it with a Stripe secret key starting with sk_.');
  }
  if (!secretKey.startsWith('sk_')) {
    throw new Error('STRIPE_SECRET_KEY is invalid. Use a Stripe secret key starting with sk_.');
  }

  stripeClient = new Stripe(secretKey, {
    apiVersion: '2026-06-24.dahlia',
  });

  return stripeClient;
}

export function getAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://instructoros.ca').replace(/\/$/, '');
}

export function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}

export function publicBillingError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : String(error);

  if (/default credentials|application default credentials|GOOGLE_APPLICATION_CREDENTIALS|Firebase Admin/i.test(message)) {
    return 'Billing is not connected on this server yet. Add Firebase Admin credentials (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY or FIREBASE_SERVICE_ACCOUNT_KEY) to the hosting environment, then restart the app.';
  }

  if (/publishable API key|publishable key|STRIPE_SECRET_KEY.*publishable|starting with sk_/i.test(message)) {
    return 'Stripe is misconfigured on the server. Set STRIPE_SECRET_KEY to the secret key starting with sk_ (not the publishable key starting with pk_), then redeploy.';
  }

  return message || fallback;
}
