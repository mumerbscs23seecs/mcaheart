import { sendEmail } from './email';

const esc = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const FONT = "'Open Sans', 'Segoe UI', Helvetica, Arial, sans-serif";
const RED = '#7a1322';
const TEXT = '#333333';
const MUTED = '#777777';

const p = (html: string, extra = '') =>
  `<p style="margin:0 0 20px;color:${TEXT};font-family:${FONT};font-size:16px;line-height:1.6;${extra}">${html}</p>`;

const button = (href: string, label: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:8px auto 28px">
    <tr><td style="background:${RED};border-radius:4px">
      <a href="${href}" style="display:inline-block;padding:15px 44px;color:#ffffff;font-family:${FONT};font-size:16px;font-weight:600;text-decoration:none">${label}</a>
    </td></tr>
  </table>`;

const noteBlock = (note?: string, label = 'Note from the coordinator') =>
  note
    ? `<div style="margin:0 0 24px;padding:16px 18px;background:#f6f6f6;border-left:3px solid ${RED};color:${TEXT};font-family:${FONT};font-size:15px;line-height:1.6;white-space:pre-wrap"><strong>${label}:</strong><br>${esc(note)}</div>`
    : '';

/** Wiley-style frame: grey page, centered wordmark, white card, small footer. */
function shell(inner: string, footer: string, signoff = true) {
  return `<style>@import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&display=swap');</style>
<div style="background:#f3f3f3;padding:40px 16px;font-family:${FONT}">
  <div style="max-width:640px;margin:0 auto">
    <p style="margin:0 0 32px;text-align:center;font-family:${FONT};font-size:26px;font-weight:700;letter-spacing:0.04em;color:#1a1a1a">
      <span style="color:${RED}">MCA</span> HEART
    </p>
    <div style="background:#ffffff;padding:44px 48px 36px">
      ${inner}
      ${signoff ? p('Kind regards,<br>MCA Heart Research Lab', 'margin-bottom:0') : ''}
    </div>
    <p style="margin:20px 0 0;text-align:center;color:${MUTED};font-family:${FONT};font-size:12px;line-height:1.6">${footer}</p>
  </div>
</div>`;
}

const FOOTER =
  'This is an automated message from the MCA Heart Research Workflow. Please reply to this email rather than on WhatsApp so that the conversation stays on record.';

export type TransitionTemplate =
  | 'conference_assigned'
  | 'abstract_accepted'
  | 'abstract_rejected'
  | 'proceeding_full_text'
  | 'not_proceeding_full_text'
  | 'submitted_to_journal'
  | 'stage_update'
  | 'journal_accepted'
  | 'journal_rejected'
  | 'journal_withdrawn'
  | 'published'
  | 'request_approved'
  | 'request_declined';

export interface TransitionOpts {
  to: string[];
  template: TransitionTemplate;
  /** Full academic title where one exists, otherwise the short title. */
  projectTitle: string;
  /** Conference / journal name, where relevant. */
  venue?: string;
  /** Human-readable target-stage label, for generic stage bumps and request decisions. */
  stageLabel?: string;
  /** Stage code, so stage_update can use wording written for that specific stage. */
  stage?: string;
  phase?: string;
  actor: string;
  note?: string;
  link: string;
}

type Copy = { subject: string; body: string };

/** Formal wording for each stage a paper can be moved to by hand. `t` is the
 *  quoted, escaped title; `v` the escaped venue name. */
function stageCopy(phase: string | undefined, stage: string | undefined, t: string, v: string | null, label: string): Copy {
  const journal = v ? `<strong>${v}</strong>` : 'the journal';
  const conf = v ? `<strong>${v}</strong>` : 'the conference';
  const ms = (n: number, what: string, ask: string): Copy => ({
    subject: `Manuscript stage ${n} of 6`,
    body: `${p(`Please note that the manuscript ${t} has moved to stage ${n} of 6: ${what}.`)}${p(ask)}`,
  });

  if (phase === 'journal') {
    switch (stage) {
      case 'awaited':
        return {
          subject: 'Submission awaited',
          body: p(`Please note that the paper ${t} is now awaiting submission to ${journal}.`) +
            p('Kindly complete any outstanding items as soon as possible so that the paper can be submitted without delay.'),
        };
      case 'submitted':
        return {
          subject: 'Submitted to the journal',
          body: p(`Please note that the paper ${t} has been submitted to ${journal} and is now with the editor.`) +
            p('No action is required from you at this stage. We will inform you as soon as there is an update from the journal.'),
        };
      case 'under_review':
        return {
          subject: 'Under peer review',
          body: p(`Please note that the paper ${t} is now under peer review at ${journal}.`) +
            p('No action is required from you at this stage. We will contact you as soon as the reviewers\' comments are received.'),
        };
      case 'revision_req':
        return {
          subject: 'Revision requested',
          body: p(`Please note that ${journal} has requested revisions to the paper ${t}.`) +
            p('Kindly review the reviewers\' comments carefully and prepare the revised manuscript and the response to reviewers as soon as possible, ideally within 7 days, so that the revision can be resubmitted on time.'),
        };
      case 'revision_review':
        return {
          subject: 'Revision under review',
          body: p(`Please note that the revised version of the paper ${t} has been resubmitted to ${journal} and is now under review.`) +
            p('No action is required from you at this stage. We will inform you as soon as a decision is received.'),
        };
      case 'halted':
        return {
          subject: 'Temporarily halted',
          body: p(`Please note that work on the paper ${t} has been temporarily halted.`) +
            p('Kindly pause any further work on this paper until you hear from the coordinator.'),
        };
      case 'rejected_comments':
        return {
          subject: 'Rejected with comments',
          body: p(`We regret to inform you that the paper ${t} has been rejected with comments by ${journal}.`) +
            p('Kindly review the comments and address them as soon as possible, so that the paper can be submitted to another journal within 7 days.'),
        };
      case 'rejected_no_comments':
        return {
          subject: 'Rejected without comments',
          body: p(`We regret to inform you that the paper ${t} has been rejected by ${journal} without reviewer comments.`) +
            p('Kindly prepare the manuscript for another journal, adjusting the formatting to its requirements, so that it can be submitted within 7 days.'),
        };
      case 'accepted':
        return {
          subject: 'Accepted for publication',
          body: p(`We are pleased to inform you that the paper ${t} has been accepted for publication by ${journal}.`) +
            p('Congratulations to everyone involved. Kindly look out for the proofs and respond to them promptly when they arrive.'),
        };
      case 'published':
        return {
          subject: 'Published',
          body: p(`We are pleased to inform you that the paper ${t} has now been published.`) +
            p('Congratulations to everyone involved, and thank you for all of your work on it.'),
        };
    }
  }

  if (phase === 'manuscript') {
    switch (stage) {
      case 'ms_1_4':
        return ms(1, 'the analysis has been shared and is being revised', 'Kindly review the analysis and proceed with the next steps as soon as possible.');
      case 'ms_2_4':
        return ms(2, 'the results and methods are being written', 'Kindly continue drafting these sections and keep the draft link on the project page up to date.');
      case 'ms_3_4':
        return ms(3, 'the introduction and discussion are being written', 'Kindly continue drafting these sections and keep the draft link on the project page up to date.');
      case 'ms_4_4':
        return ms(4, 'final formatting, tables, references and supplementary files', 'Kindly complete the formatting and supporting files so that the manuscript can be sent for internal review.');
      case 'ms_5_review':
        return ms(5, 'the manuscript has been sent to RG Operations for review', 'No action is required from you until the review comments are returned.');
      case 'ms_6_comments':
        return ms(6, 'the comments from RG Operations are being addressed', 'Kindly address all of the comments as soon as possible so that the manuscript can be submitted to a journal.');
    }
  }

  switch (stage) {
    case 'no_progress':
      return {
        subject: 'Status updated: No progress',
        body: p(`Please note that the status of the project ${t} has been set to No progress.`) +
          p('Kindly begin work on the project and update its status as soon as progress is made.'),
      };
    case 'plan_final':
      return {
        subject: 'Analysis plan finalized',
        body: p(`Please note that the analysis plan for the project ${t} has been finalized.`) +
          p('Kindly proceed with the next step of the analysis.'),
      };
    case 'screening':
      return {
        subject: 'Screening and extraction',
        body: p(`Please note that the project ${t} has moved to screening and data extraction.`) +
          p('Kindly complete the screening and extraction as soon as possible.'),
      };
    case 'analysis_done':
      return {
        subject: 'Analysis completed',
        body: p(`Please note that the analysis for the project ${t} has been completed.`) +
          p('Kindly proceed with preparing the abstract.'),
      };
    case 'ready':
      return {
        subject: 'Ready for submission',
        body: p(`Please note that the project ${t} is now marked as ready for submission.`),
      };
    case 'submitted':
      return {
        subject: 'Abstract submitted',
        body: p(`Please note that the abstract for the project ${t} has been submitted to ${conf}.`) +
          p('No action is required from you at this stage. We will inform you as soon as a decision is received.'),
      };
    case 'accepted':
      return {
        subject: 'Abstract accepted',
        body: p(`We are pleased to inform you that the abstract for the project ${t} has been accepted at ${conf}.`) +
          p('Congratulations to everyone involved.'),
      };
    case 'not_sent':
      return {
        subject: 'Abstract not sent',
        body: p(`Please note that the abstract for the project ${t} was not sent to ${conf}, as it was not completed in time.`) +
          p('The coordinator will advise you on the next steps, including whether it can be submitted to another conference.'),
      };
    case 'rejected':
      return {
        subject: 'Abstract not accepted',
        body: p(`We regret to inform you that the abstract for the project ${t} was not accepted at ${conf}.`) +
          p('The coordinator will advise you on the next steps.'),
      };
  }

  return {
    subject: `Status updated: ${label}`,
    body: p(`Please note that the status of the paper ${t} has been updated to <strong>${esc(label)}</strong>.`),
  };
}

/** Every project status change routes through one of these. Pure render: call
 *  sendEmail yourself, or use this directly to show a preview before sending. */
export function renderTransitionEmail(opts: TransitionOpts): { subject: string; html: string } {
  const t = `"${esc(opts.projectTitle)}"`;
  const v = opts.venue ? esc(opts.venue) : null;
  const label = opts.stageLabel ?? 'a new status';

  const copies: Record<Exclude<TransitionTemplate, 'stage_update'>, Copy> = {
    conference_assigned: {
      subject: `Assigned to ${opts.venue ?? 'a conference'}`,
      body: p(`Please note that the project ${t} has been assigned to <strong>${v ?? 'a conference'}</strong>.`) +
        p('Kindly begin preparing the abstract and keep the coordinator informed of your progress.'),
    },
    abstract_accepted: {
      subject: 'Abstract accepted',
      body: p(`We are pleased to inform you that the abstract for the project ${t} has been accepted at <strong>${v ?? 'the conference'}</strong>.`) +
        p('Congratulations to everyone involved.'),
    },
    abstract_rejected: {
      subject: 'Abstract not accepted',
      body: p(`We regret to inform you that the abstract for the project ${t} was not accepted at <strong>${v ?? 'the conference'}</strong>.`) +
        p('The coordinator will advise you on the next steps.'),
    },
    proceeding_full_text: {
      subject: 'Proceeding to full manuscript',
      body: p(`Please note that the project ${t} will now proceed to a full manuscript, and it appears under Ongoing in the Workflow.`) +
        p('Kindly add the link to your working draft on the project page and begin writing.'),
    },
    not_proceeding_full_text: {
      subject: 'Not proceeding to full manuscript',
      body: p(`Please note that, after review, the coordinator has decided that the project ${t} will not proceed to a full manuscript, and it has been closed.`) +
        p('Thank you for your work on this project.'),
    },
    submitted_to_journal: {
      subject: `Submitted to ${opts.venue ?? 'a journal'}`,
      body: p(`Please note that the manuscript ${t} has been submitted to <strong>${v ?? 'a journal'}</strong>, and it now appears under Submissions in the Workflow.`) +
        p('No action is required from you at this stage. We will inform you as soon as there is an update from the journal.'),
    },
    journal_accepted: {
      subject: 'Accepted for publication',
      body: p(`We are pleased to inform you that the paper ${t} has been accepted for publication by <strong>${v ?? 'the journal'}</strong>.`) +
        p('Congratulations to everyone involved. Kindly look out for the proofs and respond to them promptly when they arrive.'),
    },
    journal_rejected: {
      subject: 'Paper rejected',
      body: p(`We regret to inform you that the paper ${t} has been rejected by <strong>${v ?? 'the journal'}</strong>.`) +
        p('Kindly review any comments received and prepare the manuscript for submission to another journal within 7 days.'),
    },
    journal_withdrawn: {
      subject: 'Submission withdrawn',
      body: p(`Please note that the submission of the paper ${t} to <strong>${v ?? 'the journal'}</strong> has been withdrawn.`) +
        p('The coordinator will advise you on the next steps.'),
    },
    published: {
      subject: 'Published',
      body: p(`We are pleased to inform you that the paper ${t} has now been published.`) +
        p('Congratulations to everyone involved, and thank you for all of your work on it.'),
    },
    request_approved: {
      subject: 'Status request approved',
      body: p(`Please note that your request to update the status of ${t} to <strong>${esc(label)}</strong> has been approved.`),
    },
    request_declined: {
      subject: 'Status request declined',
      body: p(`Please note that your request to update the status of ${t} to <strong>${esc(label)}</strong> has been declined.`) +
        p('Please see the note below, if any, or contact the coordinator for further details.'),
    },
  };

  const c = opts.template === 'stage_update' ? stageCopy(opts.phase, opts.stage, t, v, label) : copies[opts.template];
  const inner =
    p('Dear colleagues,') +
    c.body +
    noteBlock(opts.note) +
    button(opts.link, 'View the paper');
  return {
    subject: `${c.subject}: ${opts.projectTitle}`,
    html: shell(inner, `Updated by ${esc(opts.actor)}. ${FOOTER}`),
  };
}

/** Render + send in one call. Prefer renderTransitionEmail() + sendEmail() directly
 *  where a preview/edit step sits in between (every pipeline action now has one). */
export async function deliverTransition(opts: TransitionOpts) {
  if (!opts.to.length) return { ok: false, error: 'no recipients with a real email' };
  const { subject, html } = renderTransitionEmail(opts);
  return sendEmail({ to: opts.to, subject, html });
}

/** A member proposed a status change, so notify the admins. No preview: this is a
 *  system notice, not an authored message, so it always goes out immediately. */
export async function deliverRequestSubmitted(opts: {
  to: string[];
  projectTitle: string;
  requester: string;
  stageLabel: string;
  note?: string;
  link: string;
}) {
  if (!opts.to.length) return { ok: false, error: 'no recipients' };
  const t = `"${esc(opts.projectTitle)}"`;
  const inner =
    p('Dear coordinator,') +
    p(`<strong>${esc(opts.requester)}</strong> has requested that the status of ${t} be updated to <strong>${esc(opts.stageLabel)}</strong>.`) +
    p('Kindly review the request and approve or decline it at your earliest convenience.') +
    noteBlock(opts.note, `Note from ${esc(opts.requester)}`) +
    button(opts.link, 'Review the request');
  const subject = `Status change requested: ${opts.projectTitle}`;
  return sendEmail({ to: opts.to, subject, html: shell(inner, FOOTER) });
}

/**
 * The manuscript-stagnation cascade, sent from the daily reminder sweep when
 * an Ongoing project has had no stage change:
 *   nudge      (7 days)  -> member
 *   escalation (12 days) -> member + coordinators
 *   final      (20 days) -> member + coordinators; project flagged for reassignment
 */
export async function deliverPipelineReminder(opts: {
  to: string[];
  stage: 'nudge' | 'escalation' | 'final';
  projectTitle: string;
  daysIdle: number;
  currentStage: string;
  link: string;
}) {
  if (!opts.to.length) return { ok: false, error: 'no recipients' };
  const t = `"${esc(opts.projectTitle)}"`;
  const s = `"${esc(opts.currentStage)}"`;

  const copy = {
    nudge: {
      subject: `Reminder: no update in ${opts.daysIdle} days`,
      body:
        p(`This is a reminder that the manuscript ${t} has had no status update in <strong>${opts.daysIdle} days</strong> and remains at ${s}.`) +
        p('Kindly move it forward and update its status, or reply to this email to let us know where it stands.'),
    },
    escalation: {
      subject: `Second reminder: no update in ${opts.daysIdle} days`,
      body:
        p(`The manuscript ${t} has now had no status update for <strong>${opts.daysIdle} days</strong> and remains at ${s}. The coordinator has been copied on this reminder.`) +
        p('If anything is preventing progress, kindly let us know as soon as possible.'),
    },
    final: {
      subject: 'Final notice: reassignment pending',
      body:
        p(`The manuscript ${t} has had no status update for <strong>${opts.daysIdle} days</strong> and has been flagged for reassignment.`) +
        p('If you are still working on it, kindly update its status today and reply to this email. Otherwise, it may be reassigned to another member.'),
    },
  }[opts.stage];

  const inner = p('Dear colleagues,') + copy.body + button(opts.link, 'Open the manuscript');
  return sendEmail({
    to: opts.to,
    subject: `${copy.subject}: ${opts.projectTitle}`,
    html: shell(inner, FOOTER),
  });
}

const unhtml = (h: string) =>
  h
    .replace(/<\/p>\s*/g, '\n\n')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .trim();

/** Plain-text version of the formal wording for the paper's current status,
 *  for the compose page's "Status update" template. */
export function stageUpdateText(opts: {
  phase: string;
  stage: string;
  stageLabel: string;
  projectTitle: string;
  venue?: string | null;
  sender: string;
}): { subject: string; body: string } {
  const c = stageCopy(opts.phase, opts.stage, `"${esc(opts.projectTitle)}"`, opts.venue ? esc(opts.venue) : null, opts.stageLabel);
  return {
    subject: `${c.subject}: ${opts.projectTitle}`,
    body: `Dear colleagues,\n\n${unhtml(c.body)}\n\nKind regards,\n${opts.sender}`,
  };
}

/** Wrap a typed, plain-text email body in the same design as the automatic
 *  emails. Blank lines split paragraphs; links become clickable. */
export function renderComposedEmail(bodyText: string): string {
  const linkify = (h: string) =>
    h.replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)]/g, (u) => `<a href="${u}" style="color:${RED}">${u}</a>`);
  const paras = bodyText
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => p(linkify(esc(para)).replace(/\n/g, '<br>')));
  return shell(paras.join(''), FOOTER, false);
}
