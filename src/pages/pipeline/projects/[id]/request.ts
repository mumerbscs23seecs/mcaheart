import type { APIRoute } from 'astro';
import { isDocLink, DOC_LINK_HINT } from '../../../../lib/doc-links';
import { deliverRequestSubmitted } from '../../../../lib/pipeline-mailer';
import { stagesFor } from '../../../../lib/lifecycle.mjs';

export const prerender = false;

const REAL = (e: string | null | undefined) => !!e && !e.endsWith('@import.invalid');

/** Member submits a status-change request for a conference / ongoing project. */
export const POST: APIRoute = async ({ params, request, locals, redirect, url }) => {
  const { supabase, person } = locals;
  const projectId = params.id!;
  const back = `/pipeline/projects/${projectId}`;

  const form = await request.formData();
  const stage = String(form.get('stage') ?? '').trim();
  const journal = String(form.get('journal') ?? '').trim();
  let note = String(form.get('note') ?? '').trim() || null;
  // request_stage_change has no dedicated journal param - fold it into the
  // note so the coordinator sees it when deciding (gate.astro's set_submitted_
  // journal path is admin-only, this is just a heads-up for the request).
  if (journal) note = `Journal: ${journal}${note ? `\n\n${note}` : ''}`;
  const reviewUrl = String(form.get('review_url') ?? '').trim();
  const ret = String(form.get('return') ?? '');
  const dest = /^\/pipeline\/[\w/-]*(\?[\w=&%-]*)?$/.test(ret) ? ret : back;
  const to = (kind: 'ok' | 'err', msg: string) =>
    redirect(`${dest}${dest.includes('?') ? '&' : '?'}${kind}=${encodeURIComponent(msg)}`);

  if (!stage) return to('err', 'Choose a status first.');
  if (reviewUrl && !isDocLink(reviewUrl)) return to('err', DOC_LINK_HINT);

  const { data: p0 } = await supabase.from('projects').select('id,ref,title,phase').eq('id', projectId).maybeSingle();

  const { error } = await supabase.rpc('request_stage_change', {
    p_project: projectId,
    p_stage: stage,
    p_note: note,
    p_review_url: reviewUrl || null,
  });
  if (error) return to('err', error.message);

  // Nudge the admins - no preview step, this is a system notice, not an authored message.
  let emailNote = '';
  if (p0) {
    const stageLabel = stagesFor(p0.phase).find((s: any) => s.code === stage)?.label ?? stage;
    const { data: admins } = await supabase.from('people').select('email').eq('role', 'admin').eq('active', true);
    const adminEmails = (admins ?? []).map((a: any) => a.email).filter(REAL);
    if (adminEmails.length) {
      const sent = await deliverRequestSubmitted({
        to: adminEmails,
        projectTitle: p0.title,
        ref: p0.ref,
        requester: person.full_name,
        stageLabel,
        note: note ?? undefined,
        link: `${url.origin}${back}`,
      }).catch((e) => ({ ok: false, error: String(e) }));
      emailNote = sent.ok ? '' : ' (email to coordinators failed)';
    }
  }

  return to('ok', 'Sent to the coordinator for approval.' + emailNote);
};
