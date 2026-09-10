import type { APIRoute } from 'astro';
import { isDocLink, DOC_LINK_HINT } from '../../../../lib/doc-links';

export const prerender = false;

/** Member submits a status-change request for a conference / ongoing project. */
export const POST: APIRoute = async ({ params, request, locals, redirect }) => {
  const { supabase } = locals;
  const projectId = params.id!;
  const back = `/pipeline/projects/${projectId}`;

  const form = await request.formData();
  const stage = String(form.get('stage') ?? '').trim();
  const note = String(form.get('note') ?? '').trim() || null;
  const reviewUrl = String(form.get('review_url') ?? '').trim();
  if (!stage) return redirect(`${back}?err=${encodeURIComponent('Choose a status first.')}`);
  if (reviewUrl && !isDocLink(reviewUrl)) {
    return redirect(`${back}?err=${encodeURIComponent(DOC_LINK_HINT)}`);
  }

  const { error } = await supabase.rpc('request_stage_change', {
    p_project: projectId,
    p_stage: stage,
    p_note: note,
    p_review_url: reviewUrl || null,
  });
  if (error) return redirect(`${back}?err=${encodeURIComponent(error.message)}`);
  return redirect(`${back}?ok=${encodeURIComponent('Sent to the coordinator for approval.')}`);
};
