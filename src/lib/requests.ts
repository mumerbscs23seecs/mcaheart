/**
 * Store for contact-form submissions ("Requests" in the admin nav) -
 * Supabase-backed (service role, mca-pipeline/add-forms-storage.sql), so
 * submissions survive a server restart. Previously an in-memory Map; the
 * public shape (RequestRecord) is unchanged so admin/requests.astro didn't
 * need to change at all.
 */
import { supabaseAdmin } from './supabase';
import { audit } from './auth';
import type { ContactPayload, Intent } from './contact-schema';

export interface StoredFile {
  filename: string;
  mime: string;
  size: number;
  bytes: Buffer;
}

export interface RequestRecord extends ContactPayload {
  id: string;
  submittedAt: number;
  cv: StoredFile | null;
  /** Flips to true the first time an admin opens /admin/requests after this arrived. */
  read: boolean;
}

const hexToBuffer = (hex: string) => Buffer.from(hex.slice(2), 'hex');
const toHexLiteral = (b: Buffer) => '\\x' + b.toString('hex');

function fromRow(row: any, withBytes: boolean): RequestRecord {
  return {
    ...(row.payload as ContactPayload),
    id: row.id,
    submittedAt: new Date(row.submitted_at).getTime(),
    cv: row.cv_filename
      ? { filename: row.cv_filename, mime: row.cv_mime, size: row.cv_size, bytes: withBytes ? hexToBuffer(row.cv_bytes) : Buffer.alloc(0) }
      : null,
    read: row.read_at != null,
  };
}

const LIST_COLUMNS = 'id,payload,submitted_at,read_at,cv_filename,cv_mime,cv_size';

/* -------------------------------------------------------------------------- */

export async function addRequest(data: ContactPayload, cv: StoredFile | null): Promise<RequestRecord> {
  const { data: row, error } = await supabaseAdmin()
    .from('contact_requests')
    .insert({
      payload: data,
      cv_bytes: cv ? toHexLiteral(cv.bytes) : null,
      cv_mime: cv?.mime ?? null,
      cv_filename: cv?.filename ?? null,
      cv_size: cv?.size ?? null,
    })
    .select(LIST_COLUMNS)
    .single();
  if (error) throw new Error(`Could not save request: ${error.message}`);
  audit(data.email, 'submitted contact request', data.fullName);
  return fromRow(row, false);
}

export async function listRequests(intent?: Intent): Promise<RequestRecord[]> {
  const { data, error } = await supabaseAdmin().from('contact_requests').select(LIST_COLUMNS).order('submitted_at', { ascending: false });
  if (error) throw new Error(`Could not load requests: ${error.message}`);
  const all = (data ?? []).map((r) => fromRow(r, false));
  return intent ? all.filter((r) => r.intent === intent) : all;
}

export async function getRequest(id: string): Promise<RequestRecord | undefined> {
  const { data, error } = await supabaseAdmin().from('contact_requests').select('*').eq('id', id).maybeSingle();
  if (error || !data) return undefined;
  return fromRow(data, true);
}

export async function unreadRequestCount(): Promise<number> {
  const { count } = await supabaseAdmin().from('contact_requests').select('id', { count: 'exact', head: true }).is('read_at', null);
  return count ?? 0;
}

/** Called when the admin opens the requests list - marks everything currently there as read. */
export async function markAllRequestsRead(): Promise<void> {
  await supabaseAdmin().from('contact_requests').update({ read_at: new Date().toISOString() }).is('read_at', null);
}
