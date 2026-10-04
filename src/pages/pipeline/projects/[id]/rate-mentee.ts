import type { APIRoute } from 'astro';

export const prerender = false;

/**
 * Lead/colead (or admin) rates a mentee once the project is complete.
 * No admin gate here, no email - rate_mentee() itself checks the caller is
 * the lead/colead/admin and that the project is actually done.
 */
export const POST: APIRoute = async ({ params, request, locals, redirect }) => {
  const { supabase } = locals;
  const projectId = params.id!;
  const back = `/pipeline/projects/${projectId}`;
  const to = (kind: 'ok' | 'err', msg: string) => redirect(`${back}?${kind}=${encodeURIComponent(msg)}`);

  const form = await request.formData();
  const personId = String(form.get('personId') ?? '');
  const rating = Number(form.get('rating') ?? '');
  const note = String(form.get('note') ?? '').trim() || null;

  if (!personId || !rating) return to('err', 'Choose a rating first.');

  const { error } = await supabase.rpc('rate_mentee', {
    p_project: projectId,
    p_person: personId,
    p_rating: rating,
    p_note: note,
  });
  if (error) return to('err', error.message);
  return to('ok', 'Rating submitted.');
};
