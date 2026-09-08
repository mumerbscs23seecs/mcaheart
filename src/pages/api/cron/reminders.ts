import type { APIRoute } from 'astro';
import { runReminderSweep } from '../../../lib/reminders';

// On-demand endpoint the scheduler calls. Not prerendered.
export const prerender = false;

/**
 * POST /api/cron/reminders
 *
 * Protected by a shared secret so only the scheduler can trigger it:
 *   Authorization: Bearer <CRON_SECRET>
 *
 * If CRON_SECRET is unset (local dev / demo) the check is skipped.
 * Query params: ?dry=1 to preview without sending or stamping.
 */
export const POST: APIRoute = async ({ request, url }) => {
  const secret = import.meta.env.CRON_SECRET;
  if (secret) {
    const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (provided !== secret) {
      return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const result = await runReminderSweep({
    dryRun: url.searchParams.get('dry') === '1',
    actor: 'cron',
  });

  return new Response(JSON.stringify({ ok: true, result }, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

// GET is handy for a quick manual check in the browser during setup.
export const GET: APIRoute = (ctx) => POST(ctx);
