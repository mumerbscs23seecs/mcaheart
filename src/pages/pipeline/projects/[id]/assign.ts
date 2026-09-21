import type { APIRoute } from 'astro';

export const prerender = false;

/**
 * Admin sets who's on a project - lead, co-lead, analyst, presenter,
 * corresponding author. This is also how an analyst gets member-portal
 * access to a paper: scopeProjects() (pipeline-scope.ts) already grants
 * a person visibility into any project where they sit in one of these five
 * columns, so pointing analyst_id at someone here is the whole mechanism -
 * nothing else has to change for them to see it under "My papers".
 */
export const POST: APIRoute = async ({ params, request, locals, redirect }) => {
  const { supabase, person } = locals;
  const id = params.id!;
  const back = `/pipeline/projects/${id}`;

  if (person.role !== 'admin') return redirect(`${back}?err=${encodeURIComponent('Admins only.')}`);

  const form = await request.formData();
  const pick = (name: string) => String(form.get(name) ?? '').trim() || null;

  const { error } = await supabase.rpc('assign_people', {
    p_project: id,
    p_lead_id: pick('lead_id'),
    p_colead_id: pick('colead_id'),
    p_analyst_id: pick('analyst_id'),
    p_presenter_id: pick('presenter_id'),
    p_corresponding_id: pick('corresponding_id'),
  });
  if (error) return redirect(`${back}?err=${encodeURIComponent(error.message)}`);
  return redirect(`${back}?ok=${encodeURIComponent('People updated.')}`);
};
