import type { APIRoute } from 'astro';
import { currentUser } from '../../../lib/auth';
import { markAllNotificationsRead } from '../../../lib/notifications';

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  const user = currentUser(cookies);
  if (!user) {
    return new Response(JSON.stringify({ ok: false }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }
  const marked = await markAllNotificationsRead(user.email);
  return new Response(JSON.stringify({ ok: true, marked }), {
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
};
