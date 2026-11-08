import nodemailer, { type Transporter } from "nodemailer";

// Sends through the Hostinger mailbox set in SMTP_* (e.g. notifications@instructoros.ca).
// Replies go to the school (replyTo), so students answer their instructor, not the no-reply box.

let transporter: Transporter | null = null;

export function isEmailConfigured() {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASSWORD && emailFromAddress());
}

function emailFromAddress() {
  return process.env.EMAIL_FROM || process.env.SMTP_USER || "";
}

function getTransporter() {
  if (!isEmailConfigured()) {
    throw new Error("Email is not configured on the server.");
  }
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 465);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.hostinger.com",
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
      connectionTimeout: 15000,
      socketTimeout: 20000,
    });
  }
  return transporter;
}

export function isValidEmail(value: unknown) {
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(String(value || "").trim());
}

/** "jane.doe@gmail.com" -> "j•••@gmail.com", for "code sent to …" notices. */
export function maskEmail(value: string) {
  const [name, domain] = value.split("@");
  if (!name || !domain) return "your email";
  return `${name[0]}•••@${domain}`;
}

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Shown as the sender name, e.g. the school's name. The address stays EMAIL_FROM. */
  fromName?: string;
  replyTo?: string;
  attachments?: { filename?: string; content?: string; path?: string; contentType?: string; cid?: string }[];
}

export async function sendEmail(message: OutgoingEmail) {
  if (!isValidEmail(message.to)) {
    throw new Error("The email address on file is not valid.");
  }
  const fromAddress = emailFromAddress();
  // Quotes and angle brackets in a display name would break the From header.
  const fromName = (message.fromName || "InstructorOS").replace(/["<>\r\n]/g, "").slice(0, 80);
  try {
    const info = await getTransporter().sendMail({
      from: `"${fromName}" <${fromAddress}>`,
      to: message.to.trim(),
      replyTo: message.replyTo && isValidEmail(message.replyTo) ? message.replyTo.trim() : undefined,
      subject: message.subject,
      text: message.text,
      html: message.html,
      attachments: message.attachments,
    });
    return { messageId: info.messageId };
  } catch (error) {
    console.error("email_send_failed", {
      code: (error as { code?: string })?.code || "unknown",
      responseCode: (error as { responseCode?: number })?.responseCode,
    });
    const responseCode = (error as { responseCode?: number })?.responseCode;
    if (responseCode === 535) throw new Error("The email account credentials need attention.");
    if (responseCode && responseCode >= 550) throw new Error("The email server rejected this address.");
    throw new Error("Could not send the email. Please try again.");
  }
}
