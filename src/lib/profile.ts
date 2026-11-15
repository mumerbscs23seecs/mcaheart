/**
 * A member's own profile: name and affiliation (update_my_profile), photo
 * (people_photos, service key only) and sign-in email (Supabase Auth + the
 * people row, changed together with the service key).
 * Tables and function come from mca-pipeline/add-profiles.sql.
 */
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from './supabase';

export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PHOTO_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];

/** Re-encode any upload as a 400x400 WebP. Works from the bytes, never the
 *  browser-supplied type, so whatever is stored is always a real image. */
export async function processPhoto(file: File): Promise<{ bytes: Buffer } | { error: string }> {
  if (file.size > PHOTO_MAX_BYTES) return { error: 'That photo is over 5 MB.' };
  const dot = file.name.lastIndexOf('.');
  const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : '';
  if (!PHOTO_EXTENSIONS.includes(ext)) return { error: `Use a ${PHOTO_EXTENSIONS.join(', ')} image.` };
  try {
    const sharp = (await import('sharp')).default;
    const bytes = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .resize(400, 400, { fit: 'cover', position: 'attention' })
      .webp({ quality: 82 })
      .toBuffer();
    return { bytes };
  } catch {
    return { error: 'That file could not be read as an image.' };
  }
}

const hex = (b: Buffer) => '\\x' + b.toString('hex');

export async function savePhoto(personId: string, bytes: Buffer): Promise<string | null> {
  const { error } = await supabaseAdmin()
    .from('people_photos')
    .upsert({ person_id: personId, bytes: hex(bytes), mime: 'image/webp', updated_at: new Date().toISOString() });
  return error ? error.message : null;
}

export async function removePhoto(personId: string): Promise<string | null> {
  const { error } = await supabaseAdmin().from('people_photos').delete().eq('person_id', personId);
  return error ? error.message : null;
}

/** When each person's photo was last changed (for cache-busting URLs), for
 *  the given ids. Empty if the table doesn't exist yet. */
export async function photoVersions(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!ids.length) return out;
  const { data, error } = await supabaseAdmin().from('people_photos').select('person_id,updated_at').in('person_id', ids);
  if (error) return out;
  for (const r of data ?? []) out.set(r.person_id, String(new Date(r.updated_at).getTime()));
  return out;
}

export const photoUrl = (personId: string, version: string) => `/pipeline/people/${personId}/photo?v=${version}`;

/** The photo bytes, or null. */
export async function readPhoto(personId: string): Promise<{ bytes: Buffer; mime: string } | null> {
  const { data, error } = await supabaseAdmin().from('people_photos').select('bytes,mime').eq('person_id', personId).maybeSingle();
  if (error || !data?.bytes) return null;
  const raw = String(data.bytes);
  const bytes = raw.startsWith('\\x') ? Buffer.from(raw.slice(2), 'hex') : Buffer.from(raw, 'base64');
  return { bytes, mime: data.mime || 'image/webp' };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Change the sign-in email. Checks the current password first, then changes
 * the login (Supabase Auth) and the people row together - if the second step
 * fails, the first is put back, so the two never disagree.
 */
export async function changeEmail(opts: {
  personId: string;
  authId: string;
  currentEmail: string;
  newEmail: string;
  password: string;
}): Promise<string | null> {
  const next = opts.newEmail.trim().toLowerCase();
  if (!EMAIL_RE.test(next) || next.length > 254) return 'Enter a valid email address.';
  if (next === opts.currentEmail.trim().toLowerCase()) return null;
  if (!opts.password) return 'Enter your current password to change your email.';

  // Check the password with a throwaway client, so the visitor's own session
  // cookies are untouched.
  const url = import.meta.env.SUPABASE_URL as string;
  const anon = import.meta.env.SUPABASE_ANON_KEY as string;
  const probe = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: pwErr } = await probe.auth.signInWithPassword({ email: opts.currentEmail, password: opts.password });
  if (pwErr) return 'Your current password is not correct.';
  await probe.auth.signOut({ scope: 'local' }).catch(() => {});

  const admin = supabaseAdmin();
  const { data: taken } = await admin.from('people').select('id').ilike('email', next).neq('id', opts.personId).maybeSingle();
  if (taken) return 'Someone else in the lab already uses that email.';

  const { error: authErr } = await admin.auth.admin.updateUserById(opts.authId, { email: next, email_confirm: true });
  if (authErr) return `Could not change the sign-in email: ${authErr.message}`;

  const { error: rowErr } = await admin.from('people').update({ email: next }).eq('id', opts.personId);
  if (rowErr) {
    await admin.auth.admin.updateUserById(opts.authId, { email: opts.currentEmail, email_confirm: true });
    return `Could not change the email: ${rowErr.message}`;
  }
  return null;
}
