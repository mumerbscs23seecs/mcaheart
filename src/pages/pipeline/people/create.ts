import type { APIRoute } from 'astro';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

/**
 * Inline "create a new person" for the lead/analyst typeahead pickers
 * (PeoplePicker.astro) - called via fetch(), not a page navigation, so the
 * admin never leaves the form they're filling in. Returns the new person so
 * the picker can select it immediately.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  const { supabase, person } = locals;
  if (person.role !== 'admin') return json({ error: 'Admins only.' }, 403);

  const form = await request.formData();
  const fullName = String(form.get('full_name') ?? '').trim();
  const email = String(form.get('email') ?? '').trim();
  if (!fullName || !email) return json({ error: 'Name and email are both required.' }, 400);

  const { data, error } = await supabase.rpc('create_person', { p_full_name: fullName, p_email: email });
  if (error) return json({ error: error.message }, 400);
  return json({ id: data.id, full_name: data.full_name });
};
