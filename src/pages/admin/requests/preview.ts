import type { APIRoute } from 'astro';
import { renderReplyEmail } from '../../../lib/request-replies';

export const prerender = false;

/** Live preview for the reply box: the typed message in the email frame. */
export const POST: APIRoute = async ({ request, locals }) => {
  const person = (locals as any).person;
  if (!person || person.role !== 'admin') return new Response('Forbidden', { status: 403 });
  const form = await request.formData();
  const body = String(form.get('body') ?? '').slice(0, 20000);
  return new Response(renderReplyEmail(body), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
};
