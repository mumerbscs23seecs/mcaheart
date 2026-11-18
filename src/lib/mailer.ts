import type { ContactPayload } from './contact-schema';
import { INTENT_LABELS } from './contact-schema';
import { sendEmail, type Attachment } from './email';
import { esc, p, heading, dataTable, emailShell, alertBlock, FOOTER_INTERNAL } from './email-layout';
import { isLabMember, NOT_IN_LAB_TEXT } from './lab-members';
import { TOPIC_ROLE_LABEL, AI_PLAN_LABEL } from './contact-schema';

const yes = (v: string | undefined) => (v === 'yes' ? 'Yes' : 'No');
const dmy = (d: string | undefined) => {
  if (!d) return '';
  const t = new Date(`${d}T00:00:00Z`);
  return Number.isNaN(t.getTime()) ? d : t.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

/** A "Join a new topic" request, as label / value rows. */
export function topicRows(data: ContactPayload): Array<[string, string]> {
  const roles = (data.topicRoles ?? []).map((r) =>
    r === 'Other' ? `Other: ${data.topicOther || '-'}` : (TOPIC_ROLE_LABEL as Record<string, string>)[r] ?? r);
  return [
    ['Can help with', roles.join('\n') || '-'],
    ['Area of interest', data.topicArea || '-'],
    ['Hours per week', data.topicHours || '-'],
    ['Available', `${dmy(data.topicFrom) || '?'}${data.topicUntil ? ` to ${dmy(data.topicUntil)}` : ' onwards'}`],
    ['AI use', (AI_PLAN_LABEL as Record<string, string>)[data.aiPlan ?? ''] ?? '-'],
    ...(data.aiPlan && data.aiPlan !== 'none' ? [['AI would help with', data.aiPlanParts || '-'] as [string, string]] : []),
    ...(data.aiPlan && data.aiPlan !== 'none' ? [['Accepted the AI declaration', yes(data.aiDeclaration ?? data.aiProofread)] as [string, string]] : []),
    ['Accepted the deadline declaration', yes(data.deadlineAck)],
    ['Has texted Muhammad Burhan', yes(data.textedCoordinator)],
    ['Note', data.topicNote || '-'],
  ];
}

/**
 * Contact-form delivery, sent from researchlab@ (src/lib/email.ts). Env:
 *
 *   CONTACT_TO    - destination inbox
 */

const TO = import.meta.env.CONTACT_TO ?? 'researchlab@mcaheart.com';

const NEEDS_LETTER_LABEL: Record<string, string> = { yes: 'Yes', no: 'No' };

/** Rows specific to the chosen reason for getting in touch. Also used by
 *  the admin inbox (admin/requests.astro). */
export function intentRows(data: ContactPayload): Array<[string, string]> {
  if (data.intent === 'collaborate') {
    return [['Message', data.message || '-']];
  }
  if (data.intent === 'recommendation') {
    // Older public enquiries only had a name.
    if (!data.recPurpose) return [['Name', data.recName || '-']];
    return [
      ['Letter for', data.recPurpose || '-'],
      ['Deadline', data.recDeadline || '-'],
      ['Work with the lab', data.recWork || '-'],
    ];
  }
  if (data.intent === 'topic') {
    // Older requests had one "topicRole"; newer ones a list, plus availability
    // and an AI disclosure.
    if (!data.topicRoles?.length) {
      return [
        ['Area or kind of topic', data.topicArea || '-'],
        ['Would like to help with', data.topicRole || '-'],
        ['Hours per week', data.topicHours || '-'],
        ['Note', data.topicNote || '-'],
      ];
    }
    return topicRows(data);
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

function renderEmail(data: ContactPayload, note: string, notInLab = false): string {
  const inner =
    heading(data.source === 'member' ? 'New request from a member' : 'New enquiry from the website') +
    (notInLab ? alertBlock(NOT_IN_LAB_TEXT) : '') +
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

// Requests where it matters whether the sender is part of the lab.
const MEMBER_CHECK: string[] = ['topic', 'recommendation'];

export async function deliverEnquiry(data: ContactPayload, opts: DeliverOpts = {}): Promise<void> {
  const note = opts.cvTooLarge
    ? p(`${esc(opts.cvFilename ?? 'The CV')} was too large to attach. Please ask the sender for a copy directly.`, 'font-size:14px;margin-bottom:0')
    : opts.attachments?.length
      ? p(`Attached: ${esc(opts.attachments.map((a) => a.filename).join(', '))}.`, 'font-size:14px;margin-bottom:0')
      : '';

  const sent = await sendEmail({
    to: TO,
    replyTo: data.email,
    subject: `${data.source === 'member' ? 'Member request' : 'Website enquiry'} (${INTENT_LABELS[data.intent]}): ${data.fullName}`,
    html: renderEmail(data, note, MEMBER_CHECK.includes(data.intent) && (await isLabMember(data.email)) === false),
    attachments: opts.attachments,
  });
  if (!sent.ok) throw new Error(sent.error ?? 'Email delivery failed.');
}
