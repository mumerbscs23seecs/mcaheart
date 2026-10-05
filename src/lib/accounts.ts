/**
 * Login accounts: a Supabase Auth user (email + hashed password) linked to a
 * `people` row by people.auth_id. Server-only - uses the service key.
 *
 * Members start on the shared password in DEFAULT_MEMBER_PASSWORD (a Render
 * env var, never in code) with app_metadata.must_change_password = true, so
 * the middleware sends them to /account/password before anything else.
 */
import { supabaseAdmin } from './supabase';
import { deliverAccessLink } from './auth-mailer';

export const DEFAULT_PASSWORD = (import.meta.env.DEFAULT_MEMBER_PASSWORD as string | undefined) ?? '';
export const MIN_PASSWORD = 8;

export const hasRealEmail = (email: string | null | undefined) => !!email && !email.endsWith('@import.invalid');

export interface AuthInfo {
  id: string;
  email: string;
  lastSignIn: string | null;
  mustChange: boolean;
}

/** Every auth user, keyed by id. */
export async function listAuthUsers(): Promise<Map<string, AuthInfo>> {
  const admin = supabaseAdmin();
  const out = new Map<string, AuthInfo>();
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const u of data.users) {
      out.set(u.id, {
        id: u.id,
        email: (u.email ?? '').toLowerCase(),
        lastSignIn: u.last_sign_in_at ?? null,
        mustChange: u.app_metadata?.must_change_password === true,
      });
    }
    if (data.users.length < 1000) break;
  }
  return out;
}

/** The auth user for a person (created or re-pointed to their email if needed). */
export async function ensureAuthUser(person: { id: string; email: string; auth_id: string | null }): Promise<string> {
  const admin = supabaseAdmin();
  const email = person.email.toLowerCase();

  if (person.auth_id) {
    const { data } = await admin.auth.admin.getUserById(person.auth_id);
    if (data?.user) {
      if ((data.user.email ?? '').toLowerCase() !== email) {
        const { error } = await admin.auth.admin.updateUserById(person.auth_id, { email, email_confirm: true });
        if (error) throw error;
      }
      return person.auth_id;
    }
  }

  const existing = [...(await listAuthUsers()).values()].find((u) => u.email === email);
  let authId = existing?.id;
  if (!authId) {
    const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
    if (error || !data.user) throw error ?? new Error('Could not create the login.');
    authId = data.user.id;
  }
  const { error: linkErr } = await admin.from('people').update({ auth_id: authId }).eq('id', person.id);
  if (linkErr) throw linkErr;
  return authId;
}

/** Put a member back on the shared starting password (they must change it again). */
export async function resetToDefaultPassword(person: { id: string; email: string; auth_id: string | null }) {
  if (!DEFAULT_PASSWORD) throw new Error('DEFAULT_MEMBER_PASSWORD is not set on the server.');
  const authId = await ensureAuthUser(person);
  const { error } = await supabaseAdmin().auth.admin.updateUserById(authId, {
    password: DEFAULT_PASSWORD,
    app_metadata: { must_change_password: true },
  });
  if (error) throw error;
}

export async function clearMustChange(authId: string) {
  const { error } = await supabaseAdmin().auth.admin.updateUserById(authId, {
    app_metadata: { must_change_password: false },
  });
  if (error) throw error;
}

/**
 * Email a set-a-new-password link. Silently does nothing for unknown,
 * inactive or placeholder addresses - callers always show the same message.
 */
export async function sendResetLink(email: string, origin: string): Promise<{ sent: boolean; error?: string }> {
  const clean = email.trim().toLowerCase();
  const admin = supabaseAdmin();
  const { data: person } = await admin
    .from('people')
    .select('id,full_name,email,auth_id,active')
    .ilike('email', clean)
    .maybeSingle();
  if (!person?.active || !hasRealEmail(person.email)) return { sent: false };

  await ensureAuthUser(person);
  const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email: clean });
  const hash = data?.properties?.hashed_token;
  if (error || !hash) return { sent: false, error: error?.message ?? 'Could not create a reset link.' };

  const link = `${origin}/reset-password?token_hash=${encodeURIComponent(hash)}`;
  const res = await deliverAccessLink({ to: clean, name: person.full_name, link, kind: 'reset' });
  return { sent: res.ok, error: res.error };
}
