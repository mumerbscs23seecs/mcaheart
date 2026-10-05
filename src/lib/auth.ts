/**
 * Who is signed in, for the /admin, /pipeline and /account pages.
 *
 * Accounts are Supabase Auth users (email + password, stored hashed by
 * Supabase) linked to an active `people` row, which carries the role. The
 * middleware resolves the session once per request and records the user here
 * against that request's cookies object, so pages keep the simple synchronous
 * `currentUser(Astro.cookies)` call.
 *
 * The audit log is a small in-memory ring buffer of recent admin actions.
 */
import type { AstroCookies } from 'astro';

export type Role = 'admin' | 'member';

export interface User {
  /** people.id */
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface AuditEntry {
  at: number;
  actor: string;
  action: string;
  target?: string;
  detail?: string;
}

const HINT_COOKIE = 'mca_hint'; // non-httpOnly UI hint for the public header, never trusted for auth

const requestUsers = new WeakMap<AstroCookies, User>();

/** Set by the middleware once the request's session is verified. */
export function setRequestUser(cookies: AstroCookies, user: User) {
  requestUsers.set(cookies, user);
}

/** The signed-in user for this request, or null. */
export function currentUser(cookies: AstroCookies): User | null {
  return requestUsers.get(cookies) ?? null;
}

/** Lets the public header show the members menu. Contains no secrets. */
export function setHintCookie(cookies: AstroCookies, user: User) {
  cookies.set(HINT_COOKIE, JSON.stringify({ name: user.name, role: user.role }), {
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 14,
    secure: import.meta.env.PROD,
    httpOnly: false,
  });
}

export function clearHintCookie(cookies: AstroCookies) {
  cookies.delete(HINT_COOKIE, { path: '/' });
}

/* -------------------------------------------------------------------------- */
/* Audit                                                                       */
/* -------------------------------------------------------------------------- */

const auditLog: AuditEntry[] = [];

export function audit(actor: string, action: string, target?: string, detail?: string) {
  auditLog.unshift({ at: Date.now(), actor, action, target, detail });
  if (auditLog.length > 200) auditLog.length = 200;
}

export function listAudit(): AuditEntry[] {
  return [...auditLog];
}
