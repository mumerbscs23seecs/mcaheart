/**
 * The lab's journal list (Manage > Journals). Lives in the `journals` table
 * from mca-pipeline/add-journals.sql; until that has been run, the built-in
 * list in journal-links.ts is used, so nothing breaks before the SQL.
 *
 * Read with the service-role client (the list isn't private) and kept for a
 * minute, so the pages that show it don't each make a database trip.
 */
import { supabaseAdmin } from './supabase';
import { DEFAULT_JOURNALS, makeJournalHref } from './journal-links';

export type Journal = { id: string | null; name: string; url: string | null };

const TTL_MS = 60_000;
let cache: { at: number; list: Journal[]; fromDb: boolean } | null = null;

/** Every journal, A-Z. `fromDb` is false while the table doesn't exist yet. */
export async function listJournals(): Promise<{ list: Journal[]; fromDb: boolean }> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache;
  const { data, error } = await supabaseAdmin().from('journals').select('id,name,url').order('name');
  if (error) {
    // Table not created yet (or the database is unreachable): fall back to the
    // built-in list. Not cached, so the real list shows up as soon as it exists.
    return { list: DEFAULT_JOURNALS.map((j) => ({ id: null, ...j })), fromDb: false };
  }
  const list = (data ?? [])
    .map((r: any) => ({ id: r.id as string, name: r.name as string, url: (r.url as string | null) ?? null }))
    .sort((a, b) => a.name.localeCompare(b.name));
  cache = { at: Date.now(), list, fromDb: true };
  return cache;
}

/** Drop the cached list after a change, so the next page shows it. */
export function forgetJournals() {
  cache = null;
}

/** "Open journal site" link builder for the current list. */
export async function journalHrefFn() {
  const { list } = await listJournals();
  return makeJournalHref(list);
}
