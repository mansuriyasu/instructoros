import { NextResponse } from 'next/server';

const TWILIO_API_BASE = 'https://api.twilio.com/2010-04-01';
type MessageChannel = 'whatsapp' | 'sms';
type WhatsAppTemplateKey = 'schedule' | 'payment' | 'welcome';
type TwilioMessageStatus = {
  status?: string;
  errorCode?: string | null;
  errorMessage?: string | null;
};

const ALLOWED_HOSTS = new Set([
  'localhost:9002',
  'localhost:3000',
  '127.0.0.1:9002',
  '127.0.0.1:3000',
]);

function getHost(value: string | null) {
  if (!value) return null;

  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

function isTrustedRequest(req: Request) {
  if (process.env.NODE_ENV !== 'production') return true;

  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  const configuredHost = getHost(configuredAppUrl || null);
  const requestHost = getHost(req.headers.get('origin')) || getHost(req.headers.get('referer'));

  if (!requestHost) return false;
  return ALLOWED_HOSTS.has(requestHost) || requestHost === configuredHost;
}

function normalizePhoneNumber(phoneNumber: string) {
  const trimmed = phoneNumber.trim();
  const withoutChannel = trimmed.replace(/^whatsapp:/i, '');
  if (withoutChannel.startsWith('+')) return withoutChannel;

  const digits = withoutChannel.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;

  return withoutChannel;
}

function normalizeWhatsappAddress(phoneNumber: string) {
  const normalized = normalizePhoneNumber(phoneNumber);
  return normalized.toLowerCase().startsWith('whatsapp:') ? normalized : `whatsapp:${normalized}`;
}

function buildTwilioPayload({
  to,
  body,
  channel,
  fromNumber,
  messagingServiceSid,
  contentSid,
  contentVariables,
}: {
  to: string;
  body: string;
  channel: MessageChannel;
  fromNumber?: string;
  messagingServiceSid?: string;
  contentSid?: string;
  contentVariables?: Record<string, string>;
}) {
  const payload = new URLSearchParams({
    To: channel === 'whatsapp' ? normalizeWhatsappAddress(to) : normalizePhoneNumber(to),
  });

  if (contentSid) {
    payload.set('ContentSid', contentSid);
    payload.set('ContentVariables', JSON.stringify(contentVariables || { 1: body }));
  } else {
    payload.set('Body', body);
  }

  if (channel === 'whatsapp') {
    if (fromNumber) payload.set('From', normalizeWhatsappAddress(fromNumber));
    return payload;
  }

  if (messagingServiceSid) {
    payload.set('MessagingServiceSid', messagingServiceSid);
  } else if (fromNumber) {
    payload.set('From', normalizePhoneNumber(fromNumber));
  }

  return payload;
}

async function sendTwilioMessage({
  accountSid,
  authToken,
  to,
  body,
  channel,
  fromNumber,
  messagingServiceSid,
  contentSid,
  contentVariables,
}: {
  accountSid: string;
  authToken: string;
  to: string;
  body: string;
  channel: MessageChannel;
  fromNumber?: string;
  messagingServiceSid?: string;
  contentSid?: string;
  contentVariables?: Record<string, string>;
}) {
  const payload = buildTwilioPayload({
    to,
    body,
    channel,
    fromNumber,
    messagingServiceSid,
    contentSid,
    contentVariables,
  });

  const response = await fetch(`${TWILIO_API_BASE}/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: payload,
  });

  const result = await response.json().catch(() => ({}));
  return {
    ok: response.ok,
    status: response.status,
    sid: result.sid as string | undefined,
    error: result.message || 'Twilio could not send the message.',
  };
}

function buildTwilioAuthHeader(accountSid: string, authToken: string) {
  return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`;
}

async function getTwilioMessageStatus({
  accountSid,
  authToken,
  sid,
}: {
  accountSid: string;
  authToken: string;
  sid: string;
}): Promise<TwilioMessageStatus> {
  const response = await fetch(`${TWILIO_API_BASE}/Accounts/${accountSid}/Messages/${sid}.json`, {
    headers: {
      Authorization: buildTwilioAuthHeader(accountSid, authToken),
    },
  });

  if (!response.ok) return {};

  const result = await response.json().catch(() => ({}));
  return {
    status: result.status,
    errorCode: result.error_code,
    errorMessage: result.error_message,
  };
}

async function waitForImmediateFailure({
  accountSid,
  authToken,
  sid,
}: {
  accountSid: string;
  authToken: string;
  sid?: string;
}) {
  if (!sid) return null;

  for (const delayMs of [1200, 2200, 3200]) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    const message = await getTwilioMessageStatus({ accountSid, authToken, sid });
    if (message.status === 'failed' || message.status === 'undelivered') {
      return message.errorMessage || message.errorCode || `WhatsApp message ${message.status}.`;
    }
  }

  return null;
}

function getWhatsappTemplateSid(templateKey?: WhatsAppTemplateKey) {
  if (templateKey === 'schedule') return process.env.TWILIO_WHATSAPP_SCHEDULE_TEMPLATE_SID;
  if (templateKey === 'payment') return process.env.TWILIO_WHATSAPP_PAYMENT_TEMPLATE_SID;
  if (templateKey === 'welcome') return process.env.TWILIO_WHATSAPP_WELCOME_TEMPLATE_SID;

  return process.env.TWILIO_WHATSAPP_TEMPLATE_SID;
}

function normalizeContentVariables(variables?: Record<string, unknown>, fallbackBody?: string) {
  if (!variables || Object.keys(variables).length === 0) {
    return fallbackBody ? { 1: fallbackBody } : undefined;
  }

  return Object.fromEntries(
    Object.entries(variables).map(([key, value]) => [key, String(value ?? '')])
  );
}

export async function POST(req: Request) {
  try {
    if (!isTrustedRequest(req)) {
      return NextResponse.json(
        { ok: false, error: 'Text messages can only be sent from the configured app domain.' },
        { status: 403 }
      );
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;
    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
    const whatsappFromNumber = process.env.TWILIO_WHATSAPP_FROM;

    if (!accountSid || !authToken || (!fromNumber && !messagingServiceSid)) {
      return NextResponse.json(
        { ok: false, error: 'Twilio SMS is not configured on the server.' },
        { status: 412 }
      );
    }

    const { to, body, preferChannel = 'whatsapp', whatsappTemplate } = await req.json();
    if (!to || !body) {
      return NextResponse.json(
        { ok: false, error: 'Phone number and message are required.' },
        { status: 400 }
      );
    }

    const templateKey = whatsappTemplate?.templateKey as WhatsAppTemplateKey | undefined;
    const whatsappTemplateSid = getWhatsappTemplateSid(templateKey);
    const whatsappTemplateVariables = normalizeContentVariables(whatsappTemplate?.variables, String(body));

    if (preferChannel === 'whatsapp' && whatsappFromNumber) {
      const whatsappResult = await sendTwilioMessage({
        accountSid,
        authToken,
        to: String(to),
        body: String(body),
        channel: 'whatsapp',
        fromNumber: whatsappFromNumber,
        contentSid: whatsappTemplateSid,
        contentVariables: whatsappTemplateVariables,
      });

      if (whatsappResult.ok) {
        const immediateFailureReason = await waitForImmediateFailure({
          accountSid,
          authToken,
          sid: whatsappResult.sid,
        });

        if (!immediateFailureReason) {
          return NextResponse.json({ ok: true, sid: whatsappResult.sid, channel: 'whatsapp' });
        }

        const smsFallbackResult = await sendTwilioMessage({
          accountSid,
          authToken,
          to: String(to),
          body: String(body),
          channel: 'sms',
          fromNumber,
          messagingServiceSid,
        });

        if (smsFallbackResult.ok) {
          return NextResponse.json({
            ok: true,
            sid: smsFallbackResult.sid,
            channel: 'sms',
            fallbackFrom: 'whatsapp',
            fallbackReason: immediateFailureReason,
          });
        }

        return NextResponse.json(
          {
            ok: false,
            error: smsFallbackResult.error || immediateFailureReason || 'Twilio could not send the message.',
            whatsappError: immediateFailureReason,
          },
          { status: smsFallbackResult.status || 502 }
        );
      }

      const smsFallbackResult = await sendTwilioMessage({
        accountSid,
        authToken,
        to: String(to),
        body: String(body),
        channel: 'sms',
        fromNumber,
        messagingServiceSid,
      });

      if (smsFallbackResult.ok) {
        return NextResponse.json({
          ok: true,
          sid: smsFallbackResult.sid,
          channel: 'sms',
          fallbackFrom: 'whatsapp',
          fallbackReason: whatsappResult.error,
        });
      }

      return NextResponse.json(
        {
          ok: false,
          error: smsFallbackResult.error || whatsappResult.error || 'Twilio could not send the message.',
          whatsappError: whatsappResult.error,
        },
        { status: smsFallbackResult.status || whatsappResult.status }
      );
    }

    const smsResult = await sendTwilioMessage({
      accountSid,
      authToken,
      to: String(to),
      body: String(body),
      channel: 'sms',
      fromNumber,
      messagingServiceSid,
    });

    if (!smsResult.ok) {
      return NextResponse.json(
        { ok: false, error: smsResult.error || 'Twilio could not send the text message.' },
        { status: smsResult.status }
      );
    }

    return NextResponse.json({ ok: true, sid: smsResult.sid, channel: 'sms' });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Could not send the text message.' },
      { status: 500 }
    );
  }
}
