import type { ContactPayload } from './contact-schema';
import { INTENT_LABELS } from './contact-schema';
import { sendEmail, type Attachment } from './email';
import { esc, p, heading, dataTable, emailShell, FOOTER_INTERNAL } from './email-layout';

/**
 * Contact-form delivery, sent from researchlab@ (src/lib/email.ts). Env:
 *
 *   CONTACT_TO    - destination inbox
 */

const TO = import.meta.env.CONTACT_TO ?? 'researchlab@mcaheart.com';

const NEEDS_LETTER_LABEL: Record<string, string> = { yes: 'Yes', no: 'No' };

/** Rows specific to the chosen reason for getting in touch. */
function intentRows(data: ContactPayload): Array<[string, string]> {
  if (data.intent === 'collaborate') {
    return [['Message', data.message || '-']];
  }
  if (data.intent === 'recommendation') {
    return [['Name', data.recName || '-']];
  }
  if (data.intent === 'trending') {
    return [['Message', data.trendingMessage || '-']];
  }
  if (data.intent === 'other') {
    return [['Message', data.otherMessage || '-']];
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
    ['Intended rotation dates', `${data.obsStart || '?'} to ${data.obsEnd || '?'}`],
  ];
}

function renderEmail(data: ContactPayload, note: string): string {
  const inner =
    heading('New enquiry from the website') +
    dataTable([
      ['Name', data.fullName],
      ['Email', data.email],
      ['Phone', data.phone || '-'],
      ['Location', data.location || '-'],
      ['Designation', data.designation || '-'],
      ['Reason', INTENT_LABELS[data.intent]],
      ...intentRows(data),
    ]) +
    note;
  return emailShell(inner, FOOTER_INTERNAL);
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
    ? p(`${esc(opts.cvFilename ?? 'The CV')} was too large to attach. Please ask the sender for a copy directly.`, 'font-size:14px;margin-bottom:0')
    : opts.attachments?.length
      ? p(`Attached: ${esc(opts.attachments.map((a) => a.filename).join(', '))}.`, 'font-size:14px;margin-bottom:0')
      : '';

  const sent = await sendEmail({
    to: TO,
    replyTo: data.email,
    subject: `Website enquiry (${INTENT_LABELS[data.intent]}): ${data.fullName}`,
    html: renderEmail(data, note),
    attachments: opts.attachments,
  });
  if (!sent.ok) throw new Error(sent.error ?? 'Email delivery failed.');
}
