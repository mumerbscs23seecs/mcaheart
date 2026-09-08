import type { APIRoute } from 'astro';
import { currentUser } from '../../../../lib/auth';
import { getApplication } from '../../../../lib/applications';

export const prerender = false;

/** Streams a stored CV / headshot to an authenticated admin. */
export const GET: APIRoute = ({ params, cookies }) => {
  const me = currentUser(cookies);
  if (!me || me.role !== 'admin') return new Response('Forbidden', { status: 403 });

  const app = getApplication(params.id ?? '');
  if (!app) return new Response('Not found', { status: 404 });

  const file = params.slot === 'cv' ? app.cv : params.slot === 'headshot' ? app.headshot : null;
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
