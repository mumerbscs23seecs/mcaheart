import type { APIRoute } from 'astro';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

/** Board drag-and-drop: assign or unassign a mentee without reloading the page.
 *  assign_mentee / unassign_mentee re-check the caller is an admin themselves. */
export const POST: APIRoute = async ({ request, locals }) => {
  const { supabase, person } = locals as any;
  if (!supabase || !person) return json({ ok: false, error: 'Please sign in again.' }, 401);
  if (person.role !== 'admin') return json({ ok: false, error: 'Only an admin can assign mentees.' }, 403);
  const form = await request.formData();
  const action = String(form.get('action') ?? '');
  const projectId = String(form.get('projectId') ?? '');
  const personId = String(form.get('personId') ?? '');
  if (!projectId || !personId) return json({ ok: false, error: 'Missing project or mentee.' }, 400);
  if (action !== 'assign' && action !== 'unassign') return json({ ok: false, error: 'Unknown action.' }, 400);
  const { error } = await supabase.rpc(action === 'assign' ? 'assign_mentee' : 'unassign_mentee', {
    p_project: projectId,
    p_person: personId,
  });
  if (error) return json({ ok: false, error: error.message }, 400);
  return json({ ok: true });
};
