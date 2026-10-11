/**
 * Store for research-idea submissions - Supabase-backed (service role,
 * mca-pipeline/add-forms-storage.sql), so submissions survive a server
 * restart. Previously an in-memory Map; the public shape (IdeaRecord) is
 * unchanged so admin/ideas.astro and pipeline/ideas.astro didn't need to
 * change at all.
 *
 * The public /submit-idea form writes here; /admin/ideas reads. Jawad or
 * Burhan adds an initial review, then the other ticks the outcome
 * (approved → creates a pipeline submission; rejected; modifications
 * suggested or further details requested, both stored as withheld). The
 * decision emails the submitter.
 */
import { supabaseAdmin } from './supabase';
import { audit } from './auth';
import type { IdeaPayload } from './idea-schema';
import type { ReviewerKey } from './applications';

export type IdeaStatus = 'pending' | 'approved' | 'withheld' | 'declined';

import { OUTCOME_LABEL, type IdeaOutcome } from './idea-email-template';
export { OUTCOME_LABEL, type IdeaOutcome };
export const OUTCOME_STATUS: Record<IdeaOutcome, Exclude<IdeaStatus, 'pending'>> = {
  approved: 'approved',
  rejected: 'declined',
  modify: 'withheld',
  details: 'withheld',
};

export interface IdeaRecord extends IdeaPayload {
  id: string;
  submittedAt: number;
  status: IdeaStatus;
  attachmentName: string | null;
  reviewedAt: number | null;
  reviewedBy: string | null;
  decisionNote: string | null;
  /** The box ticked in the final decision (null for ideas decided before add-idea-reviews.sql). */
  decisionOutcome: IdeaOutcome | null;
}

function fromRow(row: any): IdeaRecord {
  return {
    ...(row.payload as IdeaPayload),
    id: row.id,
    submittedAt: new Date(row.submitted_at).getTime(),
    status: row.status,
    attachmentName: row.attachment_filename,
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).getTime() : null,
    reviewedBy: row.reviewed_by,
    decisionNote: row.decision_note,
    decisionOutcome: row.decision_outcome ?? null,
  };
}

const BASE_COLUMNS = 'id,payload,status,submitted_at,reviewed_at,reviewed_by,decision_note,attachment_filename';
// decision_outcome comes from add-idea-reviews.sql; until that's run, every
// query falls back to the columns that already exist.
let hasOutcome = true;
const cols = () => (hasOutcome ? BASE_COLUMNS + ',decision_outcome' : BASE_COLUMNS);
const missingOutcome = (e: { message?: string } | null) => Boolean(e?.message?.includes('decision_outcome'));

/* -------------------------------------------------------------------------- */

export async function addIdea(data: IdeaPayload, attachmentName: string | null): Promise<IdeaRecord> {
  const insert = () =>
    supabaseAdmin()
      .from('ideas')
      .insert({ payload: data, status: 'pending', attachment_filename: attachmentName })
      .select(cols())
      .single();
  let { data: row, error } = await insert();
  if (missingOutcome(error)) {
    hasOutcome = false;
    ({ data: row, error } = await insert());
  }
  if (error) throw new Error(`Could not save idea: ${error.message}`);
  audit(data.leadEmail, 'submitted research idea', data.title);
  return fromRow(row);
}

export async function listIdeas(): Promise<IdeaRecord[]> {
  let { data, error } = await supabaseAdmin().from('ideas').select(cols());
  if (missingOutcome(error)) {
    hasOutcome = false;
    ({ data, error } = await supabaseAdmin().from('ideas').select(cols()));
  }
  if (error) throw new Error(`Could not load ideas: ${error.message}`);
  return (data ?? [])
    .map(fromRow)
    .sort((a, b) => {
      if ((a.status === 'pending') !== (b.status === 'pending')) return a.status === 'pending' ? -1 : 1;
      return b.submittedAt - a.submittedAt;
    });
}

export async function getIdea(id: string): Promise<IdeaRecord | undefined> {
  let { data, error } = await supabaseAdmin().from('ideas').select(cols()).eq('id', id).maybeSingle();
  if (missingOutcome(error)) {
    hasOutcome = false;
    ({ data, error } = await supabaseAdmin().from('ideas').select(cols()).eq('id', id).maybeSingle());
  }
  if (error || !data) return undefined;
  return fromRow(data);
}

export async function pendingIdeaCount(): Promise<number> {
  const { count } = await supabaseAdmin().from('ideas').select('id', { count: 'exact', head: true }).eq('status', 'pending');
  return count ?? 0;
}

export interface DecisionResult {
  ok: boolean;
  error?: string;
  idea?: IdeaRecord;
}

/** Record the final decision (one ticked box). Does NOT send email or create
 *  a submission - the page orchestrates those so failures surface cleanly. */
export async function decideIdea(
  id: string,
  outcome: IdeaOutcome,
  reviewer: string,
  note: string,
): Promise<DecisionResult> {
  const { data: existing } = await supabaseAdmin().from('ideas').select('status').eq('id', id).maybeSingle();
  if (!existing) return { ok: false, error: 'Idea not found.' };
  if (existing.status !== 'pending') return { ok: false, error: `That idea was already ${existing.status}.` };

  const status = OUTCOME_STATUS[outcome];
  const fields = { status, reviewed_at: new Date().toISOString(), reviewed_by: reviewer, decision_note: note.trim() || null };
  const update = () =>
    supabaseAdmin()
      .from('ideas')
      .update(hasOutcome ? { ...fields, decision_outcome: outcome } : fields)
      .eq('id', id)
      .select(cols())
      .single();
  let { data: row, error } = await update();
  if (missingOutcome(error)) {
    hasOutcome = false;
    ({ data: row, error } = await update());
  }
  if (error || !row) return { ok: false, error: error?.message ?? 'Could not record that decision.' };

  const idea = fromRow(row);
  audit(reviewer, `${OUTCOME_LABEL[outcome]}`, idea.title, note.trim() || undefined);
  return { ok: true, idea };
}

/* ------------------------------ initial reviews ------------------------------ */
// mca-pipeline/add-idea-reviews.sql. Jawad or Burhan adds an initial review;
// the other reads it and makes the final decision. Not blind.

export type Recommendation = 'accept' | 'reject' | 'modify';
export const RECOMMENDATION_LABEL: Record<Recommendation, string> = { accept: 'Accept', reject: 'Reject', modify: 'Modify' };

export interface IdeaReview {
  reviewer: ReviewerKey;
  recommendation: Recommendation;
  comment: string | null;
  reviewedAt: number;
}

/** Every idea's reviews, keyed by idea id, oldest first. Throws if the table isn't there yet. */
export async function listIdeaReviews(): Promise<Map<string, IdeaReview[]>> {
  const { data, error } = await supabaseAdmin()
    .from('idea_reviews')
    .select('idea_id,reviewer,recommendation,comment,reviewed_at')
    .order('reviewed_at');
  if (error) throw new Error(error.message);
  const out = new Map<string, IdeaReview[]>();
  for (const r of data ?? []) {
    const list = out.get(r.idea_id) ?? [];
    list.push({ reviewer: r.reviewer, recommendation: r.recommendation, comment: r.comment, reviewedAt: new Date(r.reviewed_at).getTime() });
    out.set(r.idea_id, list);
  }
  return out;
}

export async function saveIdeaReview(
  ideaId: string,
  reviewer: ReviewerKey,
  recommendation: Recommendation,
  comment: string,
  email: string,
): Promise<{ ok: boolean; error?: string }> {
  const { data: idea } = await supabaseAdmin().from('ideas').select('status').eq('id', ideaId).maybeSingle();
  if (!idea) return { ok: false, error: 'Idea not found.' };
  if (idea.status !== 'pending') return { ok: false, error: `That idea was already ${idea.status}.` };
  const { error } = await supabaseAdmin()
    .from('idea_reviews')
    .upsert(
      { idea_id: ideaId, reviewer, recommendation, comment: comment.trim() || null, reviewed_by_email: email, reviewed_at: new Date().toISOString() },
      { onConflict: 'idea_id,reviewer' },
    );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
