/**
 * "Pending tasks" - the open action items for the signed-in person, derived
 * live from existing state (no new table). Admins see approvals + new ideas +
 * new lab applications; members see their own stalled / overdue papers and any
 * recently declined request.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Person } from './pipeline-auth';
import { scopeProjects } from './pipeline-scope';
import { stagesFor } from './lifecycle.mjs';
import { listIdeas } from './ideas';
import { listApplications } from './applications';

export type TaskKind = 'approval' | 'idea' | 'application' | 'stale' | 'overdue' | 'declined';

export interface Task {
  id: string;
  kind: TaskKind;
  title: string;
  detail?: string;
  href: string;
  cta: string;
  when?: string | null;
  urgent?: boolean;
}

const DAY = 86_400_000;
const labelFor = (phase: string, code: string) =>
  stagesFor(phase).find((s: any) => s.code === code)?.label ?? code;

export async function getPipelineTasks(supabase: SupabaseClient, person: Person): Promise<Task[]> {
  return person.role === 'admin' ? adminTasks(supabase) : memberTasks(supabase, person);
}

async function adminTasks(supabase: SupabaseClient): Promise<Task[]> {
  const tasks: Task[] = [];

  // 1. status-change requests awaiting approve / decline
  const { data: reqs, error: reqErr } = await supabase
    .from('stage_change_requests')
    .select('id,project_id,requested_by,to_stage,from_phase,note,created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (reqErr) console.warn('[tasks] stage_change_requests unavailable - run requests.sql:', reqErr.message);

  if (reqs && reqs.length) {
    const projIds = [...new Set(reqs.map((r: any) => r.project_id))];
    const whoIds = [...new Set(reqs.map((r: any) => r.requested_by))];
    const [{ data: projs }, { data: ppl }] = await Promise.all([
      supabase.from('projects').select('id,ref,title').in('id', projIds),
      supabase.from('people').select('id,full_name').in('id', whoIds),
    ]);
    const proj = new Map((projs ?? []).map((p: any) => [p.id, p]));
    const name = new Map((ppl ?? []).map((p: any) => [p.id, p.full_name]));
    for (const r of reqs as any[]) {
      const p = proj.get(r.project_id);
      tasks.push({
        id: 'req-' + r.id,
        kind: 'approval',
        title: `Approve or decline - ${name.get(r.requested_by) ?? 'a member'} wants “${labelFor(r.from_phase, r.to_stage)}”`,
        detail: [p?.ref, p?.title].filter(Boolean).join(' · ') + (r.note ? ` - “${r.note}”` : ''),
        href: `/pipeline/projects/${r.project_id}`,
        cta: 'Review',
        when: r.created_at,
        urgent: true,
      });
    }
  }

  // 2. new research ideas awaiting review
  for (const i of listIdeas().filter((x) => x.status === 'pending')) {
    tasks.push({
      id: 'idea-' + i.id,
      kind: 'idea',
      title: `New idea to review - ${i.title}`,
      detail: `Submitted by ${i.leadName}`,
      href: '/admin/ideas',
      cta: 'Open ideas',
      when: new Date(i.submittedAt).toISOString(),
    });
  }

  // 3. new lab recruitment applications awaiting review
  for (const a of listApplications().filter((x) => x.status === 'pending')) {
    tasks.push({
      id: 'app-' + a.id,
      kind: 'application',
      title: `New lab application - ${a.name}`,
      detail: [a.jobStatus, a.expertise].filter(Boolean).join(' · '),
      href: '/admin/applications',
      cta: 'Open applications',
      when: new Date(a.submittedAt).toISOString(),
    });
  }

  return sortTasks(tasks);
}

async function memberTasks(supabase: SupabaseClient, person: Person): Promise<Task[]> {
  const tasks: Task[] = [];

  let q = supabase
    .from('project_list')
    .select('id,ref,title,phase,stage_label,days_in_stage,days_overdue,next_target')
    .is('archived_at', null);
  q = scopeProjects(q, person);
  const { data: mine } = await q;

  for (const p of (mine ?? []) as any[]) {
    if (['conference', 'manuscript'].includes(p.phase) && (p.days_in_stage ?? 0) >= 21) {
      tasks.push({
        id: 'stale-' + p.id,
        kind: 'stale',
        title: `No update in ${p.days_in_stage} days - ${p.ref}`,
        detail: `Still “${p.stage_label}”. Send the coordinator a status.`,
        href: `/pipeline/projects/${p.id}`,
        cta: 'Request update',
        urgent: (p.days_in_stage ?? 0) >= 35,
      });
    }
    if ((p.days_overdue ?? 0) > 0) {
      tasks.push({
        id: 'due-' + p.id,
        kind: 'overdue',
        title: `Past its target - ${p.ref}`,
        detail: p.next_target ? `Target was ${p.next_target}.` : 'Target date passed.',
        href: `/pipeline/projects/${p.id}`,
        cta: 'Open',
        urgent: true,
      });
    }
  }

  const since = new Date(Date.now() - 14 * DAY).toISOString();
  const { data: declined } = await supabase
    .from('stage_change_requests')
    .select('id,project_id,to_stage,from_phase,decide_note,decided_at')
    .eq('requested_by', person.id)
    .eq('status', 'declined')
    .gte('decided_at', since)
    .order('decided_at', { ascending: false });

  if (declined && declined.length) {
    const ids = [...new Set(declined.map((d: any) => d.project_id))];
    const { data: projs } = await supabase.from('projects').select('id,ref').in('id', ids);
    const ref = new Map((projs ?? []).map((p: any) => [p.id, p.ref]));
    for (const d of declined as any[]) {
      tasks.push({
        id: 'dec-' + d.id,
        kind: 'declined',
        title: `Request declined - ${ref.get(d.project_id) ?? 'a paper'} → “${labelFor(d.from_phase, d.to_stage)}”`,
        detail: d.decide_note ? `Coordinator: “${d.decide_note}”` : 'Re-request once there is real progress.',
        href: `/pipeline/projects/${d.project_id}`,
        cta: 'Open',
        when: d.decided_at,
      });
    }
  }

  return sortTasks(tasks);
}

function sortTasks(tasks: Task[]): Task[] {
  return tasks.sort((a, b) => {
    if (!!a.urgent !== !!b.urgent) return a.urgent ? -1 : 1;
    return (b.when ?? '').localeCompare(a.when ?? '');
  });
}
