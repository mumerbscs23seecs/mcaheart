import type { IdeaPayload } from './idea-schema';
import { CONFERENCE_LABELS, COMMITMENT_LABELS } from './idea-schema';
import { sendEmail, type Attachment } from './email';
import { p, heading, dataTable, emailShell, FOOTER_INTERNAL } from './email-layout';
import { renderIdeaDecisionEmail, type IdeaDecisionOpts } from './idea-email-template';

export { renderIdeaDecisionEmail, type IdeaDecisionOpts };

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

/** Outcome letter to the person who submitted the idea. Returns false when
 *  email isn't set up on this server (local dev), so nothing actually went out. */
export async function deliverIdeaDecision(opts: IdeaDecisionOpts): Promise<boolean> {
  const { subject, html } = renderIdeaDecisionEmail(opts);
  const sent = await sendEmail({ to: opts.to, cc: opts.cc, bcc: opts.bcc, subject, html });
  if (!sent.ok) throw new Error(sent.error ?? 'Email delivery failed.');
  return sent.id !== 'logged-only';
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
