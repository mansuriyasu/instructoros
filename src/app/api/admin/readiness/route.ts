import { NextRequest, NextResponse } from 'next/server';
import { MAIN_ADMIN_EMAIL, normalizeEmail } from '@/lib/auth-config';
import { getAdminAuth } from '@/lib/server/firebase-admin';

export const runtime = 'nodejs';

type ReadinessState = 'ready' | 'missing' | 'warning';

type ReadinessItem = {
  key: string;
  label: string;
  state: ReadinessState;
  detail: string;
};

type AuthProviderCheckResult = {
  ok: boolean;
  detail: string;
};

function hasEnv(name: string) {
  return Boolean(process.env[name]?.trim());
}

function item(key: string, label: string, ready: boolean, readyDetail: string, missingDetail: string): ReadinessItem {
  return {
    key,
    label,
    state: ready ? 'ready' : 'missing',
    detail: ready ? readyDetail : missingDetail,
  };
}

async function checkFederatedFirebaseAuthProvider(providerId: string, label: string): Promise<AuthProviderCheckResult> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const continueUri = process.env.NEXT_PUBLIC_APP_URL || 'https://instructoros.ca';

  if (!apiKey) {
    return {
      ok: false,
      detail: `Cannot check ${label}; NEXT_PUBLIC_FIREBASE_API_KEY is missing.`,
    };
  }

  try {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'provider-check@instructoros.ca',
        continueUri,
        providerId,
      }),
    });
    const data = await response.json().catch(() => ({}));
    const errorMessage = String(data.error?.message || '');

    if (response.ok) {
      return {
        ok: true,
        detail: `${label} provider responded successfully.`,
      };
    }

    if (/OPERATION_NOT_ALLOWED|configuration is not found/i.test(errorMessage)) {
      return {
        ok: false,
        detail: `${label} is not enabled in Firebase Authentication > Sign-in method.`,
      };
    }

    if (/INVALID_CONTINUE_URI|UNAUTHORIZED_DOMAIN/i.test(errorMessage)) {
      return {
        ok: false,
        detail: `${label} is enabled, but ${continueUri} is not authorized in Firebase Authentication > Settings > Authorized domains.`,
      };
    }

    return {
      ok: false,
      detail: `${label} check failed: ${errorMessage || `HTTP ${response.status}`}.`,
    };
  } catch (error) {
    return {
      ok: false,
      detail: `${label} check failed: ${error instanceof Error ? error.message : 'network error'}.`,
    };
  }
}

async function checkEmailPasswordAuthProvider(): Promise<AuthProviderCheckResult> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

  if (!apiKey) {
    return {
      ok: false,
      detail: 'Cannot check Email/password sign-in; NEXT_PUBLIC_FIREBASE_API_KEY is missing.',
    };
  }

  try {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'provider-check@instructoros.ca',
        password: 'ProviderCheck123!',
        returnSecureToken: true,
      }),
    });
    const data = await response.json().catch(() => ({}));
    const errorMessage = String(data.error?.message || '');

    if (response.ok || /EMAIL_NOT_FOUND|INVALID_LOGIN_CREDENTIALS|INVALID_PASSWORD/i.test(errorMessage)) {
      return {
        ok: true,
        detail: 'Email/password sign-in provider responded successfully.',
      };
    }

    if (/OPERATION_NOT_ALLOWED|PASSWORD_LOGIN_DISABLED/i.test(errorMessage)) {
      return {
        ok: false,
        detail: 'Email/password sign-in is not enabled in Firebase Authentication > Sign-in method.',
      };
    }

    return {
      ok: false,
      detail: `Email/password sign-in check failed: ${errorMessage || `HTTP ${response.status}`}.`,
    };
  } catch (error) {
    return {
      ok: false,
      detail: `Email/password sign-in check failed: ${error instanceof Error ? error.message : 'network error'}.`,
    };
  }
}

async function getReadinessItems(): Promise<ReadinessItem[]> {
  const hasPublicFirebase = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID',
  ].every(hasEnv);
  const hasFirebaseAdmin = hasEnv('FIREBASE_SERVICE_ACCOUNT_KEY')
    || (hasEnv('FIREBASE_PROJECT_ID') && hasEnv('FIREBASE_CLIENT_EMAIL') && hasEnv('FIREBASE_PRIVATE_KEY'));
  const hasStripeCore = hasEnv('STRIPE_SECRET_KEY')
    && hasEnv('STRIPE_PRICE_INSTRUCTOR_MONTHLY')
    && hasEnv('STRIPE_PRICE_SCHOOL_MONTHLY')
    && hasEnv('STRIPE_PRICE_SCHOOL_EXTRA_SEAT_MONTHLY');
  const hasStripeWebhook = hasEnv('STRIPE_WEBHOOK_SECRET');
  const hasTwilioSms = hasEnv('TWILIO_ACCOUNT_SID')
    && hasEnv('TWILIO_AUTH_TOKEN')
    && (hasEnv('TWILIO_FROM_NUMBER') || hasEnv('TWILIO_MESSAGING_SERVICE_SID'));
  const hasTwilioWhatsapp = hasEnv('TWILIO_WHATSAPP_FROM')
    && (hasEnv('TWILIO_WHATSAPP_TEMPLATE_SID') || hasEnv('TWILIO_WHATSAPP_SCHEDULE_TEMPLATE_SID'));
  const hasGoogleCalendar = hasEnv('GOOGLE_CALENDAR_CLIENT_ID')
    && hasEnv('GOOGLE_CALENDAR_CLIENT_SECRET')
    && hasEnv('GOOGLE_CALENDAR_REFRESH_TOKEN')
    && hasEnv('GOOGLE_CALENDAR_ID');
  const [emailPasswordCheck, googleCheck] = await Promise.all([
    checkEmailPasswordAuthProvider(),
    checkFederatedFirebaseAuthProvider('google.com', 'Google sign-in'),
  ]);

  return [
    item(
      'app-url',
      'App domain',
      hasEnv('NEXT_PUBLIC_APP_URL'),
      'NEXT_PUBLIC_APP_URL is configured.',
      'Set NEXT_PUBLIC_APP_URL to the production domain before checkout and OAuth flows.'
    ),
    item(
      'firebase-client',
      'Firebase client',
      hasPublicFirebase,
      'Public Firebase web config is present.',
      'Add the public Firebase web config values for the new Firebase project.'
    ),
    item(
      'firebase-admin',
      'Firebase Admin',
      hasFirebaseAdmin,
      'Server Firebase credentials are present.',
      'Add FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.'
    ),
    item(
      'firebase-auth-email',
      'Email/password auth',
      emailPasswordCheck.ok,
      emailPasswordCheck.detail,
      emailPasswordCheck.detail
    ),
    item(
      'firebase-auth-google',
      'Google auth',
      googleCheck.ok,
      googleCheck.detail,
      googleCheck.detail
    ),
    item(
      'stripe-core',
      'Stripe checkout',
      hasStripeCore,
      'Stripe secret key and price ids are present.',
      'Add Stripe secret key and all monthly price ids.'
    ),
    item(
      'stripe-webhook',
      'Stripe webhook',
      hasStripeWebhook,
      'Stripe webhook secret is present.',
      'Add STRIPE_WEBHOOK_SECRET after creating the production webhook endpoint.'
    ),
    item(
      'twilio-sms',
      'Twilio SMS',
      hasTwilioSms,
      'Twilio SMS credentials are present.',
      'Add Twilio account credentials and a sender number or messaging service.'
    ),
    {
      key: 'twilio-whatsapp',
      label: 'Twilio WhatsApp',
      state: hasTwilioWhatsapp ? 'ready' : 'warning',
      detail: hasTwilioWhatsapp
        ? 'WhatsApp sender/template settings are present.'
        : 'Optional: add WhatsApp sender/template settings if WhatsApp reminders are enabled.',
    },
    item(
      'gemini',
      'Gemini AI',
      hasEnv('GEMINI_API_KEY'),
      'Gemini API key is present.',
      'Add GEMINI_API_KEY for scans, route optimization, and AI extraction.'
    ),
    item(
      'google-calendar',
      'Google Calendar',
      hasGoogleCalendar,
      'Google Calendar permanent connection settings are present.',
      'Add Google Calendar client, refresh token, and calendar id values.'
    ),
  ];
}

export async function GET(request: NextRequest) {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : '';

  if (!token) {
    return NextResponse.json({ error: 'Missing admin token.' }, { status: 401 });
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    if (normalizeEmail(decoded.email) !== MAIN_ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Only the main admin can view production readiness.' }, { status: 403 });
    }
  } catch {
    return NextResponse.json(
      {
        error: 'Firebase Admin could not verify this admin session. Check server Firebase credentials.',
        items: await getReadinessItems(),
      },
      { status: 503 }
    );
  }

  const items = await getReadinessItems();
  const missingCount = items.filter(readinessItem => readinessItem.state === 'missing').length;
  const warningCount = items.filter(readinessItem => readinessItem.state === 'warning').length;

  return NextResponse.json({
    ok: missingCount === 0,
    missingCount,
    warningCount,
    items,
    reminders: [
      'Rotate the live Stripe secret key that was shared before production launch.',
      'Deploy firestore.rules to the new Firebase project before accepting real users.',
      'Confirm Hostinger or the hosting provider has the same production environment variables.',
    ],
  });
}
