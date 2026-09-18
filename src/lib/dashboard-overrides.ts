/**
 * Manual overrides for the three admin-dashboard headline tiles (Total
 * Submissions, Active in Pipeline, Published). In-memory only, same pattern
 * as ideas.ts / applications.ts - resets on a server restart.
 *
 * Why: those numbers are normally computed live from Supabase, but the admin
 * sometimes wants to show a different number (e.g. presenting to people
 * outside the real pipeline data). Setting an override doesn't touch any
 * project row - it only changes what the dashboard *displays*. Clearing it
 * goes straight back to the live count.
 */
import { audit } from './auth';

export type StatKey = 'total' | 'active' | 'published';
export const STAT_KEYS: StatKey[] = ['total', 'active', 'published'];

const overrides = new Map<StatKey, number>();

export function getOverride(key: StatKey): number | null {
  return overrides.has(key) ? overrides.get(key)! : null;
}

export function setOverride(key: StatKey, value: number, actor: string): void {
  overrides.set(key, value);
  audit(actor, 'overrode dashboard stat', key, String(value));
}

export function clearOverride(key: StatKey, actor: string): void {
  overrides.delete(key);
  audit(actor, 'cleared dashboard stat override', key);
}
