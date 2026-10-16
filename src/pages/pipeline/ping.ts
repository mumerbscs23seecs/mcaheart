import type { APIRoute } from 'astro';

// A tiny landing page for status changes saved in the background (the
// Update bar in PipelineStatusCell): the gate / request endpoints redirect
// here with ?ok= or ?err=, and the page reads the result from the final URL
// instead of loading a whole list page.
export const prerender = false;
export const GET: APIRoute = () => new Response('ok', { status: 200, headers: { 'cache-control': 'no-store' } });
