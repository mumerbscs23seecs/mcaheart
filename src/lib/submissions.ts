/**
 * DEMO submissions store - in-memory only, no database.
 *
 * Mirrors src/lib/auth.ts: this exists so the admin dashboard has something to
 * render and can be handed to an engineer as a shape reference. Real build
 * swaps this for a database table; keep the exported types and function
 * signatures as the contract.
 */
import { audit } from './auth';

/** The lifecycle a project moves through. One record, status changes - it does
 *  not "move" between tables. */
export const STATUSES = [
  'Idea',
  'Abstract - drafting',
  'Abstract - submitted',
  'Abstract - accepted',
  'Abstract - rejected',
  'Manuscript - drafting',
  'Manuscript - submitted',
  'Under review',
  'Revisions requested',
  'Accepted / in press',
  'Published',
  'Withdrawn',
] as const;

export type Status = (typeof STATUSES)[number];

/** Statuses that count as "closed" - no further activity expected. */
const TERMINAL: Status[] = ['Abstract - rejected', 'Published', 'Withdrawn'];

export interface Activity {
  at: number;
  who: string;
  note: string;
}

export interface Submission {
  id: string;
  title: string;
  lead: string;
  leadEmail: string;
  target: string; // conference or journal
  status: Status;
  /** Internal coordinator sign-off - distinct from the journal's peer review. */
  reviewed: boolean;
  createdAt: number;
  updatedAt: number;
  /** When the reminder sweep last included this record. Stops daily re-nagging. */
  lastRemindedAt: number | null;
  activity: Activity[];
}

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();

const submissions = new Map<string, Submission>();

function make(s: Omit<Submission, 'updatedAt' | 'lastRemindedAt'>): Submission {
  const updatedAt = s.activity.length ? s.activity[0]!.at : s.createdAt;
  return { ...s, updatedAt, lastRemindedAt: null };
}

function seed() {
  if (submissions.size) return;
  const rows: Omit<Submission, 'updatedAt' | 'lastRemindedAt'>[] = [
    {
      id: 's_01',
      title: 'TAVR outcomes in bicuspid vs tricuspid aortic stenosis: a meta-analysis',
      lead: 'Varun Victor',
      leadEmail: 'varun.victor@example.com',
      target: 'ACC 2026',
      status: 'Abstract - submitted',
      reviewed: true,
      createdAt: now - 40 * DAY,
      activity: [
        { at: now - 2 * DAY, who: 'Varun Victor', note: 'Abstract submitted to ACC portal.' },
        { at: now - 9 * DAY, who: 'Jawad (Coordinator)', note: 'Coordinator review complete - approved to submit.' },
        { at: now - 20 * DAY, who: 'Varun Victor', note: 'First full draft uploaded to OneDrive.' },
      ],
    },
    {
      id: 's_02',
      title: 'Cardiogenic shock and early Impella use: national trends 2016–2024',
      lead: 'Heena Kaushal Asnani',
      leadEmail: 'heena.asnani@example.com',
      target: 'JACC: Cardiovascular Interventions',
      status: 'Under review',
      reviewed: true,
      createdAt: now - 120 * DAY,
      activity: [
        { at: now - 6 * DAY, who: 'Heena Kaushal Asnani', note: 'Journal moved status to "under review".' },
        { at: now - 30 * DAY, who: 'Heena Kaushal Asnani', note: 'Manuscript submitted.' },
      ],
    },
    {
      id: 's_03',
      title: 'Checkpoint-inhibitor myocarditis: a single-centre case series',
      lead: 'Ankit Hanmandlu',
      leadEmail: 'ankit.hanmandlu@example.com',
      target: 'SCAI 2026',
      status: 'Manuscript - drafting',
      reviewed: false,
      createdAt: now - 25 * DAY,
      activity: [
        { at: now - 11 * DAY, who: 'Ankit Hanmandlu', note: 'Abstract accepted - full manuscript started.' },
        { at: now - 24 * DAY, who: 'Ankit Hanmandlu', note: 'Idea logged and data pull requested.' },
      ],
    },
    {
      id: 's_04',
      title: 'Racial disparities in door-to-balloon time: a retrospective cohort',
      lead: 'Amir Behzad Bagheri',
      leadEmail: 'amir.bagheri@example.com',
      target: 'AHA 2026',
      status: 'Abstract - drafting',
      reviewed: false,
      createdAt: now - 18 * DAY,
      activity: [
        { at: now - 16 * DAY, who: 'Amir Behzad Bagheri', note: 'Outline drafted.' },
      ],
    },
    {
      id: 's_05',
      title: 'Atrial fibrillation ablation outcomes in octogenarians',
      lead: 'Salman Abdul Basit',
      leadEmail: 'salman.basit@example.com',
      target: 'TCT 2026',
      status: 'Idea',
      reviewed: false,
      createdAt: now - 5 * DAY,
      activity: [
        { at: now - 5 * DAY, who: 'Salman Abdul Basit', note: 'Idea submitted for review.' },
      ],
    },
    {
      id: 's_06',
      title: 'Mitral TEER in secondary MR: 2-year echocardiographic follow-up',
      lead: 'Varun Victor',
      leadEmail: 'varun.victor@example.com',
      target: 'Circulation: Cardiovascular Imaging',
      status: 'Published',
      reviewed: true,
      createdAt: now - 300 * DAY,
      activity: [
        { at: now - 45 * DAY, who: 'Varun Victor', note: 'Published online.' },
        { at: now - 90 * DAY, who: 'Varun Victor', note: 'Accepted after minor revisions.' },
      ],
    },
    {
      id: 's_07',
      title: 'Pulmonary embolism response teams: effect on 30-day mortality',
      lead: 'Mowaffak Alraiyes',
      leadEmail: 'mowaffak.alraiyes@example.com',
      target: 'NCVH 2026',
      status: 'Manuscript - submitted',
      reviewed: false,
      createdAt: now - 60 * DAY,
      activity: [
        { at: now - 15 * DAY, who: 'Mowaffak Alraiyes', note: 'Manuscript submitted - awaiting coordinator review.' },
      ],
    },
  ];
  for (const r of rows) submissions.set(r.id, make(r));
}
seed();

/* -------------------------------------------------------------------------- */

let seq = 100;

/** Create a pipeline record - used when an idea submission is accepted. */
export function addSubmission(input: {
  title: string;
  lead: string;
  leadEmail: string;
  target: string;
  actor: string;
  note?: string;
}): Submission {
  const id = `s_${++seq}`;
  const at = Date.now();
  const sub = make({
    id,
    title: input.title,
    lead: input.lead,
    leadEmail: input.leadEmail,
    target: input.target,
    status: 'Idea',
    reviewed: false,
    createdAt: at,
    activity: [{ at, who: input.actor, note: input.note ?? 'Created from an accepted idea submission.' }],
  });
  submissions.set(id, sub);
  audit(input.actor, 'created submission from idea', input.title);
  return sub;
}

export function listSubmissions(): Submission[] {
  return [...submissions.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getSubmission(id: string): Submission | undefined {
  return submissions.get(id);
}

export interface DashboardStats {
  total: number;
  active: number;
  awaitingReview: number;
  stagnant: number;
  published: number;
  byStatus: { status: Status; n: number }[];
}

/** @param stagnantDays activity older than this on a non-terminal record. */
export function getStats(stagnantDays = 7): DashboardStats {
  const all = [...submissions.values()];
  const isTerminal = (s: Submission) => TERMINAL.includes(s.status);
  const cutoff = Date.now() - stagnantDays * DAY;

  const byStatus = STATUSES.map((status) => ({
    status,
    n: all.filter((s) => s.status === status).length,
  })).filter((r) => r.n > 0);

  return {
    total: all.length,
    active: all.filter((s) => !isTerminal(s)).length,
    awaitingReview: all.filter((s) => !s.reviewed && !isTerminal(s)).length,
    stagnant: all.filter((s) => !isTerminal(s) && s.updatedAt < cutoff).length,
    published: all.filter((s) => s.status === 'Published').length,
    byStatus,
  };
}

export function setReviewed(id: string, reviewed: boolean, actor: string): boolean {
  const s = submissions.get(id);
  if (!s) return false;
  s.reviewed = reviewed;
  const note = reviewed ? 'Coordinator review marked complete.' : 'Coordinator review re-opened.';
  s.activity.unshift({ at: Date.now(), who: actor, note });
  s.updatedAt = Date.now();
  audit(actor, reviewed ? 'marked submission reviewed' : 'reopened submission review', s.title);
  return true;
}

export function isStagnant(s: Submission, stagnantDays = 7): boolean {
  return !TERMINAL.includes(s.status) && s.updatedAt < Date.now() - stagnantDays * DAY;
}

export function isTerminalStatus(status: Status): boolean {
  return TERMINAL.includes(status);
}

/* -------------------------------------------------------------------------- */
/* Reminder sweep support                                                      */
/* -------------------------------------------------------------------------- */

export interface ReminderOpts {
  /** No activity in this many days flags a record. */
  stagnantDays?: number;
  /** Don't re-flag a record reminded within this many days. */
  cooldownDays?: number;
}

/** Records that are stagnant AND haven't been in a reminder recently. */
export function submissionsDueForReminder(opts: ReminderOpts = {}): Submission[] {
  const stagnantDays = opts.stagnantDays ?? 7;
  const cooldownDays = opts.cooldownDays ?? 7;
  const cooldownCutoff = Date.now() - cooldownDays * DAY;
  return [...submissions.values()].filter(
    (s) =>
      isStagnant(s, stagnantDays) &&
      (s.lastRemindedAt === null || s.lastRemindedAt < cooldownCutoff),
  );
}

/** Stamp records as reminded so the next sweep skips them for the cooldown. */
export function markReminded(ids: string[], at = Date.now()): void {
  for (const id of ids) {
    const s = submissions.get(id);
    if (s) s.lastRemindedAt = at;
  }
}
