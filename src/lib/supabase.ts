/**
 * MCA Pipeline (SPEC.md) — Supabase clients. Appendix A, verbatim intent:
 *
 *   "two clients: an anon client bound to the request's session for reads,
 *    and a service-role client used ONLY by the nightly job. Never expose
 *    the service key to the browser; it bypasses every policy in schema.sql."
 *
 * Neither client carries any authorization logic itself — schema.sql's RLS
 * policies, revoked grants, and `security definer` functions are the only
 * authority. This file just gets requests connected to Postgres correctly.
 */
import { createServerClient, createBrowserClient, parseCookieHeader } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AstroCookies } from 'astro';

const SUPABASE_URL = import.meta.env.SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.SUPABASE_ANON_KEY as string | undefined;
const SUPABASE_SERVICE_ROLE_KEY = import.meta.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'SUPABASE_URL / SUPABASE_ANON_KEY are not set. See mca-pipeline/SPEC.md Appendix A and .env.',
  );
}

/**
 * Request-scoped client bound to the visitor's own session cookie. Use this in
 * every pipeline page and API route — reads and writes both go through it, and
 * what it's actually allowed to do is entirely decided by RLS + the RPC
 * functions in schema.sql. This client itself holds no elevated privilege.
 */
export function supabaseForRequest(request: Request, cookies: AstroCookies): SupabaseClient {
  return createServerClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return parseCookieHeader(request.headers.get('Cookie') ?? '');
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          cookies.set(name, value, options as Parameters<AstroCookies['set']>[2]);
        }
      },
    },
  });
}

/**
 * Browser-side client for the one bit of client JS the stage dropdowns need
 * (Appendix A: "a small amount of client JS ... no React needed"). Only the
 * anon key, same as the server client — never the service key.
 */
export function supabaseBrowser(): SupabaseClient {
  return createBrowserClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
}

/**
 * Full-privilege client. Bypasses every RLS policy in schema.sql.
 *
 * Server-only, and only for the two jobs Appendix A names: the nightly
 * reminder sweep, and the one-time spreadsheet import. Never call this on
 * behalf of an end user's request, and never import this module from
 * anything that could end up in a browser bundle.
 */
let _admin: SupabaseClient | null = null;
export function supabaseAdmin(): SupabaseClient {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. Required for the nightly job / import only — ' +
        'normal request handling should use supabaseForRequest() instead.',
    );
  }
  _admin ??= createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _admin;
}
