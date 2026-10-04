/**
 * Admin-only "hide this paper" visibility toggle (mca-pipeline's
 * add-order-and-hide.sql: projects.hidden_at/hidden_by/hidden_reason +
 * set_project_hidden()). Hiding a project drops it out of Conferences /
 * Ongoing / Submissions / Published and the tab counts, without touching its
 * phase/stage - it's a pure display-layer flag, not a lifecycle state.
 */
import { supabaseAdmin } from './supabase';

export async function hiddenProjectCount(): Promise<number> {
  const { count } = await supabaseAdmin()
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .not('hidden_at', 'is', null);
  return count ?? 0;
}

export interface HiddenProject {
  id: string;
  ref: string;
  title: string;
  full_title: string | null;
  phase: string;
  stage_label: string;
  hidden_at: string;
  hidden_reason: string | null;
  hidden_by_name: string | null;
}

export async function listHiddenProjects(): Promise<HiddenProject[]> {
  const { data, error } = await supabaseAdmin()
    .from('project_list')
    .select('id,ref,title,full_title,phase,stage_label,hidden_at,hidden_reason,hidden_by')
    .not('hidden_at', 'is', null)
    .order('hidden_at', { ascending: false });
  if (error) throw error;

  const byIds = [...new Set((data ?? []).map((r: any) => r.hidden_by).filter(Boolean))];
  const names = new Map<string, string>();
  if (byIds.length) {
    const { data: people } = await supabaseAdmin().from('people').select('id,full_name').in('id', byIds);
    for (const p of people ?? []) names.set(p.id, p.full_name);
  }

  return (data ?? []).map((r: any) => ({ ...r, hidden_by_name: names.get(r.hidden_by) ?? null }));
}
