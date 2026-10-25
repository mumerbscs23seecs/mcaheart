import { supabaseAdmin } from './supabase';

/**
 * Each paper's research fellow (add-research-fellow.sql). Empty means
 * Burhan, so new papers land in his group; Submissions lists Burhan's papers
 * first, then Jawad's.
 */
export const FELLOWS = [
  { key: 'burhan', label: 'Muhammad Burhan' },
  { key: 'jawad', label: 'Jawad Basit' },
] as const;
export type Fellow = (typeof FELLOWS)[number]['key'];

/** id -> fellow for the given papers. Before the SQL is run, everyone is Burhan. */
export async function fellowsFor(ids: string[]): Promise<Map<string, Fellow>> {
  const out = new Map<string, Fellow>();
  if (!ids.length) return out;
  const { data, error } = await supabaseAdmin().from('projects').select('id,research_fellow').in('id', ids);
  if (error) {
    console.warn('[research fellow] unavailable - run add-research-fellow.sql:', error.message);
    return out;
  }
  for (const r of data ?? []) out.set(r.id, r.research_fellow === 'jawad' ? 'jawad' : 'burhan');
  return out;
}

/** Burhan's papers first, then Jawad's, keeping the existing order inside each. */
export function sortByFellow<T extends { id: string }>(rows: T[], fellows: Map<string, Fellow>): T[] {
  const rank = (r: T) => (fellows.get(r.id) === 'jawad' ? 1 : 0);
  return rows.map((r, i) => ({ r, i })).sort((a, b) => rank(a.r) - rank(b.r) || a.i - b.i).map((x) => x.r);
}
