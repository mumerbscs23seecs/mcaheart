/**
 * Store for lab recruitment applications - Supabase-backed (service role,
 * mca-pipeline/add-forms-storage.sql), so submissions survive a server
 * restart. Previously an in-memory Map; the public shape (ApplicationRecord)
 * is unchanged so admin/applications.astro didn't need to change at all.
 */
import { supabaseAdmin } from './supabase';
import { audit } from './auth';
import type { RecruitmentPayload } from './recruitment-schema';

export type ApplicationStatus = 'pending' | 'approved' | 'withheld' | 'declined';

export interface StoredFile {
  filename: string;
  mime: string;
  size: number;
  bytes: Buffer;
}

export interface ApplicationRecord extends RecruitmentPayload {
  id: string;
  submittedAt: number;
  status: ApplicationStatus;
  cv: StoredFile | null;
  headshot: StoredFile | null;
  reviewedAt: number | null;
  reviewedBy: string | null;
  decisionNote: string | null;
}

const hexToBuffer = (hex: string) => Buffer.from(hex.slice(2), 'hex');
const toHexLiteral = (b: Buffer) => '\\x' + b.toString('hex');

/** `withBytes` false omits the (large) file bytes - used for the list view, which only ever shows filename/size. */
function fromRow(row: any, withBytes: boolean): ApplicationRecord {
  return {
    ...(row.payload as RecruitmentPayload),
    id: row.id,
    submittedAt: new Date(row.submitted_at).getTime(),
    status: row.status,
    cv: row.cv_filename
      ? { filename: row.cv_filename, mime: row.cv_mime, size: row.cv_size, bytes: withBytes ? hexToBuffer(row.cv_bytes) : Buffer.alloc(0) }
      : null,
    headshot: row.headshot_filename
      ? { filename: row.headshot_filename, mime: row.headshot_mime, size: row.headshot_size, bytes: withBytes ? hexToBuffer(row.headshot_bytes) : Buffer.alloc(0) }
      : null,
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).getTime() : null,
    reviewedBy: row.reviewed_by,
    decisionNote: row.decision_note,
  };
}

const LIST_COLUMNS =
  'id,payload,status,submitted_at,reviewed_at,reviewed_by,decision_note,cv_filename,cv_mime,cv_size,headshot_filename,headshot_mime,headshot_size';

/* -------------------------------------------------------------------------- */

export async function addApplication(
  data: RecruitmentPayload,
  files: { cv: StoredFile | null; headshot: StoredFile | null },
): Promise<ApplicationRecord> {
  const { data: row, error } = await supabaseAdmin()
    .from('applications')
    .insert({
      payload: data,
      status: 'pending',
      cv_bytes: files.cv ? toHexLiteral(files.cv.bytes) : null,
      cv_mime: files.cv?.mime ?? null,
      cv_filename: files.cv?.filename ?? null,
      cv_size: files.cv?.size ?? null,
      headshot_bytes: files.headshot ? toHexLiteral(files.headshot.bytes) : null,
      headshot_mime: files.headshot?.mime ?? null,
      headshot_filename: files.headshot?.filename ?? null,
      headshot_size: files.headshot?.size ?? null,
    })
    .select(LIST_COLUMNS)
    .single();
  if (error) throw new Error(`Could not save application: ${error.message}`);
  audit(data.email, 'submitted lab application', data.name);
  return fromRow(row, false);
}

export async function listApplications(): Promise<ApplicationRecord[]> {
  const { data, error } = await supabaseAdmin().from('applications').select(LIST_COLUMNS);
  if (error) throw new Error(`Could not load applications: ${error.message}`);
  return (data ?? [])
    .map((r) => fromRow(r, false))
    .sort((a, b) => {
      if ((a.status === 'pending') !== (b.status === 'pending')) return a.status === 'pending' ? -1 : 1;
      return b.submittedAt - a.submittedAt;
    });
}

export async function getApplication(id: string): Promise<ApplicationRecord | undefined> {
  const { data, error } = await supabaseAdmin().from('applications').select('*').eq('id', id).maybeSingle();
  if (error || !data) return undefined;
  return fromRow(data, true);
}

export async function pendingApplicationCount(): Promise<number> {
  const { count } = await supabaseAdmin()
    .from('applications')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');
  return count ?? 0;
}

export interface DecisionResult {
  ok: boolean;
  error?: string;
  application?: ApplicationRecord;
}

export async function decideApplication(
  id: string,
  decision: 'approved' | 'withheld' | 'declined',
  reviewer: string,
  note: string,
): Promise<DecisionResult> {
  const { data: existing } = await supabaseAdmin().from('applications').select('status').eq('id', id).maybeSingle();
  if (!existing) return { ok: false, error: 'Application not found.' };
  if (existing.status !== 'pending') return { ok: false, error: `That application was already ${existing.status}.` };

  const { data: row, error } = await supabaseAdmin()
    .from('applications')
    .update({ status: decision, reviewed_at: new Date().toISOString(), reviewed_by: reviewer, decision_note: note.trim() || null })
    .eq('id', id)
    .select(LIST_COLUMNS)
    .single();
  if (error || !row) return { ok: false, error: error?.message ?? 'Could not record that decision.' };

  const app = fromRow(row, false);
  audit(reviewer, `${decision} application`, app.name, note.trim() || undefined);
  return { ok: true, application: app };
}

/* ------------------------------ two-reviewer votes ----------------------------- */
// mca-pipeline/add-application-votes.sql. Jawad and Burhan each vote on a
// pending application; once both have, the total score decides the outcome.

export type Vote = 'accept' | 'withhold' | 'reject';
export type ReviewerKey = 'jawad' | 'burhan';

// Either of a reviewer's logins counts as that reviewer.
export const REVIEWERS: { key: ReviewerKey; name: string; emails: string[] }[] = [
  { key: 'jawad', name: 'Jawad Basit', emails: ['jawadbasit1@gmail.com', 'jawad.basit@mcaheart.com'] },
  { key: 'burhan', name: 'Muhammad Burhan', emails: ['0muhammadb@gmail.com', 'muhammad.burhan@mcaheart.com'] },
];

export function reviewerFor(email: string | null | undefined): ReviewerKey | null {
  const e = (email ?? '').trim().toLowerCase();
  return REVIEWERS.find((r) => r.emails.includes(e))?.key ?? null;
}

export interface CastVote {
  vote: Vote;
  note: string | null;
  votedAt: number;
}
export type VoteSet = Partial<Record<ReviewerKey, CastVote>>;

const POINTS: Record<Vote, number> = { accept: 2, withhold: 1, reject: 0 };

/** Both votes in -> the total and the decision it maps to; otherwise null. */
export function scoreVotes(votes: VoteSet | undefined): { score: number; decision: 'approved' | 'withheld' | 'declined' } | null {
  if (!votes) return null;
  const cast = REVIEWERS.map((r) => votes[r.key]);
  if (cast.some((v) => !v)) return null;
  const score = cast.reduce((sum, v) => sum + POINTS[v!.vote], 0);
  return { score, decision: score >= 3 ? 'approved' : score === 2 ? 'withheld' : 'declined' };
}

/** Every application's votes, keyed by application id. Throws if the table isn't there yet. */
export async function listVotes(): Promise<Map<string, VoteSet>> {
  const { data, error } = await supabaseAdmin().from('application_votes').select('application_id,reviewer,vote,note,voted_at');
  if (error) throw new Error(error.message);
  const out = new Map<string, VoteSet>();
  for (const r of data ?? []) {
    const set = out.get(r.application_id) ?? {};
    set[r.reviewer as ReviewerKey] = { vote: r.vote, note: r.note, votedAt: new Date(r.voted_at).getTime() };
    out.set(r.application_id, set);
  }
  return out;
}

export async function castVote(
  appId: string,
  reviewer: ReviewerKey,
  vote: Vote,
  note: string,
  email: string,
): Promise<{ ok: boolean; error?: string }> {
  const { data: app } = await supabaseAdmin().from('applications').select('status').eq('id', appId).maybeSingle();
  if (!app) return { ok: false, error: 'Application not found.' };
  if (app.status !== 'pending') return { ok: false, error: `That application was already ${app.status}.` };
  const { error } = await supabaseAdmin()
    .from('application_votes')
    .upsert(
      { application_id: appId, reviewer, vote, note: note.trim() || null, voted_by_email: email, voted_at: new Date().toISOString() },
      { onConflict: 'application_id,reviewer' },
    );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
