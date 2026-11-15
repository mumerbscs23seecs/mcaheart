/**
 * A member's own profile: name and affiliation (update_my_profile), skills
 * for mentees (set_my_skills) and sign-in email (Supabase Auth + the people
 * row, changed together with the service key).
 * Tables and function come from mca-pipeline/add-profiles.sql.
 */
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from './supabase';

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
