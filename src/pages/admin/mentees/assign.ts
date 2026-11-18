import type { APIRoute } from 'astro';
import { emailAppointment, MAIL_NOTE } from '../../../lib/appoint';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

/** The "Assign to projects" board: put someone on a project (or its empty
 *  analyst slot) or take them off, without reloading the page. The database
 *  functions re-check that the caller is an admin. */
export const POST: APIRoute = async ({ request, locals, url }) => {
  const { supabase, person } = locals as any;
  if (!supabase || !person) return json({ ok: false, error: 'Please sign in again.' }, 401);
  if (person.role !== 'admin') return json({ ok: false, error: 'Only an admin can put people on projects.' }, 403);
  const form = await request.formData();
  const action = String(form.get('action') ?? '');
  const projectId = String(form.get('projectId') ?? '');
  const personId = String(form.get('personId') ?? '');
  const slot = String(form.get('slot') ?? 'helper') === 'analyst' ? 'analyst' : 'helper';
  const requestId = String(form.get('requestId') ?? '') || null;
  if (!projectId || !personId) return json({ ok: false, error: 'Missing project or person.' }, 400);
  if (action !== 'assign' && action !== 'unassign') return json({ ok: false, error: 'Unknown action.' }, 400);

  // Help requests: appoint straight into a request (add-help-and-learning.sql).
  if (action === 'assign' && requestId) {
    const { error } = await supabase.rpc('appoint', { p_project: projectId, p_person: personId, p_role: null, p_request: requestId });
    if (error) return json({ ok: false, error: error.message }, 400);
    const mail = await emailAppointment(url.origin, projectId, personId);
    return json({ ok: true, as: 'appointed', mail: MAIL_NOTE[mail].trim() });
  }

  const role = String(form.get('role') ?? '') || null;
  let { data, error } = action === 'assign'
    ? await supabase.rpc('board_assign', { p_project: projectId, p_person: personId, p_slot: slot, p_role: role })
    : await supabase.rpc('board_unassign', { p_project: projectId, p_person: personId, p_slot: slot });
  // Before add-help-and-learning.sql, board_assign has no role.
  if (error && action === 'assign' && (error.code === 'PGRST202' || /p_role/.test(error.message ?? ''))) {
    ({ data, error } = await supabase.rpc('board_assign', { p_project: projectId, p_person: personId, p_slot: slot }));
  }
  if (!error) {
    const mail = action === 'assign' ? await emailAppointment(url.origin, projectId, personId) : 'none';
    return json({ ok: true, as: data ?? null, mail: MAIL_NOTE[mail].trim() });
  }

  // Before add-board-assign.sql is run, mentees can still be added the old way.
  const missing = error.code === 'PGRST202' || /board_(un)?assign/.test(error.message ?? '');
  if (!missing) return json({ ok: false, error: error.message }, 400);
  if (slot === 'analyst') return json({ ok: false, error: 'Filling the analyst slot needs add-board-assign.sql. Run it in the Supabase SQL editor first.' }, 400);
  const old = await supabase.rpc(action === 'assign' ? 'assign_mentee' : 'unassign_mentee', { p_project: projectId, p_person: personId });
  if (old.error) {
    const notMentee = /No such mentee/i.test(old.error.message ?? '');
    return json({ ok: false, error: notMentee ? 'Adding members who are not mentees needs add-board-assign.sql. Run it in the Supabase SQL editor first.' : old.error.message }, 400);
  }
  return json({ ok: true, as: 'mentee' });
};
