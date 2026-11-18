import type { APIRoute } from 'astro';

export const prerender = false;

const score = (v: FormDataEntryValue | null) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
};

/**
 * Add or delete a private mentee review. No checks of its own beyond reading
 * the form: add_mentee_review / delete_mentee_review check the caller is the
 * project's lead / co-lead or an admin (and, for delete, the review's author).
 */
export const POST: APIRoute = async ({ params, request, locals, redirect }) => {
  const { supabase } = locals as any;
  const projectId = params.id!;
  const form = await request.formData();
  const back = String(form.get('return') ?? '') .startsWith('/') ? String(form.get('return')) : `/pipeline/projects/${projectId}`;
  const sep = back.includes('?') ? '&' : '?';
  const to = (kind: 'ok' | 'err', msg: string) => redirect(`${back}${sep}${kind}=${encodeURIComponent(msg)}#mentees`, 303);
  const action = String(form.get('action') ?? 'add');

  if (action === 'delete') {
    const { error } = await supabase.rpc('delete_mentee_review', { p_id: String(form.get('reviewId') ?? '') });
    return error ? to('err', error.message) : to('ok', 'Review deleted.');
  }

  const personId = String(form.get('personId') ?? '');
  const overall = score(form.get('overall'));
  if (!personId) return to('err', 'Choose a member.');
  if (!overall) return to('err', 'Give an overall rating from 1 to 5.');
  const workAgain = String(form.get('work_again') ?? '');
  const { error } = await supabase.rpc('add_mentee_review', {
    p_project: projectId,
    p_person: personId,
    p_overall: overall,
    p_quality: score(form.get('quality')),
    p_reliability: score(form.get('reliability')),
    p_communication: score(form.get('communication')),
    p_initiative: score(form.get('initiative')),
    p_work_again: ['yes', 'maybe', 'no'].includes(workAgain) ? workAgain : null,
    p_strengths: String(form.get('strengths') ?? '').slice(0, 4000),
    p_improve: String(form.get('improve') ?? '').slice(0, 4000),
  });
  return error ? to('err', error.message) : to('ok', 'Review saved. Only coordinators and the project leads can see it.');
};
