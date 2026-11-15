import type { APIRoute } from 'astro';
import { readPhoto } from '../../../../lib/profile';

export const prerender = false;

/** A member's profile photo, for signed-in members only (the middleware
 *  sends anyone else to the login page before this runs). Always a WebP
 *  re-encoded on upload, served as an image and never sniffed. */
export const GET: APIRoute = async ({ params, locals }) => {
  if (!(locals as any).person) return new Response('Not found', { status: 404 });
  const id = String(params.id ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response('Not found', { status: 404 });
  const photo = await readPhoto(id);
  if (!photo) return new Response('Not found', { status: 404 });
  return new Response(photo.bytes, {
    headers: {
      'content-type': 'image/webp',
      'x-content-type-options': 'nosniff',
      'cache-control': 'private, max-age=86400',
    },
  });
};
