/**
 * Help on papers (mca-pipeline/add-help-and-learning.sql):
 *   help_requests  a first author asks for helpers on one of their papers
 *   assignments    an admin appoints someone in a role, due in 7-10 days;
 *                  the helper marks their part done with an AI disclosure
 * Plus the emails that go with them.
 */
import { sendEmail } from './email';
import { esc, p, button, noteBlock, dataTable, emailShell, FOOTER_AUTO } from './email-layout';
import { SKILLS, type Skill } from './skills';

/** What each kind of help is called on the forms. */
export const HELP_LABEL: Record<Skill, string> = {
  'Manuscript writing': 'Manuscript writing',
  'Screening/Extraction for meta-analysis': 'Screening and extraction for a meta-analysis',
  Visuals: 'Tables, figures, visual or graphical abstract',
  'Analysis for TriNetX': 'TriNetX analysis',
  'Analysis for NIS/NRD': 'NIS / NRD analysis',
};

/** The order and starting numbers on the "Request help" form. */
export const HELP_DEFAULTS: { role: Skill; spots: number }[] = [
  { role: 'Manuscript writing', spots: 2 },
  { role: 'Screening/Extraction for meta-analysis', spots: 2 },
  { role: 'Visuals', spots: 1 },
  { role: 'Analysis for TriNetX', spots: 0 },
  { role: 'Analysis for NIS/NRD', spots: 0 },
];

export const roleLabel = (role: string | null | undefined) =>
  role ? (HELP_LABEL[role as Skill] ?? role) : 'General help';

export type AiUse = 'none' | 'light' | 'moderate' | 'heavy';
export const AI_USE_LABEL: Record<AiUse, string> = {
  none: 'No AI used',
  light: 'A little (under 25%)',
  moderate: 'Some (25 to 50%)',
  heavy: 'A lot (over 50%)',
};

export type Assignment = {
  id: string;
  project_id: string;
  person_id: string;
  role: string | null;
  request_id: string | null;
  assigned_at: string;
  due_on: string;
  done_at: string | null;
  ai_use: AiUse | null;
  ai_parts: string | null;
  ai_proofread: boolean | null;
  done_note: string | null;
};
export const ASSIGNMENT_COLS = 'id,project_id,person_id,role,request_id,assigned_at,due_on,done_at,ai_use,ai_parts,ai_proofread,done_note';

export type HelpRequest = {
  id: string;
  project_id: string;
  role: string;
  spots: number;
  note: string | null;
  requested_by: string | null;
  created_at: string;
  closed_at: string | null;
};
export const HELP_COLS = 'id,project_id,role,spots,note,requested_by,created_at,closed_at';

/** True when the SQL hasn't been run yet (missing table or function). */
export const notSetUp = (e: { code?: string; message?: string } | null | undefined) =>
  !!e && (e.code === 'PGRST202' || e.code === 'PGRST205' || e.code === '42P01' || /assignments|help_requests|appoint|schema cache/i.test(e.message ?? ''));

const DAY_FMT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
export const longDay = (d: string) => DAY_FMT.format(new Date(d.length === 10 ? `${d}T00:00:00Z` : d));

/** Days left until a due date (negative when late). */
export function daysLeft(due: string): number {
  const today = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  return Math.round((Date.parse(`${due.slice(0, 10)}T00:00:00Z`) - today) / 86400000);
}

export { SKILLS };

/* ------------------------------------------------------------------ emails */

const shell = (inner: string) => emailShell(inner + p('Kind regards,<br>MCA Heart Research Lab', 'margin-bottom:0'), FOOTER_AUTO);

/** To the person appointed: you have been selected, finish in 7-10 days. */
export async function deliverAppointed(opts: {
  to: string; name: string; projectTitle: string; role: string | null; due: string; lead: string | null; link: string;
}) {
  const t = `"${esc(opts.projectTitle)}"`;
  const inner =
    p(`Dear ${esc(opts.name)},`) +
    p(`We are pleased to let you know that you have been selected to help with the paper ${t}.`) +
    dataTable([
      ['Your role', roleLabel(opts.role)],
      ['First author', opts.lead ?? 'To be confirmed'],
      ['Complete by', longDay(opts.due)],
    ]) +
    p('Please complete your part within <strong>7 to 10 days</strong>. Contact the first author to get started, and keep them updated as you work. If you cannot finish on time, let the first author and the coordinator know as soon as possible.') +
    p('When your part is done, open the paper in the workflow and choose <strong>Mark my part done</strong>. You will be asked whether AI tools were used, for which parts, and whether that work was proofread.') +
    p('Please note that members who do not complete their tasks on time may not be appointed to new tasks.') +
    button(opts.link, 'Open the paper');
  return sendEmail({ to: opts.to, subject: `You have been selected to help with a paper`, html: shell(inner) });
}

/** To the paper's first author: someone was added, this is their role. */
export async function deliverHelperAdded(opts: {
  to: string[]; leadName: string; helper: string; helperEmail: string; projectTitle: string; role: string | null; due: string; link: string;
}) {
  if (!opts.to.length) return { ok: false, error: 'no recipients' };
  const t = `"${esc(opts.projectTitle)}"`;
  const inner =
    p(`Dear ${esc(opts.leadName)},`) +
    p(`<strong>${esc(opts.helper)}</strong> has been added to your paper ${t}.`) +
    dataTable([
      ['Name', opts.helper],
      ['Email', opts.helperEmail],
      ['Role', roleLabel(opts.role)],
      ['Will complete by', longDay(opts.due)],
    ]) +
    p('They have been asked to complete their part within 7 to 10 days. Please get in touch with them to share the files and explain what is needed. When they finish, you can add a review of their work from the paper\'s page.') +
    button(opts.link, 'Open the paper');
  return sendEmail({ to: opts.to, subject: `${opts.helper} has joined your paper as ${roleLabel(opts.role)}`, html: shell(inner) });
}

/** To the coordinators: a first author asked for help. */
export async function deliverHelpRequested(opts: {
  to: string[]; requester: string; projectTitle: string; ref: string; lines: string[]; note?: string | null; link: string;
}) {
  if (!opts.to.length) return { ok: false, error: 'no recipients' };
  const t = `"${esc(opts.projectTitle)}"`;
  const inner =
    p('Dear coordinator,') +
    p(`<strong>${esc(opts.requester)}</strong> has asked for help on ${t} (${esc(opts.ref)}).`) +
    dataTable(opts.lines.map((l) => {
      const [k, v] = l.split('\t');
      return [k, v] as [string, string];
    })) +
    noteBlock(opts.note, `Note from ${esc(opts.requester)}`) +
    button(opts.link, 'Appoint people');
  return sendEmail({ to: opts.to, subject: `Help requested: ${opts.ref}`, html: shell(inner) });
}
