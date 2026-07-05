import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

export function getStripe() {
  if (stripeClient) return stripeClient;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured.');
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
    return 'Billing server setup is missing Firebase Admin credentials. The free trial can still be started from the Billing page.';
  }

  return message || fallback;
}
