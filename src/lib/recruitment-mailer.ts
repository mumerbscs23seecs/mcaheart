import type { RecruitmentPayload } from './recruitment-schema';
import { sendEmail, type Attachment } from './email';
import { site } from '../data/site';

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
    <p style="margin:0 0 4px;color:#a51c30;font:700 11px/1 Arial,sans-serif;text-transform:uppercase;letter-spacing:.22em">MCA Heart Research Lab</p>
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
  decision: 'approved' | 'withheld' | 'declined';
  note: string | null;
}

const DECISION_HEADING: Record<ApplicationDecisionOpts['decision'], string> = {
  approved: 'Welcome to MCA Heart Research Lab',
  withheld: 'Application on hold',
  declined: 'Application outcome',
};

// Signature block shared by the approved/declined letters - matches the
// lab's own template wording verbatim.
const SIGNOFF = `<p style="margin:24px 0 0;color:#1e293b;font:14px/1.6 Arial,sans-serif">
      Best regards,<br />Operations Team<br />MCA Heart Research Lab
    </p>
    <p style="margin:14px 0 0;color:#1e293b;font:13px/1.7 Arial,sans-serif">
      <strong>Website:</strong> <a href="${site.url}" style="color:#a51c30">${site.url}</a><br />
      <strong>X:</strong> <a href="${site.x}" style="color:#a51c30">${site.x}</a><br />
      <strong>Instagram:</strong> <a href="${site.instagram}" style="color:#a51c30">${site.instagram}</a>
    </p>
    <p style="margin:14px 0 0;color:#64748b;font:italic 12px/1.6 Arial,sans-serif">This message was sent by Dr. M. Chadi Alraies' team on his behalf.</p>`;

/** Build the approve/withhold/decline email (template + reviewer note) without sending. */
export function renderApplicationDecisionEmail(
  opts: ApplicationDecisionOpts,
): { subject: string; html: string } {
  const name = esc(opts.name);
  const noteBlock = opts.note
    ? `<p style="margin:16px 0 0;padding:12px 14px;background:#f1f5f9;border-radius:8px;color:#1e293b;font:14px/1.6 Arial,sans-serif;white-space:pre-wrap"><strong>Note:</strong> ${esc(opts.note)}</p>`
    : '';

  let subject: string;
  let body: string;

  if (opts.decision === 'approved') {
    subject = 'Welcome to MCA Heart Research Lab as a Research Collaborator';
    body = `<p style="margin:0 0 14px;color:#1e293b;font:14px/1.6 Arial,sans-serif">Dear ${name},</p>
    <p style="margin:0 0 14px;color:#1e293b;font:14px/1.6 Arial,sans-serif">
      Thank you for completing the application form to join our research lab. After reviewing your responses,
      we are pleased to accept you and welcome you as a <strong>Research Collaborator at MCA Heart Research Lab</strong>.
    </p>
    <p style="margin:0 0 14px;color:#1e293b;font:14px/1.6 Arial,sans-serif">
      Led by <strong>Dr. Chadi Alraies</strong> and supported by Research Coordinators <strong>Jawad Basit</strong>
      and <strong>Muhammad Burhan</strong>, MCA Heart Research Lab is a global community of more than
      <strong>300 cardiology researchers</strong>. Our lab has a prolific record of consistently producing
      <strong>70+ peer-reviewed papers and 150+ conference abstracts annually</strong>.
    </p>
    <p style="margin:0 0 14px;color:#1e293b;font:14px/1.6 Arial,sans-serif">
      You can learn more about the lab at <a href="${site.url}" style="color:#a51c30">${site.url}</a>.
    </p>
    <p style="margin:0 0 14px;color:#1e293b;font:14px/1.6 Arial,sans-serif">
      Upon joining our WhatsApp group, you will receive learning materials and resources to help you become
      familiar with our research workflow. For research ideas you would like to pursue through the lab, please
      contact a Research Coordinator to arrange a discussion with Dr. Alraies.
    </p>
    <p style="margin:0 0 14px;color:#1e293b;font:14px/1.6 Arial,sans-serif">
      Our team has expertise in <strong>TriNetX, NIS, NRD, NEDS, and meta-analysis</strong>, as well as data
      analysis, manuscript preparation, and research submission workflows. We may also be able to support
      <strong>conference submission and poster printing costs</strong> for conferences such as SCAI, TCT, and
      ACC, provided projects are reviewed by Dr. Alraies before the relevant deadlines and meet the
      requirements communicated by the lab.
    </p>
    <p style="margin:0 0 14px;color:#1e293b;font:14px/1.6 Arial,sans-serif">
      We encourage new members to develop expertise in a specific area, such as data extraction, screening,
      statistical analysis, visualization, scientific writing, or formatting. Building expertise in one area
      allows members to contribute consistently across multiple projects and strengthens the team's overall
      workflow.
    </p>
    <p style="margin:0 0 14px;color:#1e293b;font:14px/1.6 Arial,sans-serif">
      Our weekly meetings are held every <strong>Sunday at 12:00 PM EST</strong>, during which we review
      submissions, project updates, and ongoing research activities. Attendance is not mandatory, but regular
      participation is strongly encouraged to facilitate effective collaboration and engagement with the team.
    </p>
    <p style="margin:0 0 14px;color:#1e293b;font:14px/1.6 Arial,sans-serif">
      You will be added to the lab's WhatsApp platform shortly using the contact number provided in your
      application. Once added, you are welcome to introduce yourself to the other members. You will also have
      the opportunity to briefly introduce yourself during the upcoming Sunday meeting.
    </p>
    <p style="margin:0;color:#1e293b;font:14px/1.6 Arial,sans-serif">
      In the meantime, we encourage you to follow our activities on Instagram and X using the links below.
      Should you have any questions or require assistance, please feel free to contact either of the Research
      Coordinators.
    </p>
    ${SIGNOFF}
    <div style="margin:26px 0 0;padding:16px;background:#f1f5f9;border-radius:8px">
      <p style="margin:0 0 10px;color:#a51c30;font:700 11px/1 Arial,sans-serif;text-transform:uppercase;letter-spacing:.14em">Important information</p>
      <p style="margin:0 0 4px;color:#1e293b;font:700 13px/1.5 Arial,sans-serif">Project availability</p>
      <p style="margin:0 0 12px;color:#1e293b;font:13px/1.6 Arial,sans-serif">Addition to active projects is subject to project availability and may involve a waiting period of several weeks.</p>
      <p style="margin:0 0 4px;color:#1e293b;font:700 13px/1.5 Arial,sans-serif">Submitting a research idea</p>
      <p style="margin:0 0 12px;color:#1e293b;font:13px/1.6 Arial,sans-serif">If you have an idea you would like to pursue through the lab, please submit it at <a href="${site.url}/submit-idea" style="color:#a51c30">${site.url}/submit-idea</a>.</p>
      <p style="margin:0 0 4px;color:#1e293b;font:700 13px/1.5 Arial,sans-serif">Letters of recommendation</p>
      <p style="margin:0;color:#1e293b;font:13px/1.6 Arial,sans-serif">Joining the research group does not guarantee a Letter of Recommendation (LOR) from the PI or other faculty collaborators. LOR requests are evaluated individually and are based on a rigorous assessment of the member's performance, contribution, and engagement within the lab.</p>
    </div>`;
  } else if (opts.decision === 'declined') {
    subject = '[MCA Heart Research Lab] Your application outcome';
    body = `<p style="margin:0 0 14px;color:#1e293b;font:14px/1.6 Arial,sans-serif">Dear ${name},</p>
    <p style="margin:0 0 14px;color:#1e293b;font:14px/1.6 Arial,sans-serif">
      Thank you for taking the time to complete the application form for recruitment to our Remote Research Lab
      as a Research Collaborator/Member. We appreciate the time and effort you put into filling and submitting
      the application.
    </p>
    <p style="margin:0 0 14px;color:#1e293b;font:14px/1.6 Arial,sans-serif">
      We regret to inform you that we are unable to accommodate your application at this time. We receive
      substantially more applications than available collaboration opportunities, and the number of ongoing
      projects may already be exceeded by the interest from existing members. In light of this, we prefer not
      to onboard additional collaborators whom we may not be able to meaningfully engage in active projects.
      Therefore, this outcome should not be viewed as a negative assessment of your qualifications, but rather
      as a reflection of our specific selection criteria and current capacity.
    </p>
    <p style="margin:0;color:#1e293b;font:14px/1.6 Arial,sans-serif">
      Once again, we sincerely appreciate your interest in joining our team and encourage you to reach out
      again in the future should new opportunities arise. Please do not hesitate to contact us if you have any
      questions.
    </p>
    ${SIGNOFF}`;
  } else {
    subject = '[MCA Heart Research Lab] Your application - on hold';
    body = `<p style="margin:0 0 8px;color:#1e293b;font:14px/1.6 Arial,sans-serif">Hi ${name},</p>
    <p style="margin:0;color:#1e293b;font:14px/1.6 Arial,sans-serif">
      Thank you for applying to the MCA Heart Research Lab. Your application is currently on hold rather than
      decided either way - this is not a final answer. We may follow up with a few questions, or revisit it
      once a spot opens up, and will get back to you with a final outcome in due course.
    </p>
    <p style="margin:16px 0 0;color:#64748b;font:12px/1.6 Arial,sans-serif">Questions: researchoperations@mcaheart.com</p>`;
  }

  const html = `<div style="background:#f8fafc;padding:28px">
  <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid rgba(43,57,144,.14);border-radius:12px;padding:28px">
    <p style="margin:0 0 4px;color:#a51c30;font:700 11px/1 Arial,sans-serif;text-transform:uppercase;letter-spacing:.22em">MCA Heart Research Lab</p>
    <h1 style="margin:0 0 16px;color:#1e293b;font:600 20px/1.3 Georgia,serif">${DECISION_HEADING[opts.decision]}</h1>
    ${body}
    ${noteBlock}
  </div>
</div>`;

  return { subject, html };
}

export async function deliverApplicationDecision(opts: ApplicationDecisionOpts): Promise<void> {
  const { subject, html } = renderApplicationDecisionEmail(opts);
  const sent = await sendEmail({ to: opts.to, from: FROM, subject, html });
  if (!sent.ok) throw new Error(sent.error ?? 'Email delivery failed.');
}
