/**
 * DEMO authentication — in-memory only.
 *
 * There is no database. Every user, session, reset token and audit entry lives
 * in module memory and is wiped when the Node process restarts (or when the dev
 * server hot-reloads this file). This exists so the login / members-area / admin
 * flow can be clicked through and handed to an engineer as a reference. The real
 * build replaces this whole file with a database-backed implementation — the
 * exported function signatures are the contract to keep.
 */
import type { AstroCookies } from 'astro';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export type Role = 'admin' | 'member';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  /** null until the invitee sets a password via the reset link. */
  passwordHash: string | null;
  createdAt: number;
  lastLoginAt: number | null;
}

export interface AuditEntry {
  at: number;
  actor: string;
  action: string;
  target?: string;
  detail?: string;
}

const SESSION_COOKIE = 'mca_session';
const HINT_COOKIE = 'mca_hint'; // non-httpOnly UI hint, never trusted for auth
const SESSION_TTL = 14 * 24 * 60 * 60 * 1000; // 14 days
const RESET_TTL = 60 * 60 * 1000; // 1 hour

/* -------------------------------------------------------------------------- */
/* Password hashing                                                            */
/* -------------------------------------------------------------------------- */

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const [salt, key] = stored.split(':');
  if (!salt || !key) return false;
  const derived = scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(key, 'hex');
  return keyBuf.length === derived.length && timingSafeEqual(keyBuf, derived);
}

/* -------------------------------------------------------------------------- */
/* Stores                                                                      */
/* -------------------------------------------------------------------------- */

const users = new Map<string, User>();
const sessions = new Map<string, { userId: string; expiresAt: number }>();
const resetTokens = new Map<string, { userId: string; expiresAt: number }>();
const auditLog: AuditEntry[] = [];

/** Seed once per process. */
function seed() {
  if (users.size) return;
  const now = Date.now();
  const make = (u: Omit<User, 'createdAt' | 'lastLoginAt'>): User => ({
    ...u,
    createdAt: now,
    lastLoginAt: null,
  });

  users.set('u_admin', make({
    id: 'u_admin',
    name: 'Site Admin',
    email: 'admin@mcaheart.com',
    role: 'admin',
    active: true,
    passwordHash: hashPassword('admin1234'),
  }));
  users.set('u_member', make({
    id: 'u_member',
    name: 'Jawad (Coordinator)',
    email: 'member@mcaheart.com',
    role: 'member',
    active: true,
    passwordHash: hashPassword('member1234'),
  }));
  users.set('u_pending', make({
    id: 'u_pending',
    name: 'Pending Invitee',
    email: 'pending@mcaheart.com',
    role: 'member',
    active: true,
    passwordHash: null, // invite not yet accepted
  }));

  audit('system', 'seeded demo users', undefined, '3 users created');
}
seed();

/* -------------------------------------------------------------------------- */
/* Audit                                                                       */
/* -------------------------------------------------------------------------- */

export function audit(actor: string, action: string, target?: string, detail?: string) {
  auditLog.unshift({ at: Date.now(), actor, action, target, detail });
  if (auditLog.length > 200) auditLog.length = 200;
}

export function listAudit(): AuditEntry[] {
  return [...auditLog];
}

/* -------------------------------------------------------------------------- */
/* Users                                                                       */
/* -------------------------------------------------------------------------- */

export function listUsers(): User[] {
  return [...users.values()].sort((a, b) => a.createdAt - b.createdAt);
}

export function findByEmail(email: string): User | undefined {
  const norm = email.trim().toLowerCase();
  return [...users.values()].find((u) => u.email.toLowerCase() === norm);
}

export function getUser(id: string): User | undefined {
  return users.get(id);
}

export interface AddUserResult {
  ok: boolean;
  error?: string;
  user?: User;
  resetToken?: string;
}

/** Admin invites a member by email. Returns a set-password token. */
export function addUser(
  input: { name: string; email: string; role: Role },
  actorName: string,
): AddUserResult {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) return { ok: false, error: 'Name is required.' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: 'Enter a valid email address.' };
  if (findByEmail(email)) return { ok: false, error: 'A user with that email already exists.' };

  const id = `u_${randomBytes(6).toString('hex')}`;
  const user: User = {
    id,
    name,
    email,
    role: input.role === 'admin' ? 'admin' : 'member',
    active: true,
    passwordHash: null,
    createdAt: Date.now(),
    lastLoginAt: null,
  };
  users.set(id, user);
  const token = createResetToken(email);
  audit(actorName, 'added user', email, `role: ${user.role}`);
  return { ok: true, user, resetToken: token ?? undefined };
}

export function setActive(id: string, active: boolean, actorName: string): boolean {
  const user = users.get(id);
  if (!user) return false;
  user.active = active;
  if (!active) {
    // Kill any live sessions for a deactivated user.
    for (const [token, s] of sessions) if (s.userId === id) sessions.delete(token);
  }
  audit(actorName, active ? 'reactivated user' : 'deactivated user', user.email);
  return true;
}

export function setRole(id: string, role: Role, actorName: string): boolean {
  const user = users.get(id);
  if (!user) return false;
  user.role = role === 'admin' ? 'admin' : 'member';
  audit(actorName, 'changed role', user.email, `now ${user.role}`);
  return true;
}

/* -------------------------------------------------------------------------- */
/* Password reset                                                              */
/* -------------------------------------------------------------------------- */

export function createResetToken(email: string): string | null {
  const user = findByEmail(email);
  if (!user) return null;
  const token = randomBytes(24).toString('hex');
  resetTokens.set(token, { userId: user.id, expiresAt: Date.now() + RESET_TTL });
  return token;
}

export function peekResetToken(token: string): User | null {
  const entry = resetTokens.get(token);
  if (!entry || entry.expiresAt < Date.now()) {
    resetTokens.delete(token);
    return null;
  }
  return users.get(entry.userId) ?? null;
}

export function consumeReset(token: string, newPassword: string): { ok: boolean; error?: string } {
  const entry = resetTokens.get(token);
  if (!entry || entry.expiresAt < Date.now()) {
    resetTokens.delete(token);
    return { ok: false, error: 'That link has expired. Ask the admin for a new one.' };
  }
  if (newPassword.length < 8) return { ok: false, error: 'Password must be at least 8 characters.' };
  const user = users.get(entry.userId);
  if (!user) return { ok: false, error: 'Account no longer exists.' };
  user.passwordHash = hashPassword(newPassword);
  resetTokens.delete(token);
  audit(user.email, 'set password via reset link');
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Sessions                                                                    */
/* -------------------------------------------------------------------------- */

export interface LoginResult {
  ok: boolean;
  error?: string;
  user?: User;
}

export function verifyLogin(email: string, password: string): LoginResult {
  const user = findByEmail(email);
  // Same message either way — do not reveal which accounts exist.
  const generic = { ok: false as const, error: 'Email or password is incorrect.' };
  if (!user || !user.active) return generic;
  if (!verifyPassword(password, user.passwordHash)) return generic;
  user.lastLoginAt = Date.now();
  audit(user.email, 'logged in');
  return { ok: true, user };
}

function hintValue(user: User): string {
  // Raw JSON — Astro's cookie layer percent-encodes it once on the way out,
  // so the browser script decodes exactly once. No sensitive data here.
  return JSON.stringify({ name: user.name, role: user.role });
}

/** Issue a session and write both cookies. */
export function startSession(cookies: AstroCookies, user: User) {
  const token = randomBytes(24).toString('hex');
  sessions.set(token, { userId: user.id, expiresAt: Date.now() + SESSION_TTL });
  const common = { path: '/', sameSite: 'lax' as const, maxAge: SESSION_TTL / 1000, secure: import.meta.env.PROD };
  cookies.set(SESSION_COOKIE, token, { ...common, httpOnly: true });
  cookies.set(HINT_COOKIE, hintValue(user), { ...common, httpOnly: false });
}

export function endSession(cookies: AstroCookies) {
  const token = cookies.get(SESSION_COOKIE)?.value;
  if (token) sessions.delete(token);
  cookies.delete(SESSION_COOKIE, { path: '/' });
  cookies.delete(HINT_COOKIE, { path: '/' });
}

/** Resolve the current user from the session cookie, or null. */
export function currentUser(cookies: AstroCookies): User | null {
  const token = cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const entry = sessions.get(token);
  if (!entry || entry.expiresAt < Date.now()) {
    if (token) sessions.delete(token);
    return null;
  }
  const user = users.get(entry.userId);
  if (!user || !user.active) return null;
  return user;
}

export const DEMO_CREDENTIALS = [
  { role: 'Admin', email: 'admin@mcaheart.com', password: 'admin1234' },
  { role: 'Member', email: 'member@mcaheart.com', password: 'member1234' },
];
