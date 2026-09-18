import type { APIRoute } from 'astro';
import { currentUser } from '../../../../lib/auth';
import { getRequest } from '../../../../lib/requests';

export const prerender = false;

/** Streams a stored observership CV to an authenticated admin. */
export const GET: APIRoute = ({ params, cookies }) => {
  const me = currentUser(cookies);
  if (!me || me.role !== 'admin') return new Response('Forbidden', { status: 403 });

  const req = getRequest(params.id ?? '');
  if (!req) return new Response('Not found', { status: 404 });

  const file = req.cv;
  if (!file) return new Response('No file', { status: 404 });

  return new Response(new Uint8Array(file.bytes), {
    headers: {
      'Content-Type': file.mime,
      'Content-Disposition': `inline; filename="${file.filename.replace(/"/g, '')}"`,
      'Content-Length': String(file.size),
      'Cache-Control': 'private, no-store',
    },
  });
};
