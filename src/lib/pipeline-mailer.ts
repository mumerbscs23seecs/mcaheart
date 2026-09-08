import { sendEmail } from './email';

const FROM = import.meta.env.NOTIFY_FROM ?? 'MCA Heart <onboarding@resend.dev>';

const esc = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function shell(title: string, body: string) {
  return `<div style="background:#f4f6f8;padding:28px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #d9e2ec;border-radius:6px;padding:28px">
    <p style="margin:0 0 4px;color:#0b3c5d;font:700 11px/1 Arial,sans-serif;text-transform:uppercase;letter-spacing:.18em">MCA Research Pipeline</p>
    <h1 style="margin:0 0 14px;color:#1e293b;font:600 19px/1.3 Georgia,serif">${esc(title)}</h1>
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

/** SPEC.md §7 transition templates. `to` is already resolved to real addresses. */
export async function deliverTransition(opts: {
  to: string[];
  template:
    | 'conference_assigned'
    | 'abstract_accepted'
    | 'proceeding_full_text'
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
      lead: `This project is moving to the manuscript phase. It now appears under <strong>Ongoing</strong>.`,
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
    <p style="margin:16px 0 0"><a href="${opts.link}" style="color:#0b3c5d;font:600 13px/1 Arial,sans-serif">View project details →</a></p>
    <p style="margin:14px 0 0;color:#94a3b8;font:12px/1.5 Arial,sans-serif">
      Reply here rather than on WhatsApp so it stays on the record.
    </p>`;
  return sendEmail({ to: opts.to, from: FROM, subject: t.subject, html: shell(t.subject.replace('[MCA Pipeline] ', ''), body) });
}
