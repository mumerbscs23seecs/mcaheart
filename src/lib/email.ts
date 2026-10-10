/**
 * Single email sender for the whole site. Every email goes out from
 * researchlab@mcaheart.com, over SMTP.
 *
 * Env (Render):
 *   SMTP_PASS   - required. ZeptoMail: the SMTP credential's password.
 *                 Zoho Mail: an app password for researchlab@.
 *   SMTP_USER   - ZeptoMail: "emailapikey". Zoho Mail: defaults to
 *                 researchlab@mcaheart.com, so it can be left unset.
 *   SMTP_HOST   - ZeptoMail: smtp.zeptomail.com. Zoho Mail: defaults to
 *                 smtp.zoho.com (smtp.zoho.in / .eu if the account lives there).
 *   ALWAYS_BCC  - optional, comma-separated, bcc'd on everything.
 *
 * With no SMTP_PASS (local dev), emails are logged instead of sent.
 */
import type { Transporter } from 'nodemailer';

const env = import.meta.env;
const FROM_ADDRESS = 'researchlab@mcaheart.com';
const FROM_NAME = 'MCA Heart Research Lab';
const SMTP_HOST = (env.SMTP_HOST as string | undefined) || 'smtp.zoho.com';
const SMTP_USER = (env.SMTP_USER as string | undefined) || FROM_ADDRESS;
const SMTP_PASS = ((env.SMTP_PASS as string | undefined) ?? '').replace(/\s+/g, '');
const ALWAYS_BCC = ((env.ALWAYS_BCC as string | undefined) ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export interface Attachment {
  filename: string;
  /** base64-encoded content */
  content: string;
}

export interface Mail {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  cc?: string | string[];
  /** Extra bcc for this one email, on top of ALWAYS_BCC. */
  bcc?: string | string[];
  attachments?: Attachment[];
}

let transport: Transporter | null = null;
async function getTransport(): Promise<Transporter> {
  if (transport) return transport;
  const nodemailer = await import('nodemailer');
  transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: 465,
    secure: true,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transport;
}

export async function sendEmail(mail: Mail): Promise<{ ok: boolean; id?: string; error?: string }> {
  const to = Array.isArray(mail.to) ? mail.to : [mail.to];
  const cc = (mail.cc ? (Array.isArray(mail.cc) ? mail.cc : [mail.cc]) : []).filter((addr) => !to.includes(addr));
  const perCallBcc = mail.bcc ? (Array.isArray(mail.bcc) ? mail.bcc : [mail.bcc]) : [];
  // Dedupe, and never bcc someone who's already a direct or cc recipient.
  const bcc = [...new Set([...perCallBcc, ...ALWAYS_BCC])].filter((addr) => !to.includes(addr) && !cc.includes(addr));

  if (!SMTP_PASS) {
    console.info('[email] SMTP_PASS not set - would send:', {
      to,
      cc,
      bcc,
      subject: mail.subject,
      attachments: mail.attachments?.map((a) => a.filename) ?? [],
      preview: mail.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200),
    });
    return { ok: true, id: 'logged-only' };
  }

  try {
    const t = await getTransport();
    const info = await t.sendMail({
      from: `"${FROM_NAME}" <${FROM_ADDRESS}>`,
      to,
      cc: cc.length ? cc : undefined,
      bcc: bcc.length ? bcc : undefined,
      replyTo: mail.replyTo,
      subject: mail.subject,
      html: mail.html,
      attachments: mail.attachments?.map((a) => ({ filename: a.filename, content: a.content, encoding: 'base64' })),
    });
    return { ok: true, id: info.messageId };
  } catch (err) {
    const msg = `SMTP (${SMTP_HOST}): ${(err as Error).message.split('\n')[0]}`;
    console.error('[email]', msg);
    return { ok: false, error: msg };
  }
}
