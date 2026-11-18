import type { APIRoute } from 'astro';
import { emailAppointment, MAIL_NOTE, analysisSkillFor } from '../../../../lib/appoint';
import { supabaseAdmin } from '../../../../lib/supabase';
import { notSetUp } from '../../../../lib/help';

export const prerender = false;

/**
 * Help on a paper, from its page:
 *   appoint    admin puts someone on the paper in a role (they and the lead are emailed)
 *   unappoint  admin takes an appointment back
 *   finish     the helper marks their part done, with the AI disclosure
 * The database functions check who is allowed to do each one.
 */
export const POST: APIRoute = async ({ params, request, locals, redirect, url }) => {
  const { supabase, person } = locals;
  const projectId = params.id!;
  const form = await request.formData();
  // The Analysis list sends people back to itself.
  const ret = String(form.get('return') ?? '');
  const back = (kind: 'ok' | 'err', msg: string, hash = '#team') =>
    ret.startsWith('/pipeline/analysis')
      ? redirect(`${ret}${ret.includes('?') ? '&' : '?'}${kind}=${encodeURIComponent(msg)}`, 303)
      : redirect(`/pipeline/projects/${projectId}?${kind}=${encodeURIComponent(msg)}${hash}`, 303);
  const action = String(form.get('action') ?? '');
  const SQL_MSG = 'This needs add-help-and-learning.sql. Run it in the Supabase SQL editor first.';

  if (action === 'appoint') {
    const personId = String(form.get('person') ?? '');
    const requestId = String(form.get('request') ?? '') || null;
    const role = requestId ? null : String(form.get('role') ?? '') || null;
    if (!personId) return back('err', 'Choose who to add.');
    const { error } = await supabase.rpc('appoint', { p_project: projectId, p_person: personId, p_role: role, p_request: requestId });
    if (error) return back('err', notSetUp(error) ? SQL_MSG : error.message);
    const mail = await emailAppointment(url.origin, projectId, personId);
    return back('ok', 'Added.' + MAIL_NOTE[mail]);
  }

  if (action === 'analyst' || action === 'analyst-remove') {
    const personId = action === 'analyst' ? String(form.get('person') ?? '') : null;
    if (action === 'analyst' && !personId) return back('err', 'Choose the new analyst.', '');
    let { error } = await supabase.rpc('set_analyst', { p_project: projectId, p_person: personId });
    const db = supabaseAdmin();
    const { data: proj } = await db.from('projects').select('ref,title,lead_id,analyst_id,study_type,archived_at').eq('id', projectId).maybeSingle();
    if (error && (notSetUp(error) || /set_analyst/.test(error.message))) {
      // Before add-help-and-learning.sql: the same rules, checked here.
      const isAdmin = person.role === 'admin';
      if (!proj) return back('err', 'Paper not found.', '');
      if (!isAdmin && (proj.lead_id !== person.id || proj.archived_at)) return back('err', 'Only the first author or an admin can change the analyst.', '');
      if (!isAdmin && !personId) return back('err', 'Only an admin can remove the analyst.', '');
      ({ error } = await db.from('projects').update({ analyst_id: personId }).eq('id', projectId));
      if (!error && personId !== proj.analyst_id) {
        const ids = [proj.analyst_id, personId].filter(Boolean) as string[];
        const { data: ppl } = await db.from('people').select('id,full_name').in('id', ids);
        const nm = (id: string | null) => (ppl ?? []).find((r: any) => r.id === id)?.full_name ?? null;
        const detail = personId ? `Analyst: ${nm(proj.analyst_id) ? `${nm(proj.analyst_id)} -> ` : ''}${nm(personId)}` : 'Analyst removed';
        await db.from('events').insert({ project_id: projectId, actor_id: person.id, kind: 'assign', detail: { system: detail } });
        if (personId) {
          await db.from('notifications').insert({
            recipient_id: personId, kind: 'assigned', title: `You are the analyst on ${proj.ref}`, body: proj.title,
            link: `/pipeline/projects/${projectId}`, project_id: projectId,
          });
        }
      }
    }
    if (error) return back('err', error.message, '');
    if (!personId) return back('ok', 'Analyst removed.', '');
    const mail = await emailAppointment(url.origin, projectId, personId, analysisSkillFor(proj?.study_type) ?? 'Analysis');
    return back('ok', 'Analyst changed.' + MAIL_NOTE[mail], '');
  }

  if (action === 'unappoint') {
    const { error } = await supabase.rpc('unappoint', { p_assignment: String(form.get('assignment') ?? '') });
    if (error) return back('err', notSetUp(error) ? SQL_MSG : error.message);
    return back('ok', 'Taken off that role.');
  }

  if (action === 'finish') {
    const aiUse = String(form.get('ai_use') ?? '');
    const proof = String(form.get('ai_proofread') ?? '');
    const { error } = await supabase.rpc('finish_assignment', {
      p_assignment: String(form.get('assignment') ?? ''),
      p_ai_use: aiUse || null,
      p_ai_parts: String(form.get('ai_parts') ?? '').trim() || null,
      p_proofread: proof === 'yes' ? true : proof === 'no' ? false : null,
      p_note: String(form.get('note') ?? '').trim() || null,
    });
    if (error) return back('err', notSetUp(error) ? SQL_MSG : error.message, '#mypart');
    return back('ok', 'Thank you. The first author has been told your part is done.', '');
  }

  return back('err', 'Unknown action.');
};
