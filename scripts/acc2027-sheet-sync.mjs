/**
 * One-off, run AFTER mca-pipeline/conference-statuses-and-types.sql:
 * applies ACC27.xlsx (exported to JSON) to the ACC 2027 papers.
 *
 *   1. Record fixes (decided with the coordinator 2026-10-05):
 *      - MCA-0140 "CDT PE": its 2026-09-06/13 history (ACC 2027 rejected ->
 *        full text -> journal "lol" -> accepted -> published) was test
 *        clicking. Remove the test ACC 2027 + "lol" attempts, put it back to
 *        its real state (TCT 2026 accepted, conference phase), then send it
 *        to ACC 2027 through gate 1 (no recycled link - TCT 2026 accepted it).
 *      - MCA-0198 "CTO stent vs no stent": not going to ACC 2027 - remove its
 *        stray, undecided ACC 2027 attempt.
 *      - MCA-0158: already had an ACC 2027 attempt while still marked as an
 *        idea - move it into the conference phase to match.
 *      Every fix leaves a correction note in the events log; nothing already
 *      in the log is rewritten.
 *   2. Type of research and status from the sheet, via set_study_type /
 *      advance_stage (no emails).
 *   3. Lead/analyst filled ONLY where empty and the sheet name exactly
 *      matches one active person. Disagreements are listed, never changed.
 *
 *   node scripts/acc2027-sheet-sync.mjs path/to/acc27.json --dry
 *   node scripts/acc2027-sheet-sync.mjs path/to/acc27.json --apply
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const ADMIN_EMAIL = 'admin@mcaheart.com';
const APPLY = process.argv.includes('--apply');
const dataPath = process.argv[2];
if (!dataPath || dataPath.startsWith('--')) {
  console.error('Usage: node scripts/acc2027-sheet-sync.mjs path/to/acc27.json [--dry|--apply]');
  process.exit(1);
}

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
let session = null;
async function rpc(fn, args) {
  if (!session) {
    await admin.auth.admin.createUser({ email: ADMIN_EMAIL, email_confirm: true }).catch(() => {});
    const { data: link, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: ADMIN_EMAIL });
    if (error) throw error;
    session = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const { error: vErr } = await session.auth.verifyOtp({ type: 'email', token_hash: link.properties.hashed_token });
    if (vErr) throw vErr;
  }
  const { data, error } = await session.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data;
}
const must = ({ data, error }) => { if (error) throw error; return data; };

const norm = (s) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
const STATUS = { 'no progress': 'no_progress', 'analysis plan finalized': 'plan_final', 'screening/extraction': 'screening', 'analysis done': 'analysis_done', ready: 'ready' };
const log = [];
const say = (s) => { log.push(s); };

const sheet = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const { id: ACC } = must(await admin.from('conferences').select('id').eq('name', 'ACC 2027').single());
const { id: admId } = must(await admin.from('people').select('id').eq('email', ADMIN_EMAIL).single());
const note = async (projectId, text) =>
  must(await admin.from('events').insert({ project_id: projectId, actor_id: admId, kind: 'note', detail: { system: text } }));
const byRef = async (ref) => must(await admin.from('projects').select('*').eq('ref', ref).single());

// ---- 1. record fixes -------------------------------------------------------
{
  const p = await byRef('MCA-0140');
  if (p.phase === 'journal') {
    say('MCA-0140 CDT PE: remove test ACC 2027 rejection + "lol" journal attempt, back to TCT 2026 accepted, then gate 1 -> ACC 2027');
    if (APPLY) {
      must(await admin.from('conference_attempts').delete().eq('project_id', p.id).eq('conference_id', ACC));
      must(await admin.from('journal_attempts').delete().eq('project_id', p.id).eq('journal', 'lol'));
      must(await admin.from('projects').update({ phase: 'conference', stage: 'accepted', stage_changed_at: new Date().toISOString() }).eq('id', p.id));
      await note(p.id, 'Correction: the 2026-09-06/13 entries (ACC 2027 rejected, full text, journal "lol", accepted, published) were test clicks and have been undone - back to TCT 2026 accepted, now going to ACC 2027.');
      await rpc('gate1_send_to_conference', { p_project: p.id, p_conference: 'ACC 2027', p_recycled_from: null });
    }
  }
}
{
  const p = await byRef('MCA-0198');
  const stray = must(await admin.from('conference_attempts').select('id').eq('project_id', p.id).eq('conference_id', ACC).is('outcome', null));
  if (stray.length) {
    say('MCA-0198 CTO stent vs no stent: remove stray undecided ACC 2027 attempt (stays a TCT 2026 rejected paper)');
    if (APPLY) {
      must(await admin.from('conference_attempts').delete().in('id', stray.map((a) => a.id)));
      await note(p.id, 'Correction: removed from ACC 2027 - it is not being submitted there; stays in Conferences as rejected at TCT 2026.');
    }
  }
}
{
  const p = await byRef('MCA-0158');
  if (p.phase === 'idea') {
    say('MCA-0158 Endothelial Activation...: idea -> conference phase (already had an ACC 2027 entry)');
    if (APPLY) {
      must(await admin.from('projects').update({ phase: 'conference', stage: 'ready', stage_changed_at: new Date().toISOString() }).eq('id', p.id));
      await note(p.id, 'Correction: already entered for ACC 2027 while still marked as an idea - moved into the conference phase to match.');
    }
  }
}

// ---- 2 + 3. sheet -> type, status, empty people -----------------------------
const projects = must(await admin.from('projects').select('id,ref,title,phase,stage,study_type,lead_id,analyst_id,colead_id,presenter_id,corresponding_id').is('archived_at', null));
const people = must(await admin.from('people').select('id,full_name').eq('active', true));
const personName = new Map(people.map((x) => [x.id, x.full_name]));
const exactPerson = (name) => {
  const hits = people.filter((x) => norm(x.full_name) === norm(name));
  return hits.length === 1 ? hits[0] : null;
};
// Same person written differently? ("MB" ~ "Muhammad Burhan", "Hazique" ~
// "M Hazique", "Ahamd Yadk" ~ "Ahmad Yadk") - only used to decide what is
// worth flagging, never to change anything.
const lev = (a, b) => {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
};
const samePerson = (dbName, sheetName) => {
  const a = norm(dbName), b = norm(sheetName);
  if (a === b) return true;
  const ta = a.split(/[\s/.]+/).filter(Boolean), tb = b.split(/[\s/.]+/).filter(Boolean);
  const initials = (t) => t.map((w) => w[0]).join('');
  if (a.length <= 3 && (a === initials(tb) || a.replace(/\s/g, '') === initials(tb))) return true;
  return ta.some((x) => x.length >= 3 && tb.some((y) => y.length >= 3 && lev(x, y) <= 1));
};

const SPECIAL = { 'anesthetic strategies for transfemoral tavr': 'MCA-0196', 'cdt pe': 'MCA-0140' };
const flags = [];
for (const r of sheet) {
  const name = r['Name'];
  const ref = SPECIAL[norm(name)];
  const hits = ref ? projects.filter((p) => p.ref === ref) : projects.filter((p) => norm(p.title) === norm(name));
  if (hits.length !== 1) { flags.push(`#${r['#']} "${name}": ${hits.length} matches - skipped`); continue; }
  const p = hits[0];
  const tag = `#${r['#']} ${p.ref} ${name.trim()}`;

  const type = (r['Type:'] || '').trim();
  if (type && type !== p.study_type) {
    say(`${tag}: type ${p.study_type} -> ${type}`);
    if (APPLY) await rpc('set_study_type', { p_project: p.id, p_study_type: type });
  }

  const stage = STATUS[norm(r['Abstract Status'])];
  // MCA-0140 / 0158 were just moved above; re-read their phase on apply.
  const live = APPLY && ['MCA-0140', 'MCA-0158'].includes(p.ref) ? await byRef(p.ref) : p;
  const phase = ['MCA-0140', 'MCA-0158'].includes(p.ref) ? 'conference' : live.phase;
  if (!stage) flags.push(`${tag}: unknown status "${r['Abstract Status']}"`);
  else if (phase !== 'conference') flags.push(`${tag}: in ${phase} phase - status left as is`);
  else if (['accepted', 'rejected'].includes(live.stage)) flags.push(`${tag}: abstract already ${live.stage} - status left as is`);
  else if (stage !== live.stage) {
    say(`${tag}: status ${live.stage} -> ${stage}`);
    if (APPLY) await rpc('advance_stage', { p_project: p.id, p_stage: stage });
  }

  const assign = { lead_id: p.lead_id, analyst_id: p.analyst_id };
  for (const [col, sheetName] of [['lead_id', r['Author']], ['analyst_id', r['Analysis ']]]) {
    if (!sheetName) continue;
    const label = col === 'lead_id' ? 'lead' : 'analyst';
    if (!p[col]) {
      const match = exactPerson(sheetName);
      if (match) { assign[col] = match.id; say(`${tag}: ${label} (empty) -> ${match.full_name}`); }
      else flags.push(`${tag}: ${label} is empty, no exact person named "${sheetName}"`);
    } else if (!samePerson(personName.get(p[col]) ?? '', sheetName)) {
      flags.push(`${tag}: ${label} is "${personName.get(p[col])}" but sheet says "${sheetName}"`);
    }
  }
  if (APPLY && (assign.lead_id !== p.lead_id || assign.analyst_id !== p.analyst_id)) {
    await rpc('assign_people', {
      p_project: p.id, p_lead_id: assign.lead_id, p_colead_id: p.colead_id, p_analyst_id: assign.analyst_id,
      p_presenter_id: p.presenter_id, p_corresponding_id: p.corresponding_id,
    });
  }
}

console.log(`=== Changes (${log.length}) ===`);
log.forEach((l) => console.log(' ' + l));
console.log(`\n=== For you to check (${flags.length}) - nothing changed for these ===`);
flags.forEach((f) => console.log(' ' + f));
console.log(APPLY ? '\nApplied.' : '\n(dry run - nothing written; re-run with --apply)');
