import type { APIRoute } from 'astro';
import { isDocLink, DOC_LINK_HINT } from '../../../../lib/doc-links';

export const prerender = false;

/** A person on the project sets (or clears) their manuscript draft link. */
export const POST: APIRoute = async ({ params, request, locals, redirect }) => {
  const { supabase } = locals;
  const id = params.id!;
  const back = `/pipeline/projects/${id}`;

  const form = await request.formData();
  const link = String(form.get('link') ?? '').trim();
  if (link && !isDocLink(link)) {
    return redirect(`${back}?err=${encodeURIComponent(DOC_LINK_HINT)}`);
  }

  const { error } = await supabase.rpc('set_manuscript_link', { p_project: id, p_url: link || null });
  if (error) return redirect(`${back}?err=${encodeURIComponent(error.message)}`);
  return redirect(`${back}?ok=${encodeURIComponent(link ? 'Manuscript link saved.' : 'Manuscript link cleared.')}`);
};
