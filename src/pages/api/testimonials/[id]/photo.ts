import type { APIRoute } from 'astro';
import { getTestimonialPhoto } from '../../../../lib/testimonials';

export const prerender = false;

/**
 * Public - unlike admin/requests/[id]/cv.ts, this is content the site shows
 * to every visitor, not a private file, so there's no admin-only gate here.
 */
export const GET: APIRoute = async ({ params }) => {
  const photo = await getTestimonialPhoto(params.id ?? '');
  if (!photo) return new Response('Not found', { status: 404 });

  return new Response(new Uint8Array(photo.bytes), {
    headers: {
      'Content-Type': photo.mime,
      'Content-Disposition': `inline; filename="${photo.filename.replace(/"/g, '')}"`,
      'Content-Length': String(photo.bytes.length),
      // Same window as the rest of the public site's dynamic pages
      // (BaseLayout.astro) - fresh for 5 minutes, then served stale while
      // it refreshes, so an edited photo shows up without needing a purge.
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
    },
  });
};
