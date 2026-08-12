import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/server/firebase-admin';

const TWILIO_API_BASE = 'https://api.twilio.com/2010-04-01/Accounts';
const REQUEST_TIMEOUT_MS = 15000;

function getBearerToken(request: NextRequest) {
  const match = (request.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i);
  return match?.[1] || '';
}

function normalizePhone(value: unknown) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return String(value || '').trim();
}

function twilioHint(code: unknown) {
  switch (String(code || '')) {
    case '20003': return 'Twilio rejected the server credentials. Replace TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in Hostinger.';
    case '21211': return 'The recipient phone number is invalid. Save it in Canadian international format, for example +14165551234.';
    case '21608': return 'This Twilio trial account can only message verified recipient numbers. Verify the recipient in Twilio or upgrade the account.';
    case '21606': return 'The sender number is not owned by this Twilio account or is not SMS-capable. Check TWILIO_FROM_NUMBER.';
    case '21610': return 'The recipient has opted out of SMS messages.';
    case '30007': return 'The carrier rejected this message. Check the sender registration, message content, and recipient number in Twilio logs.';
    default: return undefined;
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) return NextResponse.json({ error: 'Please sign in before sending an SMS.' }, { status: 401 });
    await getAdminAuth().verifyIdToken(token);

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;
    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
    if (!accountSid || !authToken || (!fromNumber && !messagingServiceSid)) {
      return NextResponse.json({ error: 'Twilio SMS is not configured on the server.' }, { status: 503 });
    }

    const body = await request.json().catch(() => ({}));
    const to = normalizePhone(body.to);
    const message = typeof body.body === 'string' ? body.body.trim() : '';
    if (!/^\+[1-9]\d{7,14}$/.test(to)) {
      return NextResponse.json({ error: 'Enter a valid international phone number.' }, { status: 400 });
    }
    if (!message || message.length > 1600) {
      return NextResponse.json({ error: 'SMS text must be between 1 and 1,600 characters.' }, { status: 400 });
    }

    const form = new URLSearchParams({ To: to, Body: message });
    if (messagingServiceSid) form.set('MessagingServiceSid', messagingServiceSid);
    else form.set('From', fromNumber!);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`${TWILIO_API_BASE}/${encodeURIComponent(accountSid)}/Messages.json`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const code = data.code;
        return NextResponse.json({
          error: data.message || 'Twilio could not send the SMS.',
          code,
          hint: twilioHint(code),
        }, { status: 502 });
      }
      return NextResponse.json({ ok: true, sid: data.sid, status: data.status });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return NextResponse.json({ error: 'Twilio did not respond in time.' }, { status: 504 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not send SMS.' }, { status: 500 });
  }
}
