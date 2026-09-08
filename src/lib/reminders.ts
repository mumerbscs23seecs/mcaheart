/**
 * The reminder sweep.
 *
 * Runs on a schedule (see scripts/reminders.mjs and the wiring notes there).
 * One pass:
 *   1. find non-terminal submissions with no activity in N days that have not
 *      been reminded within the cooldown window
 *   2. build ONE digest email (not one email per item — that is what makes
 *      people mute it)
 *   3. send it to the coordinators
 *   4. stamp lastRemindedAt on every included record so tomorrow's run skips them
 *   5. write an audit entry
 *
 * In-memory demo caveat: a `node scripts/reminders.mjs` process has its own
 * fresh store, so run the sweep from the admin panel to see it act on live
 * data. With a real database both entry points hit the same rows.
 */
import {
  submissionsDueForReminder,
  markReminded,
  isStagnant,
  type Submission,
  type ReminderOpts,
} from './submissions';
import { audit } from './auth';
import { sendEmail } from './email';

/** Comma-separated list in COORDINATOR_EMAILS, else a sensible default. */
function coordinators(): string[] {
  const raw = import.meta.env.COORDINATOR_EMAILS ?? 'admin@mcaheart.com, member@mcaheart.com';
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function daysSince(t: number): number {
  return Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000));
}

function digestHtml(items: Submission[]): string {
  const rows = items
    .map(
      (s) => `
      <tr>
        <td style="padding:8px 12px 8px 0;font:14px/1.5 Arial,sans-serif;color:#1e293b">
          ${s.title}<br>
          <span style="color:#64748b;font-size:12px">${s.lead} &middot; ${s.target} &middot; ${s.status}</span>
        </td>
        <td style="padding:8px 0;font:600 13px/1.5 Arial,sans-serif;color:#9e1b1e;white-space:nowrap;vertical-align:top">
          ${daysSince(s.updatedAt)} days idle
        </td>
      </tr>`,
    )
    .join('');

  return `<div style="background:#f8fafc;padding:28px">
  <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid rgba(43,57,144,.12);border-radius:12px;padding:28px">
    <p style="margin:0 0 4px;color:#2b3990;font:700 11px/1 Arial,sans-serif;text-transform:uppercase;letter-spacing:.22em">MCA Heart · Pipeline</p>
    <h1 style="margin:0 0 6px;color:#1e293b;font:600 20px/1.3 Georgia,serif">${items.length} submission${items.length === 1 ? '' : 's'} need a nudge</h1>
    <p style="margin:0 0 18px;color:#64748b;font:14px/1.6 Arial,sans-serif">
      No recorded activity in over a week and still open. Review in the
      <a href="https://www.mcaheart.com/admin" style="color:#2b3990">admin dashboard</a>.
    </p>
    <table style="border-collapse:collapse;width:100%">${rows}</table>
    <hr style="border:0;border-top:1px solid rgba(43,57,144,.12);margin:20px 0">
    <p style="margin:0;color:#94a3b8;font:12px/1.6 Arial,sans-serif">
      Weekly digest. You will not get another reminder for these items for 7 days.
    </p>
  </div>
</div>`;
}

export interface SweepResult {
  ranAt: number;
  dryRun: boolean;
  dueCount: number;
  items: { id: string; title: string; lead: string; daysIdle: number }[];
  recipients: string[];
  emailStatus: string;
}

export async function runReminderSweep(
  opts: ReminderOpts & { dryRun?: boolean; actor?: string } = {},
): Promise<SweepResult> {
  const dryRun = opts.dryRun ?? false;
  const actor = opts.actor ?? 'reminder-sweep';
  const due = submissionsDueForReminder(opts);
  const to = coordinators();

  const items = due.map((s) => ({
    id: s.id,
    title: s.title,
    lead: s.lead,
    daysIdle: daysSince(s.updatedAt),
  }));

  if (due.length === 0) {
    audit(actor, 'reminder sweep ran', undefined, 'nothing due');
    return { ranAt: Date.now(), dryRun, dueCount: 0, items, recipients: to, emailStatus: 'skipped — nothing due' };
  }

  if (dryRun) {
    return { ranAt: Date.now(), dryRun, dueCount: due.length, items, recipients: to, emailStatus: 'dry run — not sent' };
  }

  const sent = await sendEmail({
    to,
    subject: `[MCA Heart] ${due.length} submission${due.length === 1 ? '' : 's'} idle 7+ days`,
    html: digestHtml(due),
  });

  if (sent.ok) {
    markReminded(due.map((s) => s.id));
    audit(actor, 'reminder digest sent', undefined, `${due.length} items → ${to.join(', ')}`);
  } else {
    audit(actor, 'reminder digest FAILED', undefined, sent.error ?? 'unknown error');
  }

  return {
    ranAt: Date.now(),
    dryRun,
    dueCount: due.length,
    items,
    recipients: to,
    emailStatus: sent.ok ? `sent (${sent.id})` : `failed: ${sent.error}`,
  };
}

export { isStagnant };
