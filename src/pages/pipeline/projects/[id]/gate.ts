import type { APIRoute } from 'astro';
import { deliverTransition } from '../../../../lib/pipeline-mailer';

export const prerender = false;

const REAL = (e: string | null | undefined) => !!e && !e.endsWith('@import.invalid');

async function recipientsFor(supabase: any, ids: (string | null)[]) {
  const clean = [...new Set(ids.filter(Boolean))] as string[];
  if (!clean.length) return [];
  const { data } = await supabase.from('people').select('email').in('id', clean);
  return (data ?? []).map((r: any) => r.email).filter(REAL);
}

export const POST: APIRoute = async ({ params, request, locals, redirect, url }) => {
  const { supabase, person } = locals;
  const projectId = params.id!;
  const back = `/pipeline/projects/${projectId}`;
  if (person.role !== 'admin') return redirect(`${back}?err=${encodeURIComponent('Admins only.')}`);

  const form = await request.formData();
  const gate = String(form.get('gate') ?? '');
  const note = String(form.get('note') ?? '').trim() || undefined;

  const { data: p0 } = await supabase.from('projects').select('*').eq('id', projectId).maybeSingle();
  if (!p0) return redirect('/pipeline/conferences');

  let rpc: { fn: string; args: Record<string, unknown> };
  let mail: null | {
    template: Parameters<typeof deliverTransition>[0]['template'];
    venue?: string;
    to: (string | null)[];
  } = null;

  if (gate === '1') {
    const conference = String(form.get('conference') ?? '');
    rpc = { fn: 'gate1_send_to_conference', args: { p_project: projectId, p_conference: conference, p_recycled_from: null } };
    mail = { template: 'conference_assigned', venue: conference, to: [p0.lead_id, p0.analyst_id] };
  } else if (gate === '2') {
    const proceed = String(form.get('proceed') ?? 'yes') === 'yes';
    rpc = {
      fn: 'gate2_proceed',
      args: { p_project: projectId, p_proceed: proceed, p_archive_reason: proceed ? null : String(form.get('archive_reason') ?? 'other') },
    };
    if (proceed) mail = { template: 'proceeding_full_text', to: [p0.lead_id, p0.analyst_id] };
  } else if (gate === '3') {
    const journal = String(form.get('journal') ?? '');
    const murl = String(form.get('manuscript_url') ?? '').trim() || null;
    rpc = { fn: 'gate3_submit_to_journal', args: { p_project: projectId, p_journal: journal, p_url: murl } };
    mail = { template: 'submitted_to_journal', venue: journal, to: [p0.lead_id, p0.analyst_id] };
  } else if (gate === 'abstract') {
    const outcome = String(form.get('outcome') ?? '');
    const attempt = String(form.get('attempt') ?? '');
    rpc = { fn: 'record_abstract_outcome', args: { p_attempt: attempt, p_outcome: outcome, p_presenter: null } };
    if (outcome === 'accepted')
      mail = { template: 'abstract_accepted', venue: p0.current_conference ?? undefined, to: [p0.lead_id, p0.analyst_id, p0.presenter_id] };
  } else if (gate === 'stage') {
    const stage = String(form.get('stage') ?? '');
    const journal = String(form.get('journal') ?? '').trim();
    if (p0.phase === 'journal' && stage === 'submitted') {
      // A journal-phase "Submitted — technical check" also records which journal.
      if (!journal) return redirect(`${back}?err=${encodeURIComponent('Enter the journal name.')}`);
      rpc = { fn: 'set_submitted_journal', args: { p_project: projectId, p_journal: journal } };
    } else {
      rpc = { fn: 'advance_stage', args: { p_project: projectId, p_stage: stage } };
    }
  } else if (gate === 'request-decide') {
    const requestId = String(form.get('request') ?? '');
    const approve = String(form.get('approve') ?? '') === 'yes';
    rpc = { fn: 'decide_stage_change', args: { p_request: requestId, p_approve: approve, p_note: note ?? null } };
  } else {
    return redirect(`${back}?err=unknown+action`);
  }

  const { error } = await supabase.rpc(rpc.fn, rpc.args);
  if (error) return redirect(`${back}?err=${encodeURIComponent(error.message)}`);

  let emailNote = '';
  if (mail) {
    const to = await recipientsFor(supabase, mail.to);
    if (to.length) {
      const sent = await deliverTransition({
        to,
        template: mail.template,
        projectTitle: p0.title,
        ref: p0.ref,
        venue: mail.venue,
        actor: person.full_name,
        note,
        link: `${url.origin}${back}`,
      }).catch((e) => ({ ok: false, error: String(e) }));
      emailNote = sent.ok ? ` · emailed ${to.length}` : ' · email failed';
    } else {
      emailNote = ' · no recipients with a real email';
    }
  }

  return redirect(`${back}?ok=${encodeURIComponent('Done' + emailNote)}`);
};
