import type { APIRoute } from 'astro';
import { personOnProject } from '../../../../lib/pipeline-scope';
import { stagesFor } from '../../../../lib/lifecycle.mjs';

// Stages that are not a step on the usual path (as on the paper's own page).
const OFF_PATH: Record<string, string[]> = {
  conference: ['rejected', 'not_sent'],
  journal: ['halted', 'rejected_comments', 'rejected_no_comments'],
};

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

/** Read-only detail bundle for the slide-in panel. Members only get their own papers. */
export const GET: APIRoute = async ({ params, locals }) => {
  const { supabase, person } = locals;
  const id = params.id!;

  const { data: p } = await supabase.from('project_list').select('*').eq('id', id).maybeSingle();
  if (!p) return json({ error: 'No such project.' }, 404);
  if (!personOnProject(p, person)) return json({ error: 'Not your project.' }, 403);

  const team: string[] = p.team_member_ids ?? [];
  const ids = [p.lead_id, p.analyst_id, p.colead_id, p.presenter_id, p.corresponding_id, ...team].filter(Boolean);

  const [peopleRes, confRes, jrnlRes, histRes, asgRes] = await Promise.all([
    ids.length
      ? supabase.from('people').select('id,full_name').in('id', ids)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    supabase
      .from('conference_attempts')
      .select('outcome,submitted_on,conference:conferences(name)')
      .eq('project_id', id)
      .order('submitted_on', { ascending: false })
      .order('id', { ascending: false }),
    supabase
      .from('journal_attempts')
      .select('journal,outcome,revision_round,submitted_on')
      .eq('project_id', id)
      .order('submitted_on', { ascending: false })
      .order('id', { ascending: false }),
    supabase
      .from('project_history')
      .select('at,label,actor,detail')
      .eq('project_id', id)
      .order('at', { ascending: false })
      .limit(40),
    // Roles of people put on the paper (only returned to admins and the lead).
    supabase.from('assignments').select('person_id,role,done_at').eq('project_id', id),
  ]);
  const roleOf = new Map<string, string[]>();
  for (const a of (asgRes.error ? [] : asgRes.data ?? []) as any[]) roleOf.set(a.person_id, [...(roleOf.get(a.person_id) ?? []), a.role ?? 'General help']);

  const who = new Map((peopleRes.data ?? []).map((r: any) => [r.id, r.full_name]));

  return json({
    id: p.id,
    ref: p.ref,
    title: p.title,
    phase: p.phase,
    stage_label: p.stage_label,
    study_type: p.study_type,
    current_conference: p.current_conference,
    current_journal: p.current_journal,
    parked: p.parked,
    archived_at: p.archived_at,
    archive_reason: p.archive_reason,
    days_in_stage: p.days_in_stage,
    days_overdue: p.days_overdue,
    next_target: p.next_target,
    created_at: p.created_at,
    manuscript_url: p.manuscript_url,
    people: {
      lead: who.get(p.lead_id) ?? null,
      colead: who.get(p.colead_id) ?? null,
      analyst: who.get(p.analyst_id) ?? null,
      presenter: who.get(p.presenter_id) ?? null,
      corresponding: who.get(p.corresponding_id) ?? null,
    },
    team: team.filter((t) => ![p.lead_id, p.analyst_id, p.colead_id, p.presenter_id, p.corresponding_id].includes(t))
      .map((t) => ({ name: who.get(t) ?? 'Member', roles: roleOf.get(t) ?? [] })),
    stage: p.stage,
    steps: stagesFor(p.phase)
      .filter((st: any) => !(OFF_PATH[p.phase] ?? []).includes(st.code))
      .map((st: any) => ({ code: st.code, label: String(st.label).replace(/^\s*\d+\s*\/\s*\d+\s*/, '') })),
    conference_attempts: (confRes.data ?? []).map((a: any) => ({
      name: a.conference?.name ?? null,
      outcome: a.outcome,
      submitted_on: a.submitted_on,
    })),
    journal_attempts: (jrnlRes.data ?? []).map((a: any) => ({
      journal: a.journal,
      outcome: a.outcome,
      revision_round: a.revision_round,
      submitted_on: a.submitted_on,
    })),
    // Same wording as the paper's own page: a corrected label, the system note, or the standard label.
    history: (histRes.data ?? [])
      .map((h: any) => ({ at: h.at, label: h.detail?.label_override || h.detail?.system || h.label, actor: h.actor }))
      .filter((h: any) => h.label),
  });
};
