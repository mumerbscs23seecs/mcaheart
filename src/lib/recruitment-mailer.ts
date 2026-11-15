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

// A small heading inside a letter.
const subhead = (text: string) =>
  p(`<strong style="color:#1a1a1a;font-size:15px">${esc(text)}</strong>`, 'margin:22px 0 6px');

// Sign-off shared by every decision letter, with the lab's contact details.
const SIGNOFF =
  p('Best regards,<br>Operations Team<br>MCA Heart Research Lab') +
  p(`Email: ${link(`mailto:${LAB_EMAIL}`, LAB_EMAIL)}`, 'font-size:14px');

/** Build the approve/withhold/decline email (template + reviewer note) without sending. */
export function renderApplicationDecisionEmail(
  opts: ApplicationDecisionOpts,
): { subject: string; html: string } {
  const name = esc(opts.name);
  const note = noteBlock(opts.note, 'Note from the lab');
  let subject: string;
  let inner: string;

  if (opts.decision === 'approved') {
    subject = 'Welcome to MCA Heart Research Lab as a Remote Research Collaborator';
    inner =
      p(`Dear ${name},`) +
      p(`Thank you for your interest in MCA Heart Research Lab and for completing our application process. Following a review of your application, we are pleased to welcome you as a <strong>Remote Research Collaborator</strong> for an initial period of six months, effective today.`) +
      p(`Led by <strong>Dr. Chadi Alraies</strong>, with support from Research Fellows <strong>Jawad Basit</strong> and <strong>Muhammad Burhan</strong> and our administrative team, the lab brings together more than <strong>300 cardiology researchers</strong> worldwide. It produces over <strong>70 peer-reviewed publications and 150 conference abstracts</strong> annually, with expertise spanning <strong>TriNetX, NIS, NRD, NEDS, and meta-analysis</strong>.`) +
      subhead('Onboarding') +
      p(`You will shortly be added to the lab's WhatsApp group using the contact number provided in your application. There, you will receive introductory materials, workflow guidance, and information about available opportunities. Once added, please introduce yourself to the team.`) +
      p(`We encourage you to develop expertise in an area such as literature screening, data extraction, statistical analysis, visualization, scientific writing, or manuscript formatting. Building these skills will help you contribute consistently across projects and strengthen the team's research activities.`) +
      subhead('Weekly Meetings') +
      p(`Our weekly meetings take place every <strong>Sunday at 12:00 noon Eastern Time (US)</strong>. They cover project updates, submissions, and ongoing research activities. Attendance is encouraged but not mandatory, and you will have an opportunity to introduce yourself briefly at an upcoming meeting.`) +
      subhead('Conference Support') +
      p(`Financial support for conference submissions and poster printing may be available for selected projects presented at meetings such as SCAI, TCT, and ACC. Support is subject to prior review by Dr. Alraies, applicable deadlines, and the requirements communicated by the lab.`) +
      p(`We look forward to working with you. If you have questions or need assistance during onboarding, please contact a Research Fellow or reply to this email.`) +
      note +
      p('Sincerely,<br>Operations Team<br>MCA Heart Research Lab') +
      p(`Email: ${link(`mailto:${LAB_EMAIL}`, LAB_EMAIL)}`, 'font-size:14px') +
      infoBox(
        `<strong style="display:block;margin-bottom:12px;color:#1a1a1a;font-size:15px">Important Information</strong>
         <strong>Appointment and continued participation</strong><br>
         Your initial collaborator appointment is for six months, beginning today. Continued affiliation requires active participation and meaningful contributions. These may include:
         <ul style="margin:8px 0 10px;padding-left:20px">
           <li style="margin:0 0 3px">Proposing research ideas that receive approval</li>
           <li style="margin:0 0 3px">Completing assigned project tasks on time</li>
           <li style="margin:0 0 3px">Responding to open calls for manuscript contributors and fulfilling the associated responsibilities</li>
           <li style="margin:0 0 3px">Contributing to conference submissions or presentations</li>
         </ul>
         Members who remain inactive for three consecutive months without prior approval or a reasonable explanation will be removed from the active research team following two warnings. At the end of your six-month appointment, your contributions, performance, and overall engagement will be reviewed to determine eligibility for continued collaboration.<br><br>
         <strong>Project availability</strong><br>
         Assignment to active projects depends on availability and may involve a waiting period of several weeks. During this time, we encourage you to review the introductory resources, attend meetings, develop relevant research skills, and submit your own research idea.<br><br>
         <strong>Submitting a research idea</strong><br>
         To propose a research idea, please use our ${link(`${site.url}/submit-idea`, 'research idea submission form')}. A Research Coordinator can help arrange further discussion with Dr. Alraies when appropriate.<br><br>
         <strong>Letters of recommendation</strong><br>
         Lab membership does not guarantee a letter of recommendation from the Principal Investigator or other faculty collaborators. Requests are considered individually based on the member's demonstrated contributions, performance, reliability, and engagement. Members must be actively participating in the lab when submitting a request.`,
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
