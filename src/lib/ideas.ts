/**
 * Store for research-idea submissions - Supabase-backed (service role,
 * mca-pipeline/add-forms-storage.sql), so submissions survive a server
 * restart. Previously an in-memory Map; the public shape (IdeaRecord) is
 * unchanged so admin/ideas.astro and pipeline/ideas.astro didn't need to
 * change at all.
 *
 * The public /submit-idea form writes here; /admin/ideas reads, and an admin
 * approves (→ creates a pipeline submission), withholds (held for later, not
 * a final answer), or declines. All three decisions email the submitter.
 */
import { supabaseAdmin } from './supabase';
import { audit } from './auth';
import type { IdeaPayload } from './idea-schema';

export type IdeaStatus = 'pending' | 'approved' | 'withheld' | 'declined';

export interface IdeaRecord extends IdeaPayload {
  id: string;
  submittedAt: number;
  status: IdeaStatus;
  attachmentName: string | null;
  reviewedAt: number | null;
  reviewedBy: string | null;
  decisionNote: string | null;
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
  };
}

const LIST_COLUMNS = 'id,payload,status,submitted_at,reviewed_at,reviewed_by,decision_note,attachment_filename';

/* -------------------------------------------------------------------------- */

export async function addIdea(data: IdeaPayload, attachmentName: string | null): Promise<IdeaRecord> {
  const { data: row, error } = await supabaseAdmin()
    .from('ideas')
    .insert({ payload: data, status: 'pending', attachment_filename: attachmentName })
    .select(LIST_COLUMNS)
    .single();
  if (error) throw new Error(`Could not save idea: ${error.message}`);
  audit(data.leadEmail, 'submitted research idea', data.title);
  return fromRow(row);
}

export async function listIdeas(): Promise<IdeaRecord[]> {
  const { data, error } = await supabaseAdmin().from('ideas').select(LIST_COLUMNS);
  if (error) throw new Error(`Could not load ideas: ${error.message}`);
  return (data ?? [])
    .map(fromRow)
    .sort((a, b) => {
      if ((a.status === 'pending') !== (b.status === 'pending')) return a.status === 'pending' ? -1 : 1;
      return b.submittedAt - a.submittedAt;
    });
}

export async function getIdea(id: string): Promise<IdeaRecord | undefined> {
  const { data, error } = await supabaseAdmin().from('ideas').select(LIST_COLUMNS).eq('id', id).maybeSingle();
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

/** Record an approve/withhold/decline. Does NOT send email or create a
 *  submission - the page orchestrates those so failures surface cleanly. */
export async function decideIdea(
  id: string,
  decision: 'approved' | 'withheld' | 'declined',
  reviewer: string,
  note: string,
): Promise<DecisionResult> {
  const { data: existing } = await supabaseAdmin().from('ideas').select('status').eq('id', id).maybeSingle();
  if (!existing) return { ok: false, error: 'Idea not found.' };
  if (existing.status !== 'pending') return { ok: false, error: `That idea was already ${existing.status}.` };

  const { data: row, error } = await supabaseAdmin()
    .from('ideas')
    .update({ status: decision, reviewed_at: new Date().toISOString(), reviewed_by: reviewer, decision_note: note.trim() || null })
    .eq('id', id)
    .select(LIST_COLUMNS)
    .single();
  if (error || !row) return { ok: false, error: error?.message ?? 'Could not record that decision.' };

  const idea = fromRow(row);
  audit(reviewer, `${decision} idea`, idea.title, note.trim() || undefined);
  return { ok: true, idea };
}
