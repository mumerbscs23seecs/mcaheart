import type { APIRoute } from 'astro';

export const prerender = false;

/** Mark the signed-in person's unread notifications as read. */
export const POST: APIRoute = async ({ locals }) => {
  const { supabase } = locals;
  const { data, error } = await supabase.rpc('mark_notifications_read', { p_ids: null });
  return new Response(JSON.stringify({ ok: !error, marked: data ?? 0, error: error?.message }), {
    status: error ? 400 : 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
};
