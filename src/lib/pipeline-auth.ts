/**
 * Supabase session -> `people` row, for every signed-in page.
 *
 * Everyone signs in with email + password (Supabase Auth). A person can only
 * get in with an active `people` row for their email - accounts never
 * self-create. app_metadata.must_change_password (writable only with the
 * service key) forces a new password before anything else is usable.
 */
import type { AstroCookies } from 'astro';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseForRequest, supabaseAdmin } from './supabase';

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
  mustChangePassword: boolean;
}

/**
 * Every pipeline/admin page load calls getPipelineSession() once, and it's
 * two Supabase round trips: auth.getUser() (real token validation - never
 * skipped) then a `people` row lookup (rarely changes request to request).
 * That second one is what's cached here, briefly, keyed by auth id - so
 * clicking around the pipeline doesn't re-query the same row on every
 * single navigation. Short enough that a role/active change from the
 * Access page takes effect within a few seconds, not minutes.
 */
const PERSON_CACHE_TTL_MS = 20_000;
const personCache = new Map<string, { person: Person; expiresAt: number }>();

/** Resolve the current pipeline user, or null. Links auth_id on first sign-in. */
export async function getPipelineSession(
  request: Request,
  cookies: AstroCookies,
  /** Pass the client that just signed in - its session isn't in the request cookies yet. */
  client?: SupabaseClient,
): Promise<PipelineSession | null> {
  const supabase = client ?? supabaseForRequest(request, cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const cached = personCache.get(user.id);
  let person: Person | null;
  if (cached && cached.expiresAt > Date.now()) {
    person = cached.person;
  } else {
    const { data } = await supabase.from('people').select('*').eq('auth_id', user.id).maybeSingle();
    person = data as Person | null;
    if (person) personCache.set(user.id, { person, expiresAt: Date.now() + PERSON_CACHE_TTL_MS });
  }

  if (!person) {
    // First authenticated request for this account - link it to the invited
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
  return { supabase, person: person as Person, mustChangePassword: user.app_metadata?.must_change_password === true };
}
