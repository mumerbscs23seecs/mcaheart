/**
 * The reminder sweep.
 *
 * Runs on a schedule (see scripts/reminders.mjs and the wiring notes there).
 * One pass:
 *   1. find non-terminal submissions with no activity in N days that have not
 *      been reminded within the cooldown window
 *   2. build ONE digest email (not one email per item - that is what makes
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
import { esc, p, heading, link, emailShell } from './email-layout';

/** Comma-separated list in COORDINATOR_EMAILS, else a sensible default. */
function coordinators(): string[] {
  const raw = import.meta.env.COORDINATOR_EMAILS ?? 'researchlab@mcaheart.com';
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function daysSince(t: number): number {
  return Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000));
}

function digestHtml(items: Submission[]): string {
  const rows = items
    .map(
      (s) => `<tr>
        <td style="padding:10px 12px 10px 0;border-bottom:1px solid #eeeeee;font-size:15px;line-height:1.5;color:#333333">
          ${esc(s.title)}<br>
          <span style="color:#777777;font-size:13px">${esc(s.lead)} &middot; ${esc(s.target)} &middot; ${esc(s.status)}</span>
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #eeeeee;font-size:14px;font-weight:600;color:#7a1322;white-space:nowrap;vertical-align:top">
          ${daysSince(s.updatedAt)} days idle
        </td>
      </tr>`,
    )
    .join('');

  const inner =
    heading(`${items.length} submission${items.length === 1 ? '' : 's'} need${items.length === 1 ? 's' : ''} a nudge`) +
    p(`These have had no recorded activity in over a week and are still open. Please review them in the ${link('https://www.mcaheart.com/admin', 'admin dashboard')}.`) +
    `<table role="presentation" style="border-collapse:collapse;width:100%;margin:0 0 4px;font-family:'Open Sans','Segoe UI',Helvetica,Arial,sans-serif">${rows}</table>`;

  return emailShell(inner, 'Weekly digest. You will not get another reminder for these items for 7 days.');
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
    return { ranAt: Date.now(), dryRun, dueCount: 0, items, recipients: to, emailStatus: 'skipped - nothing due' };
  }

  if (dryRun) {
    return { ranAt: Date.now(), dryRun, dueCount: due.length, items, recipients: to, emailStatus: 'dry run - not sent' };
  }

  const sent = await sendEmail({
    to,
    subject: `${due.length} submission${due.length === 1 ? '' : 's'} idle for 7+ days`,
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
