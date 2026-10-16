/**
 * Conference numbers with an admin's hand-entered values applied
 * (mca-pipeline/add-conference-stat-overrides.sql). A set value replaces the
 * live count from conference_scorecard; acceptance is then worked out from
 * the numbers shown. Used by a conference's page, the Conferences list and
 * the dashboard, so all three always agree.
 */
import { supabaseAdmin } from './supabase';

export type Overrides = { submitted: number | null; accepted: number | null; rejected: number | null };
export type Stats = { submitted: number; accepted: number; rejected: number; accept_pct: number | null; edited: boolean };

/** Every conference's hand-entered values, by conference id. `ready` is false
 *  until the SQL above has been run (the columns don't exist yet). */
export async function loadOverrides(): Promise<{ ready: boolean; byId: Map<string, Overrides> }> {
  const { data, error } = await supabaseAdmin()
    .from('conferences')
    .select('id,submitted_override,accepted_override,rejected_override');
  if (error) return { ready: false, byId: new Map() };
  return {
    ready: true,
    byId: new Map(
      (data ?? []).map((r: any) => [
        r.id,
        { submitted: r.submitted_override, accepted: r.accepted_override, rejected: r.rejected_override },
      ]),
    ),
  };
}

/** Live scorecard numbers with any hand-entered ones applied. */
export function applyOverrides(live: any, o?: Overrides): Stats {
  const base = {
    submitted: Number(live?.submitted ?? 0),
    accepted: Number(live?.accepted ?? 0),
    rejected: Number(live?.rejected ?? 0),
  };
  const edited = !!o && (o.submitted != null || o.accepted != null || o.rejected != null);
  if (!edited) return { ...base, accept_pct: live?.accept_pct ?? null, edited: false };
  const s = {
    submitted: o!.submitted ?? base.submitted,
    accepted: o!.accepted ?? base.accepted,
    rejected: o!.rejected ?? base.rejected,
  };
  const decided = s.accepted + s.rejected;
  return { ...s, accept_pct: decided ? Math.round((1000 * s.accepted) / decided) / 10 : null, edited: true };
}

/** Save (or, with nulls, clear) a conference's hand-entered values. */
export async function saveOverrides(id: string, o: Overrides): Promise<string | null> {
  const { error } = await supabaseAdmin()
    .from('conferences')
    .update({ submitted_override: o.submitted, accepted_override: o.accepted, rejected_override: o.rejected })
    .eq('id', id);
  return error ? error.message : null;
}
