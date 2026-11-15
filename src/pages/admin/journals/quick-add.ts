import type { APIRoute } from 'astro';
import { forgetJournals } from '../../../lib/journals';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

/** "Save to journal list" beside a journal-name box: adds the name with no link
 *  (the link can be added later under Manage > Journals). Admins only - the
 *  save_journal function re-checks that itself. */
export const POST: APIRoute = async ({ request, locals }) => {
  const { supabase, person } = locals as any;
  if (!supabase || !person) return json({ ok: false, error: 'Please sign in again.' }, 401);
  if (person.role !== 'admin') return json({ ok: false, error: 'Only an admin can change the journal list.' }, 403);
  const form = await request.formData();
  const name = String(form.get('name') ?? '').trim().slice(0, 200);
  if (!name) return json({ ok: false, error: 'Enter the journal name.' }, 400);
  const { error } = await supabase.rpc('save_journal', { p_id: null, p_name: name, p_url: null });
  if (error) return json({ ok: false, error: error.message }, 400);
  forgetJournals();
  return json({ ok: true });
};
