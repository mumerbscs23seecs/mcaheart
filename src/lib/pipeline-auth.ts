/**
 * Auth for the /pipeline section (SPEC.md Appendix A).
 *
 * Magic-link sign-in, but the link is generated server-side by Supabase and
 * delivered through this app's own Gmail transport (src/lib/email.ts) instead
 * of Supabase's built-in mailer — so it lands reliably and matches the rest of
 * the app's email.
 *
 * A person can only sign in if there is an active `people` row with their
 * email. Accounts never self-create.
 */
import type { AstroCookies } from 'astro';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseForRequest, supabaseAdmin } from './supabase';
import { currentUser as inMemoryUser } from './auth';

export interface Person {
  id: string;
  auth_id: string | null;
  full_name: string;
  initials: string | null;
  email: string;
  role: 'admin' | 'member' | 'viewer';
  active: boolean;
}

export interface PipelineSession {
  supabase: SupabaseClient;
  person: Person;
}

/** Resolve the current pipeline user, or null. Links auth_id on first sign-in. */
export async function getPipelineSession(
  request: Request,
  cookies: AstroCookies,
): Promise<PipelineSession | null> {
  const supabase = supabaseForRequest(request, cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  let { data: person } = await supabase
    .from('people')
    .select('*')
    .eq('auth_id', user.id)
    .maybeSingle();

  if (!person) {
    // First authenticated request for this account — link it to the invited
    // person row by email (needs elevated write; people.auth_id is revoked from
    // the authenticated role).
    const admin = supabaseAdmin();
    const { data: linked } = await admin
      .from('people')
      .update({ auth_id: user.id })
      .eq('email', user.email)
      .is('auth_id', null)
      .select('*')
      .maybeSingle();
    person = linked ?? null;
  }

  if (!person || !person.active) return null;
  return { supabase, person: person as Person };
}

/**
 * Bridge: if the visitor is signed into the existing admin panel (in-memory
 * session), give them a matching Supabase session transparently — no magic
 * link, no second password. Their /admin login is the only one they use; the
 * pipeline "just works" for any admin.
 *
 * Cost is one round of createUser + generateLink + verifyOtp the first time
 * per session; after that a normal Supabase session cookie is set and
 * getPipelineSession() handles it directly.
 */
export async function bridgeAdminSession(
  request: Request,
  cookies: AstroCookies,
): Promise<PipelineSession | null> {
  const inMem = inMemoryUser(cookies);
  if (!inMem) return null;

  const supabase = supabaseForRequest(request, cookies);
  const email = inMem.email.toLowerCase();
  const role = inMem.role === 'admin' ? 'admin' : 'member';

  // Already carrying a Supabase session for the same person?
  const {
    data: { user: existing },
  } = await supabase.auth.getUser();
  let authId = existing?.email?.toLowerCase() === email ? existing.id : null;

  if (!authId) {
    const admin = supabaseAdmin();
    await admin.auth.admin.createUser({ email, email_confirm: true }).catch(() => {});
    const { data: link, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    const hash = link?.properties?.hashed_token;
    if (error || !hash) return null;
    const { error: vErr } = await supabase.auth.verifyOtp({ type: 'email', token_hash: hash });
    if (vErr) return null;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    authId = user?.id ?? null;
    if (!authId) return null;
  }

  const admin = supabaseAdmin();
  await admin
    .from('people')
    .upsert(
      { email, full_name: inMem.name, role, active: true, auth_id: authId },
      { onConflict: 'email' },
    );
  const { data: person } = await supabase.from('people').select('*').eq('email', email).maybeSingle();
  return person && (person as Person).active ? { supabase, person: person as Person } : null;
}

/**
 * Start a magic-link sign-in for `email`. Returns { ok:true } whether or not
 * the email actually has access — never leak which addresses are members.
 * The real link (or the reason it wasn't sent) is only ever in the email.
 */
export async function requestMagicLink(email: string, origin: string): Promise<{ ok: true }> {
  const clean = email.trim().toLowerCase();
  const admin = supabaseAdmin();

  const { data: person } = await admin
    .from('people')
    .select('id, active')
    .eq('email', clean)
    .maybeSingle();

  if (person?.active) {
    // Ensure the auth user exists (generateLink('magiclink') needs it to).
    await admin.auth.admin.createUser({ email: clean, email_confirm: true }).catch(() => {});

    const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: clean });
    const hash = data?.properties?.hashed_token;
    if (!error && hash) {
      const link = `${origin}/pipeline/auth/callback?token_hash=${encodeURIComponent(hash)}`;
      const { deliverMagicLink } = await import('./pipeline-mailer');
      await deliverMagicLink(clean, link).catch((e) => console.error('[pipeline] magic link email failed:', e));
    } else if (error) {
      console.error('[pipeline] generateLink failed:', error.message);
    }
  }

  return { ok: true };
}
