const TWILIO_API_BASE = "https://api.twilio.com/2010-04-01/Accounts";

function normalizePhone(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return String(value || "").trim();
}

export async function sendTwilioSms(toValue: unknown, body: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  if (!accountSid || !authToken || (!fromNumber && !messagingServiceSid)) {
    throw new Error("Twilio SMS is not configured on the server.");
  }

  const to = normalizePhone(toValue);
  if (!/^\+[1-9]\d{7,14}$/.test(to)) {
    throw new Error(
      "The student mobile number is not a valid international phone number.",
    );
  }

  const form = new URLSearchParams({ To: to, Body: body });
  if (messagingServiceSid) form.set("MessagingServiceSid", messagingServiceSid);
  else form.set("From", fromNumber!);

  const response = await fetch(
    `${TWILIO_API_BASE}/${encodeURIComponent(accountSid)}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
      signal: AbortSignal.timeout(15000),
    },
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Twilio could not send the SMS.");
  }
  return { sid: data.sid, status: data.status };
}
