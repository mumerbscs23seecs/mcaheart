/**
 * Testimonials - "What our members say" on /research-group, managed from
 * /admin/testimonials. Persisted in Supabase (see mca-pipeline/add-
 * testimonials.sql), not the in-memory pattern used by ideas.ts /
 * applications.ts / requests.ts - the group wants these to survive a
 * server restart, and only a real database does that.
 *
 * Two access paths:
 *   - publicClient() - anon key, no session. Used by the public page and
 *     the photo route. Self-contained and fails soft (never throws) so a
 *     site with no Supabase configured still renders - this table is the
 *     only thing on the public marketing pages that touches Supabase at
 *     all, and it must not become a hard dependency for local dev.
 *   - the admin page's own bridged Supabase client (same pattern as
 *     admin/ideas.astro - bridgeAdminSession from the in-memory admin
 *     login), passed in to the write functions below. Every write goes
 *     through a security-definer function that re-checks role = 'admin'
 *     itself, so this file adds no authority of its own - Postgres does.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Same guard as lib/supabase.ts, for the same reason: supabase-js always
// constructs a RealtimeClient, which needs Node's native WebSocket (only
// present from Node 22+). Duplicated here rather than imported from
// supabase.ts, because that module throws at import time if Supabase env
// vars are unset - correct for the pipeline, where they're mandatory, but
// this file must stay importable from public pages that don't need them.
if (typeof globalThis.WebSocket === 'undefined') {
  const { WebSocket } = await import('ws');
  // @ts-expect-error - ws's shape is close enough for supabase-js's realtime client.
  globalThis.WebSocket = WebSocket;
}

let _public: SupabaseClient | null = null;
function publicClient(): SupabaseClient | null {
  const url = import.meta.env.SUPABASE_URL as string | undefined;
  const key = import.meta.env.SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) return null;
  _public ??= createClient(url, key, { auth: { persistSession: false } });
  return _public;
}

export interface Testimonial {
  id: string;
  quote: string;
  name: string;
  affiliation: string;
  future: string;
  /** True when a photo has been uploaded - the page decides <img> vs. an
   *  initials avatar from this, without fetching the bytes themselves. */
  hasPhoto: boolean;
}

const SELECT_COLS = 'id, quote, name, affiliation, future, photo_mime';
const rowToTestimonial = (r: any): Testimonial => ({
  id: r.id,
  quote: r.quote,
  name: r.name,
  affiliation: r.affiliation,
  future: r.future,
  hasPhoto: !!r.photo_mime,
});

/** Public read - the site's own visitors, no login. Never throws: an
 *  unconfigured or unreachable Supabase, or a table that doesn't exist yet
 *  (the SQL hasn't been run), all just mean an empty section rather than a
 *  broken page. */
export async function listTestimonialsPublic(): Promise<Testimonial[]> {
  const supabase = publicClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('testimonials')
    .select(SELECT_COLS)
    .order('sort', { ascending: true });
  if (error) {
    console.error('[testimonials] public list failed:', error.message);
    return [];
  }
  return (data ?? []).map(rowToTestimonial);
}

/** Admin read - same shape, but through the admin's own bridged client so
 *  it's consistent with the write functions below and works even before
 *  RLS would allow an anon read (defence in depth, not currently needed
 *  since reads are public, but keeps the admin page independent of that). */
export async function listTestimonialsAdmin(supabase: SupabaseClient): Promise<Testimonial[]> {
  const { data, error } = await supabase
    .from('testimonials')
    .select(SELECT_COLS)
    .order('sort', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToTestimonial);
}

export interface TestimonialInput {
  quote: string;
  name: string;
  affiliation: string;
  future: string;
}

export interface PhotoUpload {
  bytes: Buffer;
  mime: string;
  filename: string;
}

/** Postgres accepts \x-prefixed hex as bytea input through a text cast -
 *  the standard way to pass binary data through a PostgREST RPC call,
 *  which only ever carries JSON (a Buffer/Uint8Array has no JSON form). */
const toHexLiteral = (b: Buffer) => '\\x' + b.toString('hex');

export async function addTestimonial(
  supabase: SupabaseClient,
  data: TestimonialInput,
  photo: PhotoUpload | null,
): Promise<void> {
  const { error } = await supabase.rpc('add_testimonial', {
    p_quote: data.quote,
    p_name: data.name,
    p_affiliation: data.affiliation,
    p_future: data.future,
    p_photo_bytes: photo ? toHexLiteral(photo.bytes) : null,
    p_photo_mime: photo?.mime ?? null,
    p_photo_filename: photo?.filename ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function updateTestimonial(
  supabase: SupabaseClient,
  id: string,
  data: TestimonialInput,
  photo: PhotoUpload | null,
  removePhoto: boolean,
): Promise<void> {
  const { error } = await supabase.rpc('update_testimonial', {
    p_id: id,
    p_quote: data.quote,
    p_name: data.name,
    p_affiliation: data.affiliation,
    p_future: data.future,
    p_photo_bytes: photo ? toHexLiteral(photo.bytes) : null,
    p_photo_mime: photo?.mime ?? null,
    p_photo_filename: photo?.filename ?? null,
    // A new upload always replaces the old photo regardless of this flag
    // (see update_testimonial's own precedence) - it only matters when no
    // new file was chosen: true keeps the existing photo, false clears it.
    p_keep_photo: !removePhoto,
  });
  if (error) throw new Error(error.message);
}

export async function deleteTestimonial(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_testimonial', { p_id: id });
  if (error) throw new Error(error.message);
}

export async function reorderTestimonial(
  supabase: SupabaseClient,
  id: string,
  direction: 'up' | 'down',
): Promise<void> {
  const { error } = await supabase.rpc('reorder_testimonial', { p_id: id, p_direction: direction });
  if (error) throw new Error(error.message);
}

/** For the public photo route - the one place that actually needs the
 *  bytes. Kept separate from the listing query so a page full of cards
 *  never pulls image bytes it isn't about to render. */
export async function getTestimonialPhoto(
  id: string,
): Promise<{ bytes: Buffer; mime: string; filename: string } | null> {
  const supabase = publicClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('testimonials')
    .select('photo_bytes, photo_mime, photo_filename')
    .eq('id', id)
    .maybeSingle();
  if (error || !data || !data.photo_bytes) return null;
  // supabase-js returns bytea as a "\x..." hex string over PostgREST.
  const hex = String(data.photo_bytes).replace(/^\\x/, '');
  return { bytes: Buffer.from(hex, 'hex'), mime: data.photo_mime, filename: data.photo_filename };
}
