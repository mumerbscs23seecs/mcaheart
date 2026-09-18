import type { ContactPayload } from './contact-schema';
import { INTENT_LABELS } from './contact-schema';
import { sendEmail, type Attachment } from './email';

/**
 * Contact-form delivery. Transport (Gmail SMTP / Resend / log) is handled by
 * src/lib/email.ts. Env vars:
 *
 *   CONTACT_TO    – destination inbox
 *   CONTACT_FROM  – sender (ignored by the Gmail transport)
 */

const TO = import.meta.env.CONTACT_TO ?? 'studio@medishift.in';
const FROM = import.meta.env.CONTACT_FROM ?? 'MCA Heart <onboarding@resend.dev>';

const NEEDS_LETTER_LABEL: Record<string, string> = { yes: 'Yes', no: 'No' };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Rows specific to the chosen reason for getting in touch. */
function intentRows(data: ContactPayload): Array<[string, string]> {
  if (data.intent === 'collaborate') {
    return [['Message', data.message || '-']];
  }
  if (data.intent === 'recommendation') {
    return [['Name', data.recName || '-']];
  }
  // observership
  return [
    ['Name', data.obsName || '-'],
    ['Plans to apply for IM match', data.obsApplyDate || '-'],
    ['Needs a letter confirming the rotation', NEEDS_LETTER_LABEL[data.obsNeedsLetter ?? ''] ?? '-'],
    ['Professional status', data.obsStatus || '-'],
    ['USMLEs completed', data.obsUsmle || '-'],
    ['Visa situation', data.obsVisa || '-'],
    ['Year of graduation', data.obsGradYear || '-'],
    ['Intended rotation dates', `${data.obsStart || '?'} → ${data.obsEnd || '?'}`],
  ];
}

function renderRows(data: ContactPayload): string {
  const rows: Array<[string, string]> = [
    ['Name', data.fullName],
    ['Email', data.email],
    ['Phone', data.phone || '-'],
    ['Location', data.location || '-'],
    ['Designation', data.designation || '-'],
    ['Reason', INTENT_LABELS[data.intent]],
    ...intentRows(data),
  ];

  return rows
    .map(
      ([label, value]) =>
        `<tr>
           <td style="padding:6px 14px 6px 0;color:#7d6f5e;font:600 12px/1.4 Arial,sans-serif;
                      text-transform:uppercase;letter-spacing:.12em;white-space:nowrap;
                      vertical-align:top">${label}</td>
           <td style="padding:6px 0;color:#1c1714;font:14px/1.5 Arial,sans-serif;white-space:pre-wrap">${escapeHtml(value)}</td>
         </tr>`,
    )
    .join('');
}

function renderEmail(data: ContactPayload, note: string): string {
  return `<div style="background:#f7f1e3;padding:28px">
  <div style="max-width:620px;margin:0 auto;background:#fffdf7;border:1px solid rgba(122,43,18,.18);padding:28px">
    <p style="margin:0 0 4px;color:#9e3b1b;font:700 11px/1 Arial,sans-serif;
              text-transform:uppercase;letter-spacing:.24em">MCA Heart</p>
    <h1 style="margin:0 0 20px;color:#1c1714;font:600 22px/1.2 Georgia,serif">
      New enquiry from the website
    </h1>
    <table style="border-collapse:collapse;width:100%">${renderRows(data)}</table>
    ${note}
  </div>
</div>`;
}

export interface DeliverOpts {
  attachments?: Attachment[];
  /** Set when a CV was attached (filename shown even if it couldn't be attached). */
  cvFilename?: string;
  /** Set when the CV was too large to attach - the note says to follow up directly. */
  cvTooLarge?: boolean;
}

export async function deliverEnquiry(data: ContactPayload, opts: DeliverOpts = {}): Promise<void> {
  const note = opts.cvTooLarge
    ? `<hr style="border:0;border-top:1px solid rgba(122,43,18,.18);margin:22px 0" />
       <p style="margin:0;color:#92600e;font:600 13px/1.5 Arial,sans-serif">
         ${escapeHtml(opts.cvFilename ?? 'The CV')} was too large to attach - please follow up with the sender directly for a copy.</p>`
    : opts.attachments?.length
      ? `<hr style="border:0;border-top:1px solid rgba(122,43,18,.18);margin:22px 0" />
         <p style="margin:0;color:#166534;font:600 13px/1.5 Arial,sans-serif">📎 ${escapeHtml(
           opts.attachments.map((a) => a.filename).join(', '),
         )} attached.</p>`
      : '';

  const sent = await sendEmail({
    to: TO,
    from: FROM,
    replyTo: data.email,
    subject: `[MCA Heart] ${INTENT_LABELS[data.intent]} - ${data.fullName}`,
    html: renderEmail(data, note),
    attachments: opts.attachments,
  });
  if (!sent.ok) throw new Error(sent.error ?? 'Email delivery failed.');
}
