import type { RecruitmentPayload } from './recruitment-schema';
import { sendEmail, type Attachment } from './email';

/**
 * Recruitment emails. Transport (Gmail SMTP / Resend / log) lives in
 * src/lib/email.ts. Env vars:
 *
 *   RECRUIT_TO    – where new applications are sent (falls back to IDEAS_TO / CONTACT_TO)
 *   RECRUIT_FROM  – sender (ignored by the Gmail transport)
 */
const TO =
  import.meta.env.RECRUIT_TO ??
  import.meta.env.IDEAS_TO ??
  import.meta.env.CONTACT_TO ??
  'studio@medishift.in';
const FROM = import.meta.env.RECRUIT_FROM ?? 'MCA Heart <onboarding@resend.dev>';

function esc(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function rows(d: RecruitmentPayload): string {
  const items: Array<[string, string]> = [
    ['Name', d.name],
    ['Email', d.email],
    ['WhatsApp', d.whatsapp],
    ['Graduated medical school', d.gradYear],
    ['Current status', d.jobStatus],
    ['Cardiology fellowship plan', d.fellowshipPlan],
    ['Main research expertise', d.expertise],
    ['Profile link', d.profileLink],
    ['Research experience', d.researchExperience],
    ['Letter of interest', d.letterOfInterest],
    ['Current job/academic status', d.currentStatus || '-'],
    ['Professional goals', d.professionalGoals || '-'],
    ['Internal reference / prior collaboration', d.internalRef || '-'],
    ['How they heard about MCA', d.referralSource],
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

export async function deliverApplication(
  data: RecruitmentPayload,
  opts: { attachments: Attachment[]; filesInPanel: string[] },
): Promise<void> {
  const note = opts.filesInPanel.length
    ? `<p style="margin:18px 0 0;color:#92600e;font:13px/1.5 Arial,sans-serif">
         ${opts.filesInPanel.join(' and ')} too large to attach - download from the admin panel.</p>`
    : opts.attachments.length
      ? `<p style="margin:18px 0 0;color:#166534;font:600 13px/1.5 Arial,sans-serif">📎 ${opts.attachments
          .map((a) => a.filename)
          .join(', ')} attached.</p>`
      : '';

  const html = `<div style="background:#f8fafc;padding:28px">
  <div style="max-width:660px;margin:0 auto;background:#fff;border:1px solid rgba(43,57,144,.14);border-radius:12px;padding:28px">
    <p style="margin:0 0 4px;color:#a51c30;font:700 11px/1 Arial,sans-serif;text-transform:uppercase;letter-spacing:.22em">MCA Research Lab</p>
    <h1 style="margin:0 0 18px;color:#1e293b;font:600 21px/1.25 Georgia,serif">New recruitment application</h1>
    <table style="border-collapse:collapse;width:100%">${rows(data)}</table>
    ${note}
  </div>
</div>`;

  const sent = await sendEmail({
    to: TO,
    from: FROM,
    replyTo: data.email,
    subject: `[MCA Lab] Application - ${data.name}`,
    html,
    attachments: opts.attachments.length ? opts.attachments : undefined,
  });
  if (!sent.ok) throw new Error(sent.error ?? 'Email delivery failed.');
}

export interface ApplicationDecisionOpts {
  to: string;
  name: string;
  decision: 'accepted' | 'declined';
  note: string | null;
}

/** Build the accept/decline email (template + reviewer note) without sending. */
export function renderApplicationDecisionEmail(
  opts: ApplicationDecisionOpts,
): { subject: string; html: string } {
  const accepted = opts.decision === 'accepted';
  const subject = `[MCA Research Lab] Your application - ${accepted ? 'accepted' : 'outcome'}`;
  const lead = accepted
    ? 'Congratulations - your application to join the MCA Research Lab has been accepted. Someone from research operations will be in touch shortly with onboarding details.'
    : 'Thank you for applying to the MCA Research Lab. After review, we are not able to take your application forward at this time. We wish you the best and welcome a future application.';
  const noteBlock = opts.note
    ? `<p style="margin:16px 0 0;padding:12px 14px;background:#f1f5f9;border-radius:8px;color:#1e293b;font:14px/1.6 Arial,sans-serif;white-space:pre-wrap"><strong>Note:</strong> ${esc(opts.note)}</p>`
    : '';

  const html = `<div style="background:#f8fafc;padding:28px">
  <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid rgba(43,57,144,.14);border-radius:12px;padding:28px">
    <p style="margin:0 0 4px;color:#a51c30;font:700 11px/1 Arial,sans-serif;text-transform:uppercase;letter-spacing:.22em">MCA Research Lab</p>
    <h1 style="margin:0 0 12px;color:#1e293b;font:600 20px/1.3 Georgia,serif">${accepted ? 'Application accepted' : 'Application outcome'}</h1>
    <p style="margin:0 0 8px;color:#1e293b;font:14px/1.6 Arial,sans-serif">Hi ${esc(opts.name)},</p>
    <p style="margin:0;color:#1e293b;font:14px/1.6 Arial,sans-serif">${lead}</p>
    ${noteBlock}
    <p style="margin:16px 0 0;color:#64748b;font:12px/1.6 Arial,sans-serif">Questions: researchoperations@mcaheart.com</p>
  </div>
</div>`;

  return { subject, html };
}

export async function deliverApplicationDecision(opts: ApplicationDecisionOpts): Promise<void> {
  const { subject, html } = renderApplicationDecisionEmail(opts);
  const sent = await sendEmail({ to: opts.to, from: FROM, subject, html });
  if (!sent.ok) throw new Error(sent.error ?? 'Email delivery failed.');
}
