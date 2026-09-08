/**
 * Single email sender for the whole site. Transport is chosen at runtime:
 *
 *   1. GMAIL_USER + GMAIL_APP_PASSWORD set  → send via Gmail SMTP (nodemailer)
 *   2. else RESEND_API_KEY set              → send via the Resend HTTP API
 *   3. else                                 → log to stdout (local dev / demo)
 *
 * Gmail note: Gmail ignores a custom From address and sends as the authenticated
 * account, so with the SMTP transport the address is forced to GMAIL_USER (the
 * display name is kept). Move to Resend + a verified domain for a real
 * noreply@ sender.
 */
import type { Transporter } from 'nodemailer';

const GMAIL_USER = import.meta.env.GMAIL_USER as string | undefined;
const GMAIL_PASS = import.meta.env.GMAIL_APP_PASSWORD as string | undefined;
const RESEND_KEY = import.meta.env.RESEND_API_KEY as string | undefined;
const DEFAULT_FROM = (import.meta.env.MAIL_FROM ??
  import.meta.env.NOTIFY_FROM ??
  'MCA Heart <onboarding@resend.dev>') as string;

const hasGmail = Boolean(GMAIL_USER && GMAIL_PASS);
const hasResend = Boolean(RESEND_KEY);

export interface Attachment {
  filename: string;
  /** base64-encoded content */
  content: string;
}

export interface Mail {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  attachments?: Attachment[];
}

/** "Name <addr@x>" | "addr@x" -> display name or "". */
function displayName(from: string): string {
  const m = from.match(/^\s*"?([^"<]*?)"?\s*<[^>]+>\s*$/);
  return m ? m[1]!.trim() : '';
}

let transport: Transporter | null = null;
async function gmailTransport(): Promise<Transporter> {
  if (transport) return transport;
  const nodemailer = await import('nodemailer');
  transport = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER!, pass: GMAIL_PASS!.replace(/\s+/g, '') },
  });
  return transport;
}

async function viaGmail(to: string[], mail: Mail, from: string): Promise<string> {
  const t = await gmailTransport();
  const name = displayName(from) || 'MCA Heart';
  const info = await t.sendMail({
    from: `"${name}" <${GMAIL_USER}>`,
    to,
    replyTo: mail.replyTo,
    subject: mail.subject,
    html: mail.html,
    attachments: mail.attachments?.map((a) => ({ filename: a.filename, content: a.content, encoding: 'base64' })),
  });
  return info.messageId;
}

async function viaResend(to: string[], mail: Mail, from: string): Promise<string> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to,
      reply_to: mail.replyTo,
      subject: mail.subject,
      html: mail.html,
      attachments: mail.attachments,
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as { id?: string };
  return body.id ?? 'sent';
}

export async function sendEmail(mail: Mail): Promise<{ ok: boolean; id?: string; error?: string }> {
  const to = Array.isArray(mail.to) ? mail.to : [mail.to];
  const from = mail.from ?? DEFAULT_FROM;

  // No transport configured — log and succeed so local dev / the demo work.
  if (!hasGmail && !hasResend) {
    console.info('[email] no transport configured — would send:', {
      to,
      subject: mail.subject,
      attachments: mail.attachments?.map((a) => a.filename) ?? [],
      preview: mail.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200),
    });
    return { ok: true, id: 'logged-only' };
  }

  const errors: string[] = [];

  // 1. Gmail SMTP (preferred when set); fall through to Resend on failure.
  if (hasGmail) {
    try {
      return { ok: true, id: await viaGmail(to, mail, from) };
    } catch (err) {
      const msg = `Gmail SMTP: ${(err as Error).message.split('\n')[0]}`;
      errors.push(msg);
      if (hasResend) console.warn(`[email] ${msg} — falling back to Resend`);
    }
  }

  // 2. Resend HTTP.
  if (hasResend) {
    try {
      return { ok: true, id: await viaResend(to, mail, from) };
    } catch (err) {
      errors.push((err as Error).message);
    }
  }

  return { ok: false, error: errors.join(' | ') || 'Email delivery failed.' };
}

/** Which transport is preferred — handy for logging/health checks. */
export const mailTransport = hasGmail ? 'gmail' : hasResend ? 'resend' : 'log';
