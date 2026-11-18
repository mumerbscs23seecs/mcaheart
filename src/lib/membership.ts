/**
 * Collaborator memberships (add-membership.sql): six-month terms, inactivity
 * notices and term reviews. The database decides what step is allowed next;
 * this file holds the labels and the email wording.
 */

export type NoticeStep = 'warning_1' | 'warning_2' | 'explanation' | 'removal';
export type EmailStep = NoticeStep | 'renewal' | 'departure';
export type LogKind = EmailStep | 'note' | 'restore';

export type MemberRow = {
  person_id: string;
  full_name: string;
  email: string;
  membership_status: 'active' | 'removed' | 'completed';
  member_since: string | null;
  term_number: number;
  term_started_on: string | null;
  term_ends_on: string | null;
  review_due_on: string | null;
  review_due: boolean;
  last_active_at: string | null;
  last_active_label: string | null;
  days_inactive: number | null;
  notice_stage: NoticeStep | null;
  notice_sent_at: string | null;
  next_step: NoticeStep | null;
  ended_on: string | null;
};

export type LogRow = {
  id: string;
  person_id: string;
  kind: LogKind;
  at: string;
  by_id: string | null;
  term_number: number | null;
  emailed: boolean;
  subject: string | null;
  body: string | null;
};

/** What the button says. */
export const STEP_ACTION: Record<EmailStep, string> = {
  warning_1: 'Send first warning',
  warning_2: 'Send second warning',
  explanation: 'Ask for an explanation',
  removal: 'Remove from the lab',
  renewal: 'Renew for 6 months',
  departure: 'End membership',
};

/** How a step reads in the history. */
export const LOG_LABEL: Record<LogKind, string> = {
  warning_1: 'First warning sent',
  warning_2: 'Second warning sent',
  explanation: 'Explanation requested',
  removal: 'Removed from the lab',
  renewal: 'Renewed for 6 months',
  departure: 'Membership ended',
  note: 'Marked active',
  restore: 'Membership restored',
};

export const STATUS_LABEL: Record<MemberRow['membership_status'], string> = {
  active: 'Active',
  removed: 'Removed',
  completed: 'Finished',
};

/** "Step 2 of 4" style progress through the inactivity notices. */
export const NOTICE_ORDER: NoticeStep[] = ['warning_1', 'warning_2', 'explanation', 'removal'];

/** Membership is switched on once add-membership.sql has been run. */
export async function loadMemberships(supabase: any): Promise<{ ready: boolean; rows: MemberRow[]; error?: string }> {
  if (!supabase) return { ready: false, rows: [] };
  const { data, error } = await supabase.rpc('membership_overview');
  if (error) return { ready: false, rows: [], error: error.message };
  return { ready: true, rows: (data ?? []) as MemberRow[] };
}

const DATE_FMT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const SHORT_FMT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** "15 November 2026" from a date or timestamp string. */
export function longDate(v: string | null | undefined): string {
  if (!v) return '-';
  const d = new Date(v.length === 10 ? `${v}T00:00:00Z` : v);
  return Number.isNaN(d.getTime()) ? '-' : DATE_FMT.format(d);
}
export function shortDate(v: string | null | undefined): string {
  if (!v) return '-';
  const d = new Date(v.length === 10 ? `${v}T00:00:00Z` : v);
  return Number.isNaN(d.getTime()) ? '-' : SHORT_FMT.format(d);
}

/** Whole days from a date (YYYY-MM-DD) to today, counting the first day as day 1. */
export function dayNumber(since: string | null | undefined): number | null {
  if (!since) return null;
  const start = Date.parse(`${since.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(start)) return null;
  const today = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  return Math.max(1, Math.floor((today - start) / 86400000) + 1);
}

/** The date six months after a date, as YYYY-MM-DD (same rule as Postgres). */
export function addSixMonths(date: string): string {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + 6, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

/** Where a renewed term would start: straight after the old one, or today if the review is very late. */
export function nextTermStart(m: MemberRow): string {
  const today = new Date().toISOString().slice(0, 10);
  if (!m.term_ends_on) return today;
  const lateBy = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${m.term_ends_on}T00:00:00Z`)) / 86400000;
  return lateBy <= 30 ? m.term_ends_on : today;
}

type Fill = { name: string; joined: string; lastActive: string; lastNotice: string; termStart: string; termEnd: string };

export function fillFor(m: MemberRow, log: LogRow[]): Fill {
  const lastNotice = log.find((l) => NOTICE_ORDER.includes(l.kind as NoticeStep));
  const start = nextTermStart(m);
  return {
    name: m.full_name,
    joined: longDate(m.member_since),
    lastActive: longDate(m.last_active_at),
    lastNotice: longDate(lastNotice?.at ?? m.notice_sent_at),
    termStart: longDate(start),
    termEnd: longDate(addSixMonths(start)),
  };
}

const fill = (text: string, f: Fill) =>
  text.replace(/\{(\w+)\}/g, (all, k: keyof Fill) => (k in f ? f[k] : all));

/** The emails, formal in tone. The signature ("Sincerely, Operations Team...") is added when sending. */
const TEMPLATES: Record<EmailStep, { subject: string; body: string }> = {
  warning_1: {
    subject: 'First notice regarding your participation at MCA Heart Research Lab',
    body: `Dear {name},

We are writing regarding your participation as a Research Collaborator at MCA Heart Research Lab. Our records show no activity from you since {lastActive}, a period of more than three months.

As set out in your appointment letter, continued affiliation with the lab requires active participation and meaningful contributions, such as:
- Completing assigned project tasks on time
- Responding to open calls for manuscript contributors
- Proposing research ideas that receive approval
- Contributing to conference submissions or presentations

Please treat this email as a first formal warning. We would welcome your renewed involvement, and a Research Fellow will be glad to help you find a suitable project. If there is a reason for your absence, please reply to this email and let us know.`,
  },
  warning_2: {
    subject: 'Second notice regarding your participation at MCA Heart Research Lab',
    body: `Dear {name},

We wrote to you on {lastNotice} regarding your participation in the lab. Since then, we have not recorded any activity from you. Your last recorded activity was on {lastActive}.

This is your second and final warning. Under the lab's participation policy, members who remain inactive for three consecutive months without prior approval or a reasonable explanation are removed from the active research team following two warnings.

If you wish to continue as a member, please resume your involvement or reply to this email at your earliest convenience.`,
  },
  explanation: {
    subject: 'Request for an explanation regarding your membership at MCA Heart Research Lab',
    body: `Dear {name},

Following our two previous notices, we have still not recorded any activity from you since {lastActive}.

Before a final decision is made regarding your membership, we would like to give you the opportunity to explain. Please reply to this email within seven days, letting us know the reason for your inactivity and whether you intend to continue with the lab.

If we do not hear from you within this period, your membership will be brought to an end and you will be removed from the active research team.`,
  },
  removal: {
    subject: 'Conclusion of your membership at MCA Heart Research Lab',
    body: `Dear {name},

We have written to you on several occasions regarding your inactivity in the lab, most recently on {lastNotice}, and have not received a response or seen renewed involvement.

In line with the lab's participation policy, we regret to inform you that you have been removed from the active research team of MCA Heart Research Lab, effective today. You will also be removed from the lab's WhatsApp group.

We thank you for the time you have spent with the lab and wish you every success in the future.`,
  },
  renewal: {
    subject: 'Renewal of your appointment at MCA Heart Research Lab',
    body: `Dear {name},

Following a review of your contributions during your appointment, we are pleased to renew your position as a Research Collaborator at MCA Heart Research Lab for a further six months, from {termStart} to {termEnd}.

Thank you for your commitment and for the work you have contributed to the lab. We look forward to continuing to work with you.

As before, continued affiliation depends on active participation, and your contributions will be reviewed again at the end of this period.`,
  },
  departure: {
    subject: 'Completion of your appointment at MCA Heart Research Lab',
    body: `Dear {name},

Your appointment as a Research Collaborator at MCA Heart Research Lab, which began on {joined}, has now come to an end. Following a review of your contributions, your time with the lab is now complete, and your appointment will not be extended for a further term.

On behalf of Dr. Chadi Alraies and the team, thank you for the time and effort you have given to the lab during your appointment.

You will be removed from the lab's WhatsApp group and from the list of active collaborators. Please note that requests for a letter of recommendation are considered only for members who are actively participating in the lab at the time of the request.

We wish you every success in your future career.`,
  },
};

export function emailFor(step: EmailStep, m: MemberRow, log: LogRow[]): { subject: string; body: string } {
  const f = fillFor(m, log);
  return { subject: fill(TEMPLATES[step].subject, f), body: fill(TEMPLATES[step].body, f) };
}
