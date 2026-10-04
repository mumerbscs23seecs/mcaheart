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
