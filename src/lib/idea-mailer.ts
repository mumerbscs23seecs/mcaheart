import type { IdeaPayload } from './idea-schema';
import { CONFERENCE_LABELS, COMMITMENT_LABELS } from './idea-schema';
import { sendEmail, type Attachment } from './email';
import { esc, p, heading, noteBlock, infoBox, dataTable, emailShell, FOOTER_ON_BEHALF, FOOTER_INTERNAL } from './email-layout';

/**
 * Research-idea emails, sent from researchlab@ (src/lib/email.ts). Env:
 *
 *   IDEAS_TO    - where new submissions are sent
 */
const TO = import.meta.env.IDEAS_TO ?? 'researchlab@mcaheart.com';

export type { Attachment };

function rows(data: IdeaPayload): Array<[string, string]> {
  const items: Array<[string, string]> = [
    ['Title', data.title],
    ['Lead investigator', data.leadName],
    ['Email', data.leadEmail],
    ['Contact number', data.contactNumber],
    ['Type of research', data.researchType],
    ...(data.researchType === 'Database'
      ? ([
          ['Database(s)', (data.databases ?? []).join(', ')],
        ] as Array<[string, string]>)
      : []),
    ['Population (P)', data.population],
    ['Intervention / exposure (I)', data.intervention],
    ['Control / comparison (C)', data.comparison],
    ['Outcomes (O)', data.outcomes],
    ['Rationale', data.rationale],
    ...(data.researchType === 'Database'
      ? ([
          ['Proposed study design', data.studyDesign ?? ''],
          ['Prior published studies', data.priorStudies ?? ''],
          ['Latest study on topic', data.latestStudy ?? ''],
        ] as Array<[string, string]>)
      : ([
          ['Previous meta-analysis conducted', data.previousMetaDate ?? ''],
          ['New studies planned for inclusion', data.newStudies ?? ''],
          ['Approx. sample-size increase', data.sampleSizeIncrease ?? ''],
        ] as Array<[string, string]>)),
    ['Target conference', CONFERENCE_LABELS[data.conference]],
    ['Commitment', COMMITMENT_LABELS[data.researchType][data.commitment]],
  ];
  return items;
}

function renderEmail(data: IdeaPayload, hasFile: boolean): string {
  const inner =
    heading('New research idea') +
    dataTable(rows(data)) +
    (hasFile ? p('A supporting document is attached to this email.', 'font-size:14px;margin-bottom:0') : '');
  return emailShell(inner, FOOTER_INTERNAL);
}

export interface IdeaDecisionOpts {
  to: string;
  leadName: string;
  title: string;
  decision: 'approved' | 'withheld' | 'declined';
  note: string | null;
  cc?: string[];
  bcc?: string[];
}

const OUTCOME_LABEL: Record<IdeaDecisionOpts['decision'], string> = {
  approved: 'Approved',
  withheld: 'On hold',
  declined: 'Rejected',
};
const OUTCOME_COLOR: Record<IdeaDecisionOpts['decision'], string> = {
  approved: '#166534',
  withheld: '#92600e',
  declined: '#7a1322',
};

/** Build the approve/withhold/decline email (template + reviewer note) without sending. */
export function renderIdeaDecisionEmail(opts: IdeaDecisionOpts): { subject: string; html: string } {
  const subject = `Idea submission outcome: ${OUTCOME_LABEL[opts.decision]}`;
  const title = `<strong>${esc(opts.title)}</strong>`;

  // "Withheld" reads as its own letter (per the lab's own template): it
  // explains what the on-hold category means and invites a revision, before
  // the same Outcome / Comments block every decision shares.
  const lead =
    opts.decision === 'withheld'
      ? p(`Dear ${esc(opts.leadName)},`) +
        p('Thank you for taking the time to submit your research idea.') +
        p(`Following review and discussion with Dr. Alraies and/or the Analysis Team, your proposal "${title}" has been placed in the withhold category. The study concept is of interest; however, additional details and modifications are required before a final decision can be made regarding acceptance and project initiation.`) +
        p('Any comments or recommendations from the reviewers can be found at the end of this email. We invite you to revise the proposal and address the points outlined below. Once the requested information is provided, the proposal will be reconsidered.') +
        p('Thank you for your contribution and interest in collaborative research.') +
        p('Kind regards,<br>On behalf of Dr. Alraies and the Research Team')
      : p(`Dear ${esc(opts.leadName)},`) +
        p(`Thank you for submitting your idea "${title}" to the MCA Heart Research Lab. We evaluate ideas based on clinical relevance, methodological practicality, and publication value. Any relevant comments and the outcome of your idea submission are at the bottom of this email.`) +
        p('Best regards,<br>MCA Heart Research Lab');

  const outcome =
    `<div style="margin:4px 0 24px;padding-top:20px;border-top:1px solid #eeeeee">` +
    p(`<span style="color:#777777;font-size:13px;font-weight:600">Outcome</span><br><strong style="color:${OUTCOME_COLOR[opts.decision]}">${OUTCOME_LABEL[opts.decision]}</strong>`) +
    (opts.note
      ? noteBlock(opts.note, opts.decision === 'withheld' ? 'Comments by the team' : 'Comments')
      : p(`<span style="color:#777777;font-size:13px;font-weight:600">${opts.decision === 'withheld' ? 'Comments by the team' : 'Comments'}</span><br>None`, 'margin-bottom:0')) +
    `</div>`;

  const instructions =
    opts.decision === 'approved'
      ? infoBox(
          "<strong>Important instructions:</strong> Now that your idea is approved for further processing, the lead author must complete and provide the full manuscript within 1 month from the date the analysis is provided. Failure to follow this timeline may result in the lead author's demotion from first authorship, and the lab will appoint a new lead.",
        )
      : '';

  return { subject, html: emailShell(lead + outcome + instructions, FOOTER_ON_BEHALF) };
}

/** Accept/decline notification to the person who submitted the idea. */
export async function deliverIdeaDecision(opts: IdeaDecisionOpts): Promise<void> {
  const { subject, html } = renderIdeaDecisionEmail(opts);
  const sent = await sendEmail({ to: opts.to, cc: opts.cc, bcc: opts.bcc, subject, html });
  if (!sent.ok) throw new Error(sent.error ?? 'Email delivery failed.');
}

export async function deliverIdea(data: IdeaPayload, attachment?: Attachment): Promise<void> {
  const sent = await sendEmail({
    to: TO,
    replyTo: data.leadEmail,
    subject: `New research idea: ${data.title}`,
    html: renderEmail(data, Boolean(attachment)),
    attachments: attachment ? [attachment] : undefined,
  });
  if (!sent.ok) throw new Error(sent.error ?? 'Email delivery failed.');
}
