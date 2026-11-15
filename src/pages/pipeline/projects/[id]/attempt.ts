import type { APIRoute } from 'astro';

export const prerender = false;

const day = (v: FormDataEntryValue | null) => {
  const s = String(v ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

/** Correct a conference or journal entry on a paper (admins; the SQL checks). */
export const POST: APIRoute = async ({ params, request, locals, redirect }) => {
  const { supabase } = locals as any;
  const id = params.id!;
  const missingSql = (m: string) => /could not find the function|does not exist/i.test(m)
    ? 'Editing papers needs mca-pipeline/add-paper-editing.sql to be run first.' : m;
  const to = (kind: 'ok' | 'err', msg: string) => redirect(`/pipeline/projects/${id}?${kind}=${encodeURIComponent(kind === 'err' ? missingSql(msg) : msg)}`, 303);
  const form = await request.formData();
  const kind = String(form.get('kind') ?? '');
  const attempt = String(form.get('attemptId') ?? '');
  if (!attempt) return to('err', 'That entry could not be found.');

  if (kind === 'conference') {
    const { error } = await supabase.rpc('edit_conference_attempt', {
      p_attempt: attempt,
      p_conference: String(form.get('conference') ?? ''),
      p_submitted_on: day(form.get('submitted_on')),
      p_decided_on: day(form.get('decided_on')),
    });
    return error ? to('err', error.message) : to('ok', 'Conference entry saved.');
  }
  if (kind === 'journal') {
    const round = Number(form.get('revision_round') ?? 0);
    const { error } = await supabase.rpc('edit_journal_attempt', {
      p_attempt: attempt,
      p_journal: String(form.get('journal') ?? ''),
      p_submitted_on: day(form.get('submitted_on')),
      p_decided_on: day(form.get('decided_on')),
      p_revision_round: Number.isInteger(round) ? round : -1,
    });
    return error ? to('err', error.message) : to('ok', 'Journal entry saved.');
  }
  return to('err', 'Unknown kind of entry.');
};
