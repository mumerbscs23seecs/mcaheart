import type { APIRoute } from 'astro';

export const prerender = false;

/**
 * Fix or delete one history line (admins; edit_event / delete_event check).
 * The date field is a day: the line keeps its original time of day.
 */
export const POST: APIRoute = async ({ params, request, locals, redirect }) => {
  const { supabase } = locals as any;
  const id = params.id!;
  const missingSql = (m: string) => /could not find the function|does not exist/i.test(m)
    ? 'Editing papers needs mca-pipeline/add-paper-editing.sql to be run first.' : m;
  const to = (kind: 'ok' | 'err', msg: string) => redirect(`/pipeline/projects/${id}?${kind}=${encodeURIComponent(kind === 'err' ? missingSql(msg) : msg)}#history`, 303);
  const form = await request.formData();
  const eventId = Number(form.get('eventId'));
  if (!Number.isSafeInteger(eventId) || eventId <= 0) return to('err', 'That history line could not be found.');

  if (form.get('action') === 'delete') {
    const { error } = await supabase.rpc('delete_event', { p_event: eventId });
    return error ? to('err', error.message) : to('ok', 'History line deleted.');
  }

  const original = new Date(String(form.get('at') ?? ''));
  const day = String(form.get('date') ?? '');
  if (Number.isNaN(original.getTime())) return to('err', 'That history line could not be found.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return to('err', 'Enter a date.');
  const [y, m, d] = day.split('-').map(Number);
  const at = new Date(original);
  at.setUTCFullYear(y, m - 1, d);
  if (Number.isNaN(at.getTime())) return to('err', 'Enter a valid date.');

  // Wording the same as the automatic text means "no custom wording".
  const label = String(form.get('label') ?? '').trim();
  const auto = String(form.get('auto') ?? '').trim();
  const { error } = await supabase.rpc('edit_event', {
    p_event: eventId,
    p_at: at.toISOString(),
    p_label: label && label !== auto ? label : null,
  });
  return error ? to('err', error.message) : to('ok', 'History line saved.');
};
