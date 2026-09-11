import type { IdeaPayload } from './idea-schema';
import { CONFERENCE_LABELS, COMMITMENT_LABELS } from './idea-schema';
import { sendEmail, type Attachment } from './email';

/**
 * Research-idea emails. Transport (Gmail SMTP / Resend / log) lives in
 * src/lib/email.ts. Env vars:
 *
 *   IDEAS_TO    – where new submissions are sent
 *   IDEAS_FROM  – sender (ignored by the Gmail transport)
 */
const TO = import.meta.env.IDEAS_TO ?? import.meta.env.CONTACT_TO ?? 'studio@medishift.in';
const FROM = import.meta.env.IDEAS_FROM ?? 'MCA Heart <onboarding@resend.dev>';

export type { Attachment };

function esc(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function rows(data: IdeaPayload): string {
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
  return items
    .map(
      ([k, v]) => `<tr>
        <td style="padding:8px 16px 8px 0;color:#64748b;font:600 12px/1.4 Arial,sans-serif;
                   text-transform:uppercase;letter-spacing:.08em;white-space:nowrap;vertical-align:top">${k}</td>
        <td style="padding:8px 0;color:#1e293b;font:14px/1.6 Arial,sans-serif;white-space:pre-wrap">${esc(v)}</td>
      </tr>`,
    )
    .join('');
}

function renderEmail(data: IdeaPayload, hasFile: boolean): string {
  return `<div style="background:#f8fafc;padding:28px">
  <div style="max-width:660px;margin:0 auto;background:#fff;border:1px solid rgba(43,57,144,.14);border-radius:12px;padding:28px">
    <p style="margin:0 0 4px;color:#a51c30;font:700 11px/1 Arial,sans-serif;text-transform:uppercase;letter-spacing:.22em">MCA Heart</p>
    <h1 style="margin:0 0 18px;color:#1e293b;font:600 21px/1.25 Georgia,serif">New research-idea submission</h1>
    <table style="border-collapse:collapse;width:100%">${rows(data)}</table>
    ${
      hasFile
        ? `<p style="margin:20px 0 0;color:#166534;font:600 13px/1.5 Arial,sans-serif">📎 A supporting document is attached to this email.</p>`
        : ''
    }
  </div>
</div>`;
}

export interface IdeaDecisionOpts {
  to: string;
  leadName: string;
  title: string;
  decision: 'accepted' | 'declined';
  note: string | null;
}

/** Build the accept/decline email (template + reviewer note) without sending. */
export function renderIdeaDecisionEmail(opts: IdeaDecisionOpts): { subject: string; html: string } {
  const accepted = opts.decision === 'accepted';
  const subject = `[MCA Heart] Idea submission outcome - ${accepted ? 'Accepted' : 'Rejected'}`;
  const comments = opts.note ? esc(opts.note) : '-';

  const html = `<div style="background:#f8fafc;padding:28px">
  <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid rgba(165,28,48,.14);border-radius:12px;padding:28px">
    <p style="margin:0 0 4px;color:#a51c30;font:700 11px/1 Arial,sans-serif;text-transform:uppercase;letter-spacing:.22em">MCA Heart</p>
    <h1 style="margin:0 0 18px;color:#1e293b;font:600 20px/1.3 Georgia,serif">Idea submission outcome</h1>

    <p style="margin:0 0 14px;color:#1e293b;font:14px/1.6 Arial,sans-serif">Dear ${esc(opts.leadName)},</p>
    <p style="margin:0 0 14px;color:#1e293b;font:14px/1.6 Arial,sans-serif">
      Thank you for submitting your idea '<strong>${esc(opts.title)}</strong>' to the MCA Research Lab. We
      evaluate ideas based on clinical relevance, methodological practicality, and publication value. Any
      relevant comments and the outcome of your idea submission are at the bottom of this email.
    </p>
    <p style="margin:0 0 24px;color:#1e293b;font:14px/1.6 Arial,sans-serif">
      Best regards,<br />MCA HEART RESEARCH LAB
    </p>

    <table style="border-collapse:collapse;width:100%;border-top:1px solid rgba(165,28,48,.14);padding-top:16px">
      <tr>
        <td style="padding:16px 0 4px;color:#64748b;font:600 12px/1.4 Arial,sans-serif;text-transform:uppercase;letter-spacing:.08em">Outcome</td>
      </tr>
      <tr>
        <td style="padding:0 0 14px;color:${accepted ? '#166534' : '#a51c30'};font:700 15px/1.5 Arial,sans-serif">${accepted ? 'Accepted' : 'Rejected'}</td>
      </tr>
      <tr>
        <td style="padding:0 0 4px;color:#64748b;font:600 12px/1.4 Arial,sans-serif;text-transform:uppercase;letter-spacing:.08em">Comments</td>
      </tr>
      <tr>
        <td style="padding:0;color:#1e293b;font:14px/1.6 Arial,sans-serif;white-space:pre-wrap">${comments}</td>
      </tr>
    </table>

    <p style="margin:24px 0 0;padding:12px 14px;background:#f1f5f9;border-radius:8px;color:#1e293b;font:13px/1.6 Arial,sans-serif">
      <strong>Important instructions:</strong> If your idea is accepted for further processing, the lead
      author must complete and provide the full manuscript within 1 month from the date the analysis is
      provided. Failure to follow this timeline may result in the lead author's demotion from first
      authorship, and the lab will appoint a new lead.
    </p>
  </div>
</div>`;

  return { subject, html };
}

/** Accept/decline notification to the person who submitted the idea. */
export async function deliverIdeaDecision(opts: IdeaDecisionOpts): Promise<void> {
  const { subject, html } = renderIdeaDecisionEmail(opts);
  const sent = await sendEmail({ to: opts.to, from: FROM, subject, html });
  if (!sent.ok) throw new Error(sent.error ?? 'Email delivery failed.');
}

export async function deliverIdea(data: IdeaPayload, attachment?: Attachment): Promise<void> {
  const sent = await sendEmail({
    to: TO,
    from: FROM,
    replyTo: data.leadEmail,
    subject: `[MCA Heart] Research idea - ${data.title}`,
    html: renderEmail(data, Boolean(attachment)),
    attachments: attachment ? [attachment] : undefined,
  });
  if (!sent.ok) throw new Error(sent.error ?? 'Email delivery failed.');
}
