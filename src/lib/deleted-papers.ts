/**
 * Admin-only "Delete" action (add-team-members-and-trash.sql: projects.
 * deleted_at/deleted_by/deleted_reason + set_project_deleted()). Like the
 * "hide" toggle (hidden-papers.ts), this is a pure visibility flag that
 * drops a paper out of Conferences / Ongoing / Submissions / Published -
 * but unlike hide, it's a one-way clock: purgeDeletedProjects() hard-deletes
 * anything still deleted 60 days after deleted_at. Restoring before then
 * (from /admin/deleted) just clears the column.
 */
import { supabaseAdmin } from './supabase';

const TRASH_DAYS = 60;

export async function deletedProjectCount(): Promise<number> {
  const { count } = await supabaseAdmin()
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .not('deleted_at', 'is', null);
  return count ?? 0;
}

export interface DeletedProject {
  id: string;
  ref: string;
  title: string;
  full_title: string | null;
  phase: string;
  stage_label: string;
  deleted_at: string;
  deleted_reason: string | null;
  deleted_by_name: string | null;
}

export async function listDeletedProjects(): Promise<DeletedProject[]> {
  const { data, error } = await supabaseAdmin()
    .from('project_list')
    .select('id,ref,title,full_title,phase,stage_label,deleted_at,deleted_reason,deleted_by')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });
  if (error) throw error;

  const byIds = [...new Set((data ?? []).map((r: any) => r.deleted_by).filter(Boolean))];
  const names = new Map<string, string>();
  if (byIds.length) {
    const { data: people } = await supabaseAdmin().from('people').select('id,full_name').in('id', byIds);
    for (const p of people ?? []) names.set(p.id, p.full_name);
  }

  return (data ?? []).map((r: any) => ({ ...r, deleted_by_name: names.get(r.deleted_by) ?? null }));
}

/** Hard-deletes anything that's been in the trash 60+ days. Run from the cron sweep. */
export async function purgeDeletedProjects(): Promise<{ purged: number; refs: string[] }> {
  const cutoff = new Date(Date.now() - TRASH_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const sb = supabaseAdmin();
  const { data: due } = await sb.from('projects').select('id,ref').lt('deleted_at', cutoff).not('deleted_at', 'is', null);
  if (!due || due.length === 0) return { purged: 0, refs: [] };

  const { error } = await sb.from('projects').delete().in('id', due.map((p: any) => p.id));
  if (error) throw error;
  return { purged: due.length, refs: due.map((p: any) => p.ref) };
}
