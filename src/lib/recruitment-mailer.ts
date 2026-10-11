import type { RecruitmentPayload } from './recruitment-schema';
import { sendEmail, type Attachment } from './email';
import { site } from '../data/site';
import { esc, p, heading, link, noteBlock, infoBox, dataTable, emailShell, FOOTER_ON_BEHALF, FOOTER_INTERNAL } from './email-layout';

/**
 * Recruitment emails, sent from researchlab@ (src/lib/email.ts). Env:
 *
 *   RECRUIT_TO    - where new applications are sent (falls back to IDEAS_TO)
 */
const TO =
  import.meta.env.RECRUIT_TO ??
  import.meta.env.IDEAS_TO ??
  'researchlab@mcaheart.com';

const LAB_EMAIL = 'researchlab@mcaheart.com';

/** New application -> the lab inbox. */
export async function deliverApplication(
  data: RecruitmentPayload,
  opts: { attachments: Attachment[]; filesInPanel: string[] },
): Promise<void> {
  const files = opts.filesInPanel.length
    ? p(`${esc(opts.filesInPanel.join(' and '))} ${opts.filesInPanel.length === 1 ? 'was' : 'were'} too large to attach. Please download ${opts.filesInPanel.length === 1 ? 'it' : 'them'} from the Applicants page.`, 'font-size:14px;margin-bottom:0')
    : opts.attachments.length
      ? p(`Attached: ${esc(opts.attachments.map((a) => a.filename).join(', '))}.`, 'font-size:14px;margin-bottom:0')
      : '';

  const inner =
    heading('New lab application') +
    dataTable([
      ['Name', data.name],
      ['Email', data.email],
      ['WhatsApp', data.whatsapp],
      ['Graduated medical school', data.gradYear],
      ['Current status', data.jobStatus],
      ['Cardiology fellowship plan', data.fellowshipPlan],
      ['Main research expertise', data.expertise],
      ['Profile link', data.profileLink],
      ['Research experience', data.researchExperience],
      ['Letter of interest', data.letterOfInterest],
      ['Current job / academic status', data.currentStatus || '-'],
      ['Professional goals', data.professionalGoals || '-'],
      ['Internal reference / prior collaboration', data.internalRef || '-'],
      ['How they heard about MCA', data.referralSource],
    ]) +
    files;

  const sent = await sendEmail({
    to: TO,
    replyTo: data.email,
    subject: `New lab application: ${data.name}`,
    html: emailShell(inner, FOOTER_INTERNAL),
    attachments: opts.attachments.length ? opts.attachments : undefined,
  });
  if (!sent.ok) throw new Error(sent.error ?? 'Email delivery failed.');
}

export interface ApplicationDecisionOpts {
  to: string;
  name: string;
  decision: 'approved' | 'withheld' | 'declined';
  note: string | null;
  cc?: string[];
  bcc?: string[];
}

// Sign-off shared by every decision letter, with the lab's contact details.
const SIGNOFF =
  p('Best regards,<br>Operations Team<br>MCA Heart Research Lab') +
  p(
    `Email: ${link(`mailto:${LAB_EMAIL}`, LAB_EMAIL)}<br>
     Website: ${link(site.url)}<br>
     X: ${link(site.x)}<br>
     Instagram: ${link(site.instagram)}`,
    'font-size:14px',
  );

/** Build the approve/withhold/decline email (template + reviewer note) without sending. */
export function renderApplicationDecisionEmail(
  opts: ApplicationDecisionOpts,
): { subject: string; html: string } {
  const name = esc(opts.name);
  const note = noteBlock(opts.note, 'Note from the lab');
  let subject: string;
  let inner: string;

  if (opts.decision === 'approved') {
    subject = 'Welcome to MCA Heart Research Lab as a Research Collaborator';
    inner =
      p(`Dear ${name},`) +
      p(`Thank you for completing the application form to join our research lab. After reviewing your responses, we are pleased to accept you and welcome you as a <strong>Research Collaborator at MCA Heart Research Lab</strong>.`) +
      p(`Led by <strong>Dr. Chadi Alraies</strong> and supported by Research Coordinators <strong>Jawad Basit</strong> and <strong>Muhammad Burhan</strong>, MCA Heart Research Lab is a global community of more than <strong>300 cardiology researchers</strong>. Our lab has a prolific record of consistently producing <strong>70+ peer-reviewed papers and 150+ conference abstracts annually</strong>.`) +
      p(`You can learn more about the lab at ${link(site.url)}.`) +
      p(`Upon joining our WhatsApp group, you will receive learning materials and resources to help you become familiar with our research workflow. For research ideas you would like to pursue through the lab, please contact a Research Coordinator to arrange a discussion with Dr. Alraies.`) +
      p(`Our team has expertise in <strong>TriNetX, NIS, NRD, NEDS, and meta-analysis</strong>, as well as data analysis, manuscript preparation, and research submission workflows. We may also be able to support <strong>conference submission and poster printing costs</strong> for conferences such as SCAI, TCT, and ACC, provided projects are reviewed by Dr. Alraies before the relevant deadlines and meet the requirements communicated by the lab.`) +
      p(`We encourage new members to develop expertise in a specific area, such as data extraction, screening, statistical analysis, visualization, scientific writing, or formatting. Building expertise in one area allows members to contribute consistently across multiple projects and strengthens the team's overall workflow.`) +
      p(`Our weekly meetings are held every <strong>Sunday at 12:00 PM EST</strong>, during which we review submissions, project updates, and ongoing research activities. Attendance is not mandatory, but regular participation is strongly encouraged to facilitate effective collaboration and engagement with the team.`) +
      p(`You will be added to the lab's WhatsApp platform shortly using the contact number provided in your application. Once added, you are welcome to introduce yourself to the other members. You will also have the opportunity to briefly introduce yourself during the upcoming Sunday meeting.`) +
      p(`In the meantime, we encourage you to follow our activities on Instagram and X using the links below. Should you have any questions or require assistance, please feel free to contact either of the Research Coordinators.`) +
      note +
      SIGNOFF +
      infoBox(
        `<strong style="display:block;margin-bottom:10px;color:#1a1a1a">Important information</strong>
         <strong>Project availability</strong><br>
         Addition to active projects is subject to project availability and may involve a waiting period of several weeks.<br><br>
         <strong>Submitting a research idea</strong><br>
         If you have an idea you would like to pursue through the lab, please submit it at ${link(`${site.url}/submit-idea`)}.<br><br>
         <strong>Letters of recommendation</strong><br>
         Joining the research group does not guarantee a Letter of Recommendation (LOR) from the PI or other faculty collaborators. LOR requests are evaluated individually and are based on a rigorous assessment of the member's performance, contribution, and engagement within the lab.`,
      );
  } else if (opts.decision === 'declined') {
    subject = 'Your application to MCA Heart Research Lab';
    inner =
      p(`Dear ${name},`) +
      p(`Thank you for taking the time to complete the application form for recruitment to our Remote Research Lab as a Research Collaborator/Member. We appreciate the time and effort you put into filling and submitting the application.`) +
      p(`We regret to inform you that we are unable to accommodate your application at this time. We receive substantially more applications than available collaboration opportunities, and the number of ongoing projects may already be exceeded by the interest from existing members. In light of this, we prefer not to onboard additional collaborators whom we may not be able to meaningfully engage in active projects. Therefore, this outcome should not be viewed as a negative assessment of your qualifications, but rather as a reflection of our specific selection criteria and current capacity.`) +
      p(`Once again, we sincerely appreciate your interest in joining our team and encourage you to reach out again in the future should new opportunities arise. Please do not hesitate to contact us if you have any questions.`) +
      note +
      SIGNOFF;
  } else {
    subject = 'Your application to MCA Heart Research Lab is on hold';
    inner =
      p(`Dear ${name},`) +
      p(`Thank you for applying to the MCA Heart Research Lab. Your application is currently on hold, which means that a final decision has not yet been made.`) +
      p(`We may contact you with a few questions, or revisit your application once a position becomes available. We will inform you of the final outcome in due course.`) +
      note +
      SIGNOFF;
  }

  return { subject, html: emailShell(inner, FOOTER_ON_BEHALF) };
}

export async function deliverApplicationDecision(opts: ApplicationDecisionOpts): Promise<void> {
  const { subject, html } = renderApplicationDecisionEmail(opts);
  const sent = await sendEmail({ to: opts.to, cc: opts.cc, bcc: opts.bcc, subject, html });
  if (!sent.ok) throw new Error(sent.error ?? 'Email delivery failed.');
}
