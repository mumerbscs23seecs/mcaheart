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
import { roleLabel, longDay, daysLeft } from './help';

export type TaskKind = 'approval' | 'idea' | 'application' | 'stale' | 'overdue' | 'declined' | 'mypart' | 'review' | 'help';

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
  // This runs on every /pipeline/* page load (PipelineLayout's Tasks badge),
  // not just /admin - a thrown error here (e.g. the forms-storage migration
  // not run yet) must not take down the whole pipeline area over one badge.
  try {
    for (const i of (await listIdeas()).filter((x) => x.status === 'pending')) {
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
  } catch (err) {
    console.warn('[tasks] ideas unavailable - run add-forms-storage.sql:', err instanceof Error ? err.message : err);
  }

  // 3. new lab recruitment applications awaiting review
  try {
    for (const a of (await listApplications()).filter((x) => x.status === 'pending')) {
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
  } catch (err) {
    console.warn('[tasks] applications unavailable - run add-forms-storage.sql:', err instanceof Error ? err.message : err);
  }

  // 4. help requests from first authors, still open (add-help-and-learning.sql)
  const { data: helps } = await supabase
    .from('help_requests')
    .select('id,project_id,role,spots,created_at,requested_by')
    .is('closed_at', null)
    .order('created_at');
  if (helps && helps.length) {
    const { data: filled } = await supabase.from('assignments').select('request_id').in('request_id', helps.map((h: any) => h.id));
    const n = new Map<string, number>();
    for (const f of filled ?? []) n.set((f as any).request_id, (n.get((f as any).request_id) ?? 0) + 1);
    const { data: projs } = await supabase.from('projects').select('id,ref').in('id', [...new Set(helps.map((h: any) => h.project_id))]);
    const ref = new Map((projs ?? []).map((p: any) => [p.id, p.ref]));
    for (const h of helps as any[]) {
      tasks.push({
        id: 'help-' + h.id,
        kind: 'help',
        title: `Appoint ${h.spots - (n.get(h.id) ?? 0)} for ${roleLabel(h.role).toLowerCase()} - ${ref.get(h.project_id) ?? 'a paper'}`,
        detail: `${n.get(h.id) ?? 0} of ${h.spots} places filled`,
        href: '/admin/mentees?view=help',
        cta: 'Appoint',
        when: h.created_at,
      });
    }
  }

  return sortTasks(tasks);
}

/** Parts the member was appointed to, and helpers waiting for the lead's review. */
async function helpTasks(supabase: SupabaseClient, person: Person): Promise<Task[]> {
  const tasks: Task[] = [];
  const { data: mineA, error } = await supabase
    .from('assignments')
    .select('id,project_id,person_id,role,due_on,done_at')
    .order('due_on');
  if (error || !mineA?.length) return tasks;
  const projIds = [...new Set(mineA.map((a: any) => a.project_id))];
  const { data: projs } = await supabase.from('projects').select('id,ref,lead_id,colead_id,archived_at').in('id', projIds);
  const proj = new Map((projs ?? []).map((p: any) => [p.id, p]));
  for (const a of mineA as any[]) {
    const p = proj.get(a.project_id);
    if (!p || p.archived_at || a.person_id !== person.id || a.done_at) continue;
    const left = daysLeft(a.due_on);
    tasks.push({
      id: 'part-' + a.id,
      kind: 'mypart',
      title: `Your part on ${p.ref}: ${roleLabel(a.role)}`,
      detail: left < 0 ? `Was due ${longDay(a.due_on)}, ${-left} day${left === -1 ? '' : 's'} ago.` : `Due ${longDay(a.due_on)}${left === 0 ? ' (today)' : ''}.`,
      href: `/pipeline/projects/${a.project_id}#mypart`,
      cta: 'Mark done',
      when: a.due_on,
      urgent: left <= 2,
    });
  }
  // Leads: finished parts they haven't reviewed yet.
  const done = (mineA as any[]).filter((a) => a.done_at && a.person_id !== person.id && [proj.get(a.project_id)?.lead_id, proj.get(a.project_id)?.colead_id].includes(person.id));
  if (done.length) {
    const [{ data: revs }, { data: ppl }] = await Promise.all([
      supabase.from('mentee_reviews').select('project_id,person_id').eq('reviewer_id', person.id),
      supabase.from('people').select('id,full_name').in('id', [...new Set(done.map((a) => a.person_id))]),
    ]);
    const reviewed = new Set((revs ?? []).map((r: any) => `${r.project_id}:${r.person_id}`));
    const name = new Map((ppl ?? []).map((r: any) => [r.id, r.full_name]));
    for (const a of done) {
      if (reviewed.has(`${a.project_id}:${a.person_id}`)) continue;
      tasks.push({
        id: 'rev-' + a.id,
        kind: 'review',
        title: `Review ${name.get(a.person_id) ?? 'a helper'}'s work on ${proj.get(a.project_id)?.ref}`,
        detail: `${roleLabel(a.role)}, finished. Your review is private.`,
        href: `/pipeline/projects/${a.project_id}#team`,
        cta: 'Add a review',
        when: a.done_at,
      });
    }
  }
  return tasks;
}

async function memberTasks(supabase: SupabaseClient, person: Person): Promise<Task[]> {
  const tasks: Task[] = [];

  let q = supabase
    .from('project_list')
    .select('id,ref,title,phase,stage_label,days_in_stage,days_overdue,next_target')
    .is('archived_at', null)
    .is('hidden_at', null);
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

  tasks.push(...(await helpTasks(supabase, person)));
  return sortTasks(tasks);
}

function sortTasks(tasks: Task[]): Task[] {
  return tasks.sort((a, b) => {
    if (!!a.urgent !== !!b.urgent) return a.urgent ? -1 : 1;
    return (b.when ?? '').localeCompare(a.when ?? '');
  });
}
