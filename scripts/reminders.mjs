/**
 * Cron entrypoint for the stagnation-reminder digest.
 *
 *   node scripts/reminders.mjs            # run the sweep (sends the digest)
 *   node scripts/reminders.mjs --dry      # preview only, nothing sent
 *
 * It calls the running app's /api/cron/reminders endpoint rather than touching
 * the database directly, so there is exactly one code path and one place the
 * business logic lives.
 *
 * Environment:
 *   APP_URL       base URL of the deployed app   (default http://localhost:4321)
 *   CRON_SECRET   must match the server's CRON_SECRET, if that is set
 *
 * --- Scheduling it -------------------------------------------------------------
 *
 * Platform cron (Render / Railway / Fly / Vercel Cron / Cloudflare Cron):
 *   point a daily job at:  POST https://www.mcaheart.com/api/cron/reminders
 *   with header:           Authorization: Bearer $CRON_SECRET
 *   (Vercel: add it to vercel.json "crons"; no script needed.)
 *
 * Unix crontab on a VPS — every day at 08:00:
 *   0 8 * * *  cd /srv/mcaheart && APP_URL=https://www.mcaheart.com \
 *              CRON_SECRET=xxxx /usr/bin/node scripts/reminders.mjs >> /var/log/mca-reminders.log 2>&1
 *
 * node-cron inside the server process (src/ code, not this script):
 *   import cron from 'node-cron';
 *   import { runReminderSweep } from './lib/reminders';
 *   cron.schedule('0 8 * * *', () => runReminderSweep({ actor: 'node-cron' }));
 */
const BASE = process.env.APP_URL ?? 'http://localhost:4321';
const dry = process.argv.includes('--dry');
const url = `${BASE}/api/cron/reminders${dry ? '?dry=1' : ''}`;

const headers = { 'Content-Type': 'application/json' };
if (process.env.CRON_SECRET) headers.Authorization = `Bearer ${process.env.CRON_SECRET}`;

try {
  const res = await fetch(url, { method: 'POST', headers });
  const body = await res.json();
  if (!res.ok || !body.ok) {
    console.error(`reminder sweep failed (${res.status}):`, body);
    process.exit(1);
  }
  const r = body.result;
  console.log(
    `[${new Date().toISOString()}] sweep ok — ${r.dueCount} due, email: ${r.emailStatus}`,
  );
  for (const it of r.items) console.log(`  · ${it.title} (${it.lead}, ${it.daysIdle}d idle)`);
} catch (err) {
  console.error('reminder sweep could not reach the app:', err.message);
  process.exit(1);
}
