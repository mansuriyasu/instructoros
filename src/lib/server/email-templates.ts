import type { OutgoingEmail } from "@/lib/server/email";

// Branding always comes from the tenant's own settings; InstructorOS is only the neutral fallback.
export interface EmailBranding {
  name?: string;
  messageSenderName?: string;
  receiptBusinessName?: string;
  receiptFooterText?: string;
  receiptLogoDataUrl?: string;
  receiptPhone?: string;
  receiptEmail?: string;
  receiptWebsite?: string;
  ownerEmail?: string;
}

type Branded = Omit<OutgoingEmail, "to">;

const LOGO_CID = "school-logo";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function senderName(branding: EmailBranding) {
  return branding.messageSenderName || branding.receiptBusinessName || branding.name || "InstructorOS";
}

function contactLines(branding: EmailBranding) {
  return [branding.receiptPhone, branding.receiptEmail, branding.receiptWebsite].filter(Boolean) as string[];
}

function hasInlineLogo(branding: EmailBranding) {
  return /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(branding.receiptLogoDataUrl || "");
}

function layout(branding: EmailBranding, heading: string, bodyHtml: string) {
  const name = escapeHtml(senderName(branding));
  const logo = hasInlineLogo(branding)
    ? `<img src="cid:${LOGO_CID}" alt="${name}" style="max-height:56px;max-width:200px;display:block;margin:0 0 16px" />`
    : `<p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#102033">${name}</p>`;
  const footer = [branding.receiptFooterText, ...contactLines(branding)]
    .filter(Boolean)
    .map(line => escapeHtml(line))
    .join("<br />");
  return `<!doctype html>
<html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${escapeHtml(heading)}</title></head><body style="margin:0;background:#f5f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#102033">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7f9;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;padding:28px">
        <tr><td>
          ${logo}
          <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3">${escapeHtml(heading)}</h1>
          ${bodyHtml}
          ${footer ? `<p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #e5e9ee;font-size:13px;line-height:1.5;color:#5b6b80">${footer}</p>` : ""}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function textFooter(branding: EmailBranding) {
  return ["", senderName(branding), ...contactLines(branding)].join("\n");
}

function base(branding: EmailBranding): Pick<Branded, "fromName" | "replyTo" | "attachments"> {
  return {
    fromName: senderName(branding),
    replyTo: branding.receiptEmail || branding.ownerEmail,
    attachments: hasInlineLogo(branding)
      ? [{ filename: "logo", path: branding.receiptLogoDataUrl, cid: LOGO_CID }]
      : [],
  };
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(amount);
}

export function paymentReceiptEmail(
  branding: EmailBranding,
  input: { studentName: string; amount: number; servicesDesc: string },
): Branded {
  const amount = formatMoney(input.amount);
  const heading = "Payment received";
  const text = `Hi ${input.studentName},\n\nWe received your payment of ${amount} for ${input.servicesDesc}. Thank you!${textFooter(branding)}`;
  const html = layout(
    branding,
    heading,
    `<p style="margin:0 0 12px;font-size:15px;line-height:1.6">Hi ${escapeHtml(input.studentName)},</p>
     <p style="margin:0 0 12px;font-size:15px;line-height:1.6">We received your payment of <strong>${escapeHtml(amount)}</strong> for ${escapeHtml(input.servicesDesc)}.</p>
     <p style="margin:0;font-size:15px;line-height:1.6">Thank you!</p>`,
  );
  return { ...base(branding), subject: `${senderName(branding)}: payment received (${amount})`, text, html };
}

function formatInZone(date: Date, timeZone: string, options: Intl.DateTimeFormatOptions) {
  try {
    return new Intl.DateTimeFormat("en-CA", { ...options, timeZone }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-CA", { ...options, timeZone: "America/Toronto" }).format(date);
  }
}

function icsDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function icsText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, match => `\\${match}`);
}

export function lessonEmail(
  branding: EmailBranding,
  input: {
    studentName: string;
    isUpdate: boolean;
    start: Date;
    end: Date;
    timeZone: string;
    services: string;
    address: string;
    eventId?: string;
  },
): Branded {
  const action = input.isUpdate ? "updated" : "scheduled";
  const day = formatInZone(input.start, input.timeZone, { weekday: "long", month: "long", day: "numeric" });
  const time = `${formatInZone(input.start, input.timeZone, { hour: "numeric", minute: "2-digit" })} – ${formatInZone(input.end, input.timeZone, { hour: "numeric", minute: "2-digit" })}`;
  const heading = `Your lesson is ${action}`;
  const rows: [string, string][] = [
    ["Date", day],
    ["Time", time],
    ["Lesson", input.services],
    ["Pickup", input.address],
  ];
  const text = `Hi ${input.studentName},\n\nYour lesson is ${action}.\n\n${rows.map(([label, value]) => `${label}: ${value}`).join("\n")}\n\nThe attached calendar file adds it to your calendar.${textFooter(branding)}`;
  const html = layout(
    branding,
    heading,
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.6">Hi ${escapeHtml(input.studentName)},</p>
     <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:15px;line-height:1.5;margin:0 0 16px">
       ${rows
         .map(([label, value]) => `<tr><td style="padding:6px 12px 6px 0;color:#5b6b80;white-space:nowrap;vertical-align:top">${label}</td><td style="padding:6px 0;font-weight:600">${escapeHtml(value)}</td></tr>`)
         .join("")}
     </table>
     <p style="margin:0;font-size:13px;color:#5b6b80">Open the attached calendar file to add this lesson to your calendar.</p>`,
  );

  const name = senderName(branding);
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//InstructorOS//Lessons//EN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    // A stable UID lets calendar apps replace the old entry when the lesson is updated.
    `UID:${input.eventId || `${icsDate(input.start)}-${Math.random().toString(36).slice(2)}`}@instructoros.ca`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(input.start)}`,
    `DTEND:${icsDate(input.end)}`,
    `SUMMARY:${icsText(`${input.services} with ${name}`)}`,
    `LOCATION:${icsText(input.address)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const shared = base(branding);
  return {
    ...shared,
    subject: `${name}: lesson ${action} for ${day}`,
    text,
    html,
    attachments: [...(shared.attachments || []), { filename: "lesson.ics", content: ics, contentType: "text/calendar; charset=utf-8" }],
  };
}

const WELCOME_CHECKLIST = [
  "Bring your valid driver’s licence with you.",
  "Wear comfortable, closed-toe shoes suitable for driving. Slippers, flip-flops, high heels and loose footwear can affect your control of the vehicle.",
  "Arrive 5–10 minutes before your scheduled lesson time.",
  "Bring your glasses or contact lenses if your licence requires them.",
  "Make sure you are well-rested and ready to focus on driving.",
  "If you need to cancel or reschedule, please give as much notice as possible.",
];

export function welcomeEmail(branding: EmailBranding, input: { studentName: string }): Branded {
  const name = senderName(branding);
  const heading = `Welcome, ${input.studentName}!`;
  const text = `Hello ${input.studentName}!\n\nThank you for registering with ${name}.\n\nBefore your driving lesson, please make sure you:\n${WELCOME_CHECKLIST.map(item => `- ${item}`).join("\n")}\n\nIf you have any questions before your lesson, just reply to this email.\n\nWe look forward to helping you become a safe and confident driver!${textFooter(branding)}`;
  const html = layout(
    branding,
    heading,
    `<p style="margin:0 0 12px;font-size:15px;line-height:1.6">Thank you for registering with ${escapeHtml(name)}. Before your driving lesson, please make sure you:</p>
     <ul style="margin:0 0 16px;padding-left:20px;font-size:15px;line-height:1.6">${WELCOME_CHECKLIST.map(item => `<li style="margin:0 0 6px">${escapeHtml(item)}</li>`).join("")}</ul>
     <p style="margin:0 0 12px;font-size:15px;line-height:1.6">If you have any questions before your lesson, just reply to this email.</p>
     <p style="margin:0;font-size:15px;line-height:1.6">We look forward to helping you become a safe and confident driver!</p>`,
  );
  return { ...base(branding), subject: `Welcome to ${name}`, text, html };
}

export function verificationCodeEmail(branding: EmailBranding, input: { studentName: string; code: string }): Branded {
  const name = senderName(branding);
  const heading = "Your verification code";
  const text = `Hi ${input.studentName},\n\nYour ${name} student portal code is ${input.code}. It expires in 10 minutes.\n\nDo not share this code. If you didn't ask for it, you can ignore this email.${textFooter(branding)}`;
  const html = layout(
    branding,
    heading,
    `<p style="margin:0 0 12px;font-size:15px;line-height:1.6">Hi ${escapeHtml(input.studentName)},</p>
     <p style="margin:0 0 16px;font-size:15px;line-height:1.6">Use this code to continue to your student portal. It expires in 10 minutes.</p>
     <p style="margin:0 0 16px;font-size:32px;font-weight:700;letter-spacing:6px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace">${escapeHtml(input.code)}</p>
     <p style="margin:0;font-size:13px;color:#5b6b80">Do not share this code. If you didn't ask for it, you can ignore this email.</p>`,
  );
  // The code goes in the subject too, so it shows in phone notifications.
  return { ...base(branding), subject: `${input.code} is your ${name} verification code`, text, html };
}
