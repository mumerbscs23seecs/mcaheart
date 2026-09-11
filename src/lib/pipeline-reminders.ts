/**
 * The Supabase pipeline's manuscript-stagnation sweep. Separate from the
 * in-memory reminders.ts (that one works the demo submissions store).
 *
 * An Ongoing (manuscript-phase) project whose stage hasn't changed:
 *   7 days   → nudge the member
 *   12 days  → nudge the member + copy the coordinators
 *   20 days  → member + coordinators, and flag the project for reassignment
 *
 * Any stage change resets the clock (a BEFORE UPDATE trigger on projects does
 * this - see mca-pipeline/links-reminders.sql). Each level fires at most once.
 */
import { supabaseAdmin } from './supabase';
import { deliverPipelineReminder } from './pipeline-mailer';

const REAL = (e: string | null | undefined) => !!e && !e.endsWith('@import.invalid');
const SITE = (import.meta.env.SITE_URL as string | undefined) ?? 'https://www.mcaheart.com';

const STEP: Record<number, 'nudge' | 'escalation' | 'final'> = { 1: 'nudge', 2: 'escalation', 3: 'final' };

export interface PipelineSweepResult {
  checked: number;
  sent: { ref: string; level: number; recipients: string[] }[];
  flagged: string[];
  error?: string;
}

export async function sweepPipelineReminders(dryRun = false): Promise<PipelineSweepResult> {
  let db;
  try {
    db = supabaseAdmin();
  } catch {
    return { checked: 0, sent: [], flagged: [], error: 'no service key' };
  }

  const { data: rows, error } = await db
    .from('project_list')
    .select('id,ref,title,stage_label,days_in_stage,reminder_level,lead_id,colead_id,analyst_id')
    .eq('phase', 'manuscript')
    .is('archived_at', null)
    .eq('parked', false)
    .gte('days_in_stage', 7);

  if (error) return { checked: 0, sent: [], flagged: [], error: error.message };

  const admins = (
    (await db.from('people').select('email').eq('role', 'admin').eq('active', true)).data ?? []
  )
    .map((a: any) => a.email)
    .filter(REAL);

  const sent: PipelineSweepResult['sent'] = [];
  const flagged: string[] = [];

  for (const r of rows ?? []) {
    const d: number = r.days_in_stage ?? 0;
    const level: number = r.reminder_level ?? 0;
    let target = 0;
    if (d >= 20 && level < 3) target = 3;
    else if (d >= 12 && level < 2) target = 2;
    else if (d >= 7 && level < 1) target = 1;
    if (!target) continue;

    const memberIds = [r.lead_id, r.colead_id, r.analyst_id].filter(Boolean);
    const memberEmails = (
      memberIds.length ? (await db.from('people').select('email').in('id', memberIds)).data ?? [] : []
    )
      .map((p: any) => p.email)
      .filter(REAL);

    const to = [...new Set([...memberEmails, ...(target >= 2 ? admins : [])])];
    sent.push({ ref: r.ref, level: target, recipients: to });

    if (dryRun) continue;

    if (to.length) {
      await deliverPipelineReminder({
        to,
        stage: STEP[target],
        projectTitle: r.title,
        ref: r.ref,
        daysIdle: d,
        currentStage: r.stage_label ?? 'in progress',
        link: `${SITE}/pipeline/projects/${r.id}`,
      }).catch(() => {});
    }

    const patch: Record<string, unknown> = {
      reminder_level: target,
      reminder_at: new Date().toISOString(),
    };
    if (target === 3) {
      patch.needs_reassignment = true;
      flagged.push(r.ref);
    }
    await db.from('projects').update(patch).eq('id', r.id);
    await db.from('events').insert({
      project_id: r.id,
      actor_id: null,
      kind: 'reminder',
      detail: { level: STEP[target], days: d },
    });
  }

  return { checked: (rows ?? []).length, sent, flagged };
}
