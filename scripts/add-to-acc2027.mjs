/**
 * One-off: send every paper in ACC27.xlsx (Downloads/ACC27.xlsx, exported to
 * scratchpad/acc27-data.json) to the ACC 2027 conference via the real
 * gate1_send_to_conference RPC - the same one the "Send to conference" form
 * on a project page calls, so this produces the exact same end state
 * (phase='conference', a conference_attempts row,
 * a gate1 event) as doing it by hand in the UI.
 *
 * For every matched project, p_recycled_from is looked up the same way the
 * UI's own Gate 1 form looks it up (gate.astro, gate==='1'): the project's
 * most recent TCT 2026 conference_attempts row with outcome='rejected', if
 * any - independent of what the spreadsheet's own "Type" column says, since
 * that's just a label and the attempt lookup is the actual source of truth.
 *
 * Matched by exact (normalized) title only. Skips and reports, never guesses,
 * for: no match, more than one match, already has an ACC 2027 attempt,
 * project not in phase idea/conference, or an unresolved open attempt at a
 * different conference already.
 *
 *   node scripts/add-to-acc2027.mjs path/to/acc27-data.json --dry
 *   node scripts/add-to-acc2027.mjs path/to/acc27-data.json --apply
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const ADMIN_EMAIL = 'admin@mcaheart.com';
const CONFERENCE = 'ACC 2027';
const APPLY = process.argv.includes('--apply');
const dataPath = process.argv[2];
if (!dataPath || dataPath.startsWith('--')) {
  console.error('Usage: node scripts/add-to-acc2027.mjs path/to/acc27-data.json [--dry|--apply]');
  process.exit(1);
}

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function adminSession() {
  await admin.auth.admin.createUser({ email: ADMIN_EMAIL, email_confirm: true }).catch(() => {});
  const { data: link, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: ADMIN_EMAIL });
  const hash = link?.properties?.hashed_token;
  if (error || !hash) throw new Error('Could not mint an admin session: ' + (error?.message ?? 'no token'));
  const anon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  const { error: vErr } = await anon.auth.verifyOtp({ type: 'email', token_hash: hash });
  if (vErr) throw new Error('Could not verify admin session: ' + vErr.message);
  return anon;
}

const norm = (s) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');

const rows = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

const { data: allProjects, error: projErr } = await admin
  .from('projects')
  .select('id,ref,title,phase,stage,archived_at');
if (projErr) throw projErr;
const byTitle = new Map();
for (const p of allProjects) {
  const key = norm(p.title);
  byTitle.set(key, (byTitle.get(key) ?? []).concat(p));
}

const { data: conf } = await admin.from('conferences').select('id,name').eq('name', CONFERENCE).maybeSingle();
if (!conf) throw new Error(`No conference named "${CONFERENCE}"`);

const { data: allAttempts, error: attErr } = await admin
  .from('conference_attempts')
  .select('id,project_id,conference_id,outcome,decided_on,submitted_on');
if (attErr) throw attErr;
const attemptsByProject = new Map();
for (const a of allAttempts) attemptsByProject.set(a.project_id, (attemptsByProject.get(a.project_id) ?? []).concat(a));

const { data: tct26 } = await admin.from('conferences').select('id').eq('name', 'TCT 2026').maybeSingle();

let session = null;
async function ensureSession() {
  if (!session) session = await adminSession();
  return session;
}

const report = { toSend: [], alreadyThere: [], skipped: [] };

for (const row of rows) {
  const hits = byTitle.get(norm(row.name)) ?? [];
  if (hits.length === 0) { report.skipped.push({ n: row.n, name: row.name, reason: 'no matching project found' }); continue; }
  if (hits.length > 1) { report.skipped.push({ n: row.n, name: row.name, reason: `ambiguous - matches ${hits.map((h) => h.ref).join(', ')}` }); continue; }
  const project = hits[0];

  if (project.archived_at) { report.skipped.push({ n: row.n, name: row.name, ref: project.ref, reason: 'project is archived' }); continue; }
  if (!['idea', 'conference'].includes(project.phase)) {
    report.skipped.push({ n: row.n, name: row.name, ref: project.ref, reason: `phase is '${project.phase}', not idea/conference - gate 1 would reject this` });
    continue;
  }

  const attempts = attemptsByProject.get(project.id) ?? [];
  const already = attempts.find((a) => a.conference_id === conf.id);
  if (already) { report.alreadyThere.push({ n: row.n, name: row.name, ref: project.ref }); continue; }

  const openElsewhere = attempts.find((a) => a.outcome === null);
  if (openElsewhere) {
    report.skipped.push({ n: row.n, name: row.name, ref: project.ref, reason: `already has an undecided attempt at another conference (attempt ${openElsewhere.id}) - decide that first` });
    continue;
  }

  let recycledFrom = null;
  if (tct26) {
    const rejectedAtTct26 = attempts
      .filter((a) => a.conference_id === tct26.id && a.outcome === 'rejected')
      .sort((a, b) => (b.decided_on ?? '').localeCompare(a.decided_on ?? ''))[0];
    if (rejectedAtTct26) recycledFrom = rejectedAtTct26.id;
  }
  // Cross-check against the spreadsheet's own label, purely for a heads-up - the
  // attempt lookup above is what actually decides recycledFrom either way.
  const labelSaysRecycled = row.type.toLowerCase().startsWith('recycled');
  const mismatch = labelSaysRecycled !== !!recycledFrom;

  report.toSend.push({ n: row.n, name: row.name, ref: project.ref, phase: project.phase, stage: project.stage, recycledFrom, label: row.type, mismatch });
  if (APPLY) {
    const s = await ensureSession();
    const { error } = await s.rpc('gate1_send_to_conference', { p_project: project.id, p_conference: CONFERENCE, p_recycled_from: recycledFrom });
    if (error) throw new Error(`gate1_send_to_conference(${project.ref}): ${error.message}`);
  }
}

console.log(`\n=== To send to ${CONFERENCE}: ${report.toSend.length} ===`);
report.toSend.forEach((r) => console.log(` #${r.n} ${r.ref ?? '?'} "${r.name}" (${r.phase}/${r.stage}) - recycled_from: ${r.recycledFrom ?? 'none'} [sheet said: ${r.label}]${r.mismatch ? '  <-- MISMATCH vs sheet label, check this one' : ''}`));

console.log(`\n=== Already at ${CONFERENCE}: ${report.alreadyThere.length} (left untouched) ===`);
report.alreadyThere.forEach((r) => console.log(` #${r.n} ${r.ref} "${r.name}"`));

console.log(`\n=== Needs manual review: ${report.skipped.length} (nothing changed for these) ===`);
report.skipped.forEach((r) => console.log(` #${r.n} "${r.name}"${r.ref ? ' (' + r.ref + ')' : ''} - ${r.reason}`));

console.log(APPLY ? '\nApplied.' : '\n(dry run - nothing written; re-run with --apply)');
