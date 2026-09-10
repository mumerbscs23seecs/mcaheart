import { sendEmail } from './email';

const FROM = import.meta.env.NOTIFY_FROM ?? 'MCA Heart <onboarding@resend.dev>';

const esc = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function shell(title: string, body: string) {
  return `<div style="background:#f4f2ee;padding:28px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid rgba(0,0,0,.1);border-radius:6px;padding:28px">
    <p style="margin:0 0 4px;color:#a51c30;font:700 11px/1 Arial,sans-serif;text-transform:uppercase;letter-spacing:.18em">MCA Research Pipeline</p>
    <h1 style="margin:0 0 14px;color:#1a1a1a;font:600 19px/1.3 Georgia,serif">${esc(title)}</h1>
    ${body}
  </div>
</div>`;
}

export async function deliverMagicLink(to: string, link: string) {
  const body = `
    <p style="margin:0 0 14px;color:#1e293b;font:14px/1.6 Arial,sans-serif">
      Click below to sign in to the research pipeline. The link is single-use and expires in about an hour.
    </p>
    <p style="margin:0 0 18px">
      <a href="${link}" style="display:inline-block;padding:11px 22px;background:#0b3c5d;color:#fff;
         font:600 14px/1 Arial,sans-serif;text-decoration:none;border-radius:4px">Sign in</a>
    </p>
    <p style="margin:0;color:#64748b;font:12px/1.6 Arial,sans-serif">
      If you didn't request this, ignore it. If the button doesn't work, paste this into your browser:<br>
      <a href="${link}" style="color:#0b3c5d">${link}</a>
    </p>`;
  return sendEmail({ to, from: FROM, subject: '[MCA Pipeline] Sign-in link', html: shell('Your sign-in link', body) });
}

const linkBtn = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;padding:10px 20px;background:#a51c30;color:#fff;font:600 13px/1 Arial,sans-serif;text-decoration:none;border-radius:4px">${label}</a>`;

/** SPEC.md §7 transition templates. `to` is already resolved to real addresses. */
export async function deliverTransition(opts: {
  to: string[];
  template:
    | 'conference_assigned'
    | 'abstract_accepted'
    | 'proceeding_full_text'
    | 'not_proceeding_full_text'
    | 'submitted_to_journal'
    | 'published';
  projectTitle: string;
  ref: string;
  venue?: string;
  actor: string;
  note?: string;
  link: string;
}) {
  if (!opts.to.length) return { ok: false, error: 'no recipients with a real email' };

  const lines: Record<typeof opts.template, { subject: string; lead: string }> = {
    conference_assigned: {
      subject: `[MCA Pipeline] ${opts.ref} sent to ${opts.venue}`,
      lead: `This project has been submitted to <strong>${esc(opts.venue ?? 'a conference')}</strong>. Start the abstract.`,
    },
    abstract_accepted: {
      subject: `[MCA Pipeline] Abstract accepted — ${opts.ref}`,
      lead: `The abstract for this project was <strong>accepted</strong> at ${esc(opts.venue ?? 'the conference')}.`,
    },
    proceeding_full_text: {
      subject: `[MCA Pipeline] ${opts.ref} proceeding to full text`,
      lead: `This project is moving to the manuscript phase. It now appears under <strong>Ongoing</strong> — attach your draft link and get started.`,
    },
    not_proceeding_full_text: {
      subject: `[MCA Pipeline] ${opts.ref} not proceeding to full text`,
      lead: `The coordinator has decided this project will <strong>not</strong> proceed to a full manuscript. It has been closed out.`,
    },
    submitted_to_journal: {
      subject: `[MCA Pipeline] ${opts.ref} submitted to ${opts.venue}`,
      lead: `The manuscript has been submitted to <strong>${esc(opts.venue ?? 'a journal')}</strong>. It now appears under <strong>Submissions</strong>.`,
    },
    published: {
      subject: `[MCA Pipeline] Published — ${opts.ref}`,
      lead: `This project has been <strong>published</strong>. 🎉`,
    },
  };
  const t = lines[opts.template];
  const noteBlock = opts.note
    ? `<p style="margin:14px 0 0;padding:11px 13px;background:#f1f5f9;border-radius:5px;color:#1e293b;font:14px/1.6 Arial,sans-serif;white-space:pre-wrap"><strong>Note:</strong> ${esc(opts.note)}</p>`
    : '';
  const body = `
    <p style="margin:0 0 6px;color:#1e293b;font:14px/1.6 Arial,sans-serif">${t.lead}</p>
    <p style="margin:0 0 4px;color:#64748b;font:13px/1.6 Arial,sans-serif"><em>${esc(opts.projectTitle)}</em></p>
    <p style="margin:0 0 16px;color:#94a3b8;font:12px/1.6 Arial,sans-serif">${esc(opts.ref)} · updated by ${esc(opts.actor)}</p>
    ${noteBlock}
    <p style="margin:16px 0 0"><a href="${opts.link}" style="color:#a51c30;font:600 13px/1 Arial,sans-serif">View project details →</a></p>
    <p style="margin:14px 0 0;color:#94a3b8;font:12px/1.5 Arial,sans-serif">
      Reply here rather than on WhatsApp so it stays on the record.
    </p>`;
  return sendEmail({ to: opts.to, from: FROM, subject: t.subject, html: shell(t.subject.replace('[MCA Pipeline] ', ''), body) });
}

/**
 * The manuscript-stagnation cascade — sent from the daily reminder sweep when
 * an Ongoing project has had no stage change:
 *   nudge      (7 days)  → member
 *   escalation (12 days) → member + coordinators
 *   final      (20 days) → member + coordinators; project flagged for reassignment
 */
export async function deliverPipelineReminder(opts: {
  to: string[];
  stage: 'nudge' | 'escalation' | 'final';
  projectTitle: string;
  ref: string;
  daysIdle: number;
  currentStage: string;
  link: string;
}) {
  if (!opts.to.length) return { ok: false, error: 'no recipients' };

  const copy = {
    nudge: {
      subject: `[MCA Pipeline] ${opts.ref} — no update in ${opts.daysIdle} days`,
      lead: `This manuscript has had no status change in <strong>${opts.daysIdle} days</strong>. It's still at "<em>${esc(opts.currentStage)}</em>". Please move it forward and update the stage, or reply with where it stands.`,
    },
    escalation: {
      subject: `[MCA Pipeline] ${opts.ref} still stalled — ${opts.daysIdle} days`,
      lead: `Still no movement on this manuscript after <strong>${opts.daysIdle} days</strong> at "<em>${esc(opts.currentStage)}</em>". The coordinator has been copied on this reminder. If there's a blocker, say so now.`,
    },
    final: {
      subject: `[MCA Pipeline] ${opts.ref} — reassignment pending`,
      lead: `This manuscript has had no status change for <strong>${opts.daysIdle} days</strong>. It has been flagged for the coordinator to reassign — you may be taken off this topic and it handed to someone else. If you are still on it, update the stage today and reply to this email.`,
    },
  }[opts.stage];

  const body = `
    <p style="margin:0 0 6px;color:#1a1a1a;font:14px/1.6 Arial,sans-serif">${copy.lead}</p>
    <p style="margin:0 0 16px;color:#94a3b8;font:12px/1.6 Arial,sans-serif">${esc(opts.ref)} · <em>${esc(opts.projectTitle)}</em></p>
    <p style="margin:16px 0 0">${linkBtn(opts.link, 'Open the project')}</p>
    <p style="margin:14px 0 0;color:#94a3b8;font:12px/1.5 Arial,sans-serif">Reply here rather than on WhatsApp so it stays on the record.</p>`;

  return sendEmail({ to: opts.to, from: FROM, subject: copy.subject, html: shell(copy.subject.replace('[MCA Pipeline] ', ''), body) });
}
