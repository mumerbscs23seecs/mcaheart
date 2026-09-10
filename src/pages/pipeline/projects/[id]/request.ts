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
  const ret = String(form.get('return') ?? '');
  const dest = /^\/pipeline\/[\w/-]*(\?[\w=&%-]*)?$/.test(ret) ? ret : back;
  const to = (kind: 'ok' | 'err', msg: string) =>
    redirect(`${dest}${dest.includes('?') ? '&' : '?'}${kind}=${encodeURIComponent(msg)}`);

  if (!stage) return to('err', 'Choose a status first.');
  if (reviewUrl && !isDocLink(reviewUrl)) return to('err', DOC_LINK_HINT);

  const { error } = await supabase.rpc('request_stage_change', {
    p_project: projectId,
    p_stage: stage,
    p_note: note,
    p_review_url: reviewUrl || null,
  });
  if (error) return to('err', error.message);
  return to('ok', 'Sent to the coordinator for approval.');
};
