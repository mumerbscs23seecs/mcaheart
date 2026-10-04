/**
 * Reusable sync from a "Manuscript Compass"-shaped data export (the same
 * embedded JSON the 2026-10-04 Claude artifact carried: {submissions, ongoing, ...})
 * into the live pipeline. Re-run this any time there's a fresher export -
 * save/paste the new data as a .json file and point this at it.
 *
 * What it does:
 *   - Submissions (phase=journal): sets full_title + submission_order for
 *     every paper matched by its existing short `title`, and expands
 *     journal_attempts.journal from raw abbreviations ("JOA") to full names
 *     ("Journal of Arrhythmia") wherever the dataset gives one.
 *   - Ongoing (phase=manuscript): same full_title + submission_order sync,
 *     PLUS advances a paper's phase/stage to match the dataset's kanban
 *     column when the live database is behind it (Conference/Accepted ->
 *     Manuscript, at the matching 1/6..6/6 stage). Never moves a paper
 *     backward, and never touches anything not already safely matched.
 *
 * Nothing is guessed. A row is skipped (written to the "needs review" list
 * at the end, nothing changed) when:
 *   - its title has no exact match in the database,
 *   - its title matches more than one active project,
 *   - it's an Ongoing entry whose database phase isn't 'conference' or
 *     'manuscript' (e.g. still at idea, or already published - further
 *     along or behind in a way this script won't second-guess),
 *   - it's a Conference-phase match whose stage isn't 'accepted' (e.g.
 *     'rejected' - proceeding to manuscript would contradict that outcome),
 *   - its kanban stage text doesn't start with a number this script
 *     recognizes.
 *
 * Every Ongoing phase/stage change applies with NO email (admin
 * housekeeping, not a real-time notification) and needs a real admin
 * Supabase session, not the service-role key - advance_stage()/
 * gate2_proceed() resolve the caller via me()/auth.uid(). This script
 * bridges one itself (mint a magic-link token server-side with the
 * service key, redeem it with the anon key), the same technique
 * src/lib/pipeline-auth.ts's bridgeAdminSession() uses for the website.
 *
 *   node scripts/sync-pipeline-data.mjs path/to/data.json --dry
 *   node scripts/sync-pipeline-data.mjs path/to/data.json --apply
 *
 * ADMIN_EMAIL below must be a real `people` row with role='admin'.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const ADMIN_EMAIL = 'admin@mcaheart.com';
const APPLY = process.argv.includes('--apply');
const dataPath = process.argv[2];
if (!dataPath || dataPath.startsWith('--')) {
  console.error('Usage: node scripts/sync-pipeline-data.mjs path/to/data.json [--dry|--apply]');
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

const MANUSCRIPT_STAGES = [
  { code: 'ms_1_4', label: '1/6 Analysis shared / being revised' },
  { code: 'ms_2_4', label: '2/6 Results & methods being written' },
  { code: 'ms_3_4', label: '3/6 Introduction & discussion being written' },
  { code: 'ms_4_4', label: '4/6 Final formatting / tables / references / SF' },
  { code: 'ms_5_review', label: '5/6 Sent for review to RG Operations' },
  { code: 'ms_6_comments', label: '6/6 Addressing RG Operations comments' },
];

/** "2/4. Results..." -> index 1 (ms_2_4). Blank -> index 0 (ms_1_4, least progressed). */
function stageIndexFor(kanbanText) {
  const t = (kanbanText || '').trim();
  if (!t) return 0;
  const m = t.match(/^(\d+)/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n >= 1 && n <= MANUSCRIPT_STAGES.length ? n - 1 : null;
}

// journal-phase status label -> live stage code (src/lib/lifecycle.mjs is the
// source of truth; keep this in sync with it).
const STATUS_MAP = {
  'Submission awaited': 'awaited',
  'Submitted/With editor': 'submitted',
  'Under review': 'under_review',
  'Revision requested': 'revision_req',
  'Revision under review': 'revision_review',
  'Temporarily halted': 'halted',
  'Rejected with comments': 'rejected_comments',
  'Rejected with no comments': 'rejected_no_comments',
  'Accepted': 'accepted',
  'Published': 'published',
};
const OUTCOME_STAGES = new Set(['accepted', 'rejected_comments', 'rejected_no_comments']);
// Once a project has reached one of these, an older/less-progressed artifact
// snapshot must never pull it backward - only a stronger or equal outcome applies.
const TERMINAL_RANK = { accepted: 1, published: 2 };
// Live-cycle ordering for the plain (non-outcome) journal stages. A rejected/
// accepted stage is deliberately left out: dropping OUT of one of those into a
// plain stage is a brand-new attempt cycle, not a regression (handled below).
const PLAIN_RANK = { awaited: 0, submitted: 1, under_review: 2, revision_req: 3, revision_review: 4 };

const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const report = {
  submissionsUpdated: [], submissionStageUpdated: [], submissionOutcomeRecorded: [],
  ongoingAdvanced: [], ongoingSynced: [], journalUpdated: 0, skipped: [],
};

// ---- load every active project once ---------------------------------
const { data: allProjects, error: projErr } = await admin
  .from('projects')
  .select('id,ref,title,phase,stage,full_title,submission_order')
  .is('archived_at', null);
if (projErr) throw projErr;
const byTitle = new Map();
for (const p of allProjects) {
  const key = norm(p.title);
  byTitle.set(key, (byTitle.get(key) ?? []).concat(p));
}
function findOne(title) {
  const hits = byTitle.get(norm(title)) ?? [];
  if (hits.length === 0) return { error: 'not found' };
  if (hits.length > 1) return { error: `ambiguous - matches ${hits.map((h) => h.ref).join(', ')}` };
  return { project: hits[0] };
}

let session = null;
async function ensureSession() {
  if (!session) session = await adminSession();
  return session;
}

// ---- 1. Submissions (phase=journal) ----------------------------------
const journalMatches = []; // { sub, i, project } - reused by the stage-sync pass below
for (let i = 0; i < (data.submissions ?? []).length; i++) {
  const sub = data.submissions[i];
  const { project, error } = findOne(sub.paper);
  if (error) { report.skipped.push({ source: 'submissions', paper: sub.paper, reason: error }); continue; }
  if (project.phase !== 'journal') {
    report.skipped.push({ source: 'submissions', paper: sub.paper, reason: `database phase is '${project.phase}', not 'journal'` });
    continue;
  }
  journalMatches.push({ sub, i, project });
  const patch = {};
  if (sub.full && project.full_title !== sub.full) patch.full_title = sub.full;
  if (project.submission_order !== i) patch.submission_order = i;
  if (Object.keys(patch).length) {
    report.submissionsUpdated.push({ ref: project.ref, title: project.title, patch });
    if (APPLY) {
      const { error: upErr } = await admin.from('projects').update(patch).eq('id', project.id);
      if (upErr) throw upErr;
    }
  }
}

// Journal raw -> full, from every history + current entry (skip flag:true -
// those are the dataset's own "unresolved, confirm this" notes, not real names).
const journalMap = new Map();
for (const sub of data.submissions ?? []) {
  const entries = [...(sub.history || [])];
  if (sub.current) entries.push(sub.current);
  for (const e of entries) {
    if (e.raw && e.full && !e.flag) journalMap.set(e.raw, e.full);
  }
}
const { data: attempts, error: attErr } = await admin.from('journal_attempts').select('id,journal');
if (attErr) throw attErr;
for (const a of attempts) {
  const full = journalMap.get(a.journal);
  if (!full || full === a.journal) continue;
  report.journalUpdated++;
  if (APPLY) {
    const { error: upErr } = await admin.from('journal_attempts').update({ journal: full }).eq('id', a.id);
    if (upErr) throw upErr;
  }
}

// ---- 1b. Submissions status/stage sync, incl. rejections --------------
// Re-reads journal_attempts AFTER the raw->full rename above so "current
// journal" comparisons below see the renamed value.
{
  const ids = journalMatches.map((m) => m.project.id);
  const { data: liveAttempts, error: laErr } = await admin
    .from('journal_attempts')
    .select('id,project_id,journal,outcome,submitted_on')
    .in('project_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
  if (laErr) throw laErr;
  const attemptsByProject = new Map();
  for (const a of liveAttempts) attemptsByProject.set(a.project_id, (attemptsByProject.get(a.project_id) ?? []).concat(a));
  const openAttemptFor = (projectId) => {
    const rows = (attemptsByProject.get(projectId) ?? []).filter((a) => a.outcome === null);
    rows.sort((a, b) => (b.submitted_on ?? '').localeCompare(a.submitted_on ?? ''));
    return rows[0] ?? null;
  };

  for (const { sub, project } of journalMatches) {
    const target = STATUS_MAP[sub.status];
    if (!target) {
      report.skipped.push({ source: 'submissions', paper: sub.paper, ref: project.ref, reason: `unrecognized status "${sub.status}"` });
      continue;
    }
    if (target === project.stage) continue; // already synced

    // Never pull a project backward out of a stronger outcome it has already reached.
    const currentRank = TERMINAL_RANK[project.stage] ?? 0;
    const targetRank = TERMINAL_RANK[target] ?? 0;
    if (currentRank > 0 && targetRank <= currentRank) {
      report.skipped.push({ source: 'submissions', paper: sub.paper, ref: project.ref, reason: `database is already '${project.stage}' - artifact's '${sub.status}' would move it backward` });
      continue;
    }

    if (OUTCOME_STAGES.has(target)) {
      const open = openAttemptFor(project.id);
      if (!open) {
        report.skipped.push({ source: 'submissions', paper: sub.paper, ref: project.ref, reason: `wants outcome '${target}' but there is no open (undecided) journal attempt to close - manual review` });
        continue;
      }
      // Sanity: the open attempt should be the same journal the artifact calls "current" -
      // if not, journals have moved on in a way this script hasn't tracked step by step.
      const cur = sub.current;
      if (cur && cur.raw && cur.full) {
        const openJournal = norm(open.journal);
        if (openJournal !== norm(cur.raw) && openJournal !== norm(cur.full)) {
          report.skipped.push({ source: 'submissions', paper: sub.paper, ref: project.ref, reason: `open attempt is at "${open.journal}" but artifact's current journal is "${cur.full}" - multiple untracked transitions, manual review` });
          continue;
        }
      }
      report.submissionOutcomeRecorded.push({ ref: project.ref, title: project.title, from: project.stage, to: target, journal: open.journal });
      if (APPLY) {
        const s = await ensureSession();
        const outcome = target === 'accepted' ? 'accepted' : 'rejected';
        // Two overloads of this RPC exist in the DB (an older 3-arg one, plus the
        // 4-arg one that added p_reject_stage) - PostgREST can't pick between them
        // unless every named arg is always passed, so p_reject_stage goes along
        // even when it's a no-op (accepted outcomes ignore it).
        const args = { p_attempt: open.id, p_outcome: outcome, p_next_journal: null, p_reject_stage: outcome === 'rejected' ? target : null };
        const { error: rErr } = await s.rpc('record_journal_outcome', args);
        if (rErr) throw new Error(`record_journal_outcome(${project.ref}): ${rErr.message}`);
      }
    } else {
      // Moving to an earlier plain stage while the current one is still open (no
      // outcome recorded) almost always means a rejection happened that was never
      // logged - fix that first rather than silently rewinding the status label.
      const curRank = PLAIN_RANK[project.stage];
      const tgtRank = PLAIN_RANK[target];
      if (curRank !== undefined && tgtRank !== undefined && tgtRank < curRank) {
        report.skipped.push({ source: 'submissions', paper: sub.paper, ref: project.ref, reason: `would move backward (${project.stage} -> ${target}) while still open - the open attempt likely needs recording as rejected first, manual review` });
        continue;
      }
      // Moving INTO 'submitted' opens (or renames) a journal_attempts row - needs
      // a journal name up front, checked here so dry-run and --apply agree.
      let journalName = null;
      if (target === 'submitted') {
        journalName = sub.current?.full || sub.current?.raw || null;
        if (!journalName) {
          report.skipped.push({ source: 'submissions', paper: sub.paper, ref: project.ref, reason: `wants stage 'submitted' but the artifact has no current journal name - manual review` });
          continue;
        }
      }
      report.submissionStageUpdated.push({ ref: project.ref, title: project.title, from: project.stage, to: target });
      if (APPLY) {
        const s = await ensureSession();
        if (target === 'submitted') {
          // Use the same RPC the real "Stage" form uses for this, not a bare
          // advance_stage, so current_journal doesn't go stale after a rejection.
          const { error: sErr } = await s.rpc('set_submitted_journal', { p_project: project.id, p_journal: journalName });
          if (sErr) throw new Error(`set_submitted_journal(${project.ref}): ${sErr.message}`);
        } else {
          const { error: aErr } = await s.rpc('advance_stage', { p_project: project.id, p_stage: target });
          if (aErr) throw new Error(`advance_stage(${project.ref}): ${aErr.message}`);
        }
      }
    }
  }
}

// ---- 2. Ongoing (phase=manuscript, advancing from phase=conference) --
for (let i = 0; i < (data.ongoing ?? []).length; i++) {
  const row = data.ongoing[i];
  const { project, error } = findOne(row.paper);
  if (error) { report.skipped.push({ source: 'ongoing', paper: row.paper, reason: error }); continue; }

  const targetIdx = stageIndexFor(row.stage);
  if (targetIdx === null) {
    report.skipped.push({ source: 'ongoing', paper: row.paper, ref: project.ref, reason: `unrecognized kanban stage text "${row.stage}"` });
    continue;
  }

  let currentIdx = null;
  let willAdvance = false;

  if (project.phase === 'conference') {
    if (project.stage !== 'accepted') {
      report.skipped.push({ source: 'ongoing', paper: row.paper, ref: project.ref, reason: `conference stage is '${project.stage}', not 'accepted'` });
      continue;
    }
    willAdvance = true;
  } else if (project.phase === 'manuscript') {
    currentIdx = MANUSCRIPT_STAGES.findIndex((s) => s.code === project.stage);
    if (currentIdx !== -1 && targetIdx > currentIdx) willAdvance = true;
  } else {
    report.skipped.push({ source: 'ongoing', paper: row.paper, ref: project.ref, reason: `database phase is '${project.phase}' - not conference or manuscript, needs manual review` });
    continue;
  }

  if (willAdvance) {
    report.ongoingAdvanced.push({
      ref: project.ref, title: project.title,
      from: `${project.phase}/${project.stage}`,
      to: `manuscript/${MANUSCRIPT_STAGES[targetIdx].code}`,
    });
    if (APPLY) {
      const s = await ensureSession();
      if (project.phase === 'conference') {
        const { error: gErr } = await s.rpc('gate2_proceed', { p_project: project.id, p_proceed: true });
        if (gErr) throw new Error(`gate2_proceed(${project.ref}): ${gErr.message}`);
      }
      if (targetIdx !== 0 || project.phase === 'manuscript') {
        const { error: aErr } = await s.rpc('advance_stage', { p_project: project.id, p_stage: MANUSCRIPT_STAGES[targetIdx].code });
        if (aErr) throw new Error(`advance_stage(${project.ref}): ${aErr.message}`);
      }
    }
  } else {
    report.ongoingSynced.push({ ref: project.ref, title: project.title, note: 'phase/stage unchanged (already at or past the dataset\'s position)' });
  }

  const patch = {};
  if (row.full && project.full_title !== row.full) patch.full_title = row.full;
  if (project.submission_order !== i) patch.submission_order = i;
  if (Object.keys(patch).length && APPLY) {
    const { error: upErr } = await admin.from('projects').update(patch).eq('id', project.id);
    if (upErr) throw upErr;
  }
}

// ---- report ------------------------------------------------------------
console.log(`\n=== Submissions: ${report.submissionsUpdated.length} to update ===`);
report.submissionsUpdated.forEach((r) => console.log(` ${r.ref} "${r.title}" ->`, r.patch));
console.log(`\n=== Journal names: ${report.journalUpdated} journal_attempts rows to update ===`);
console.log(`\n=== Submissions: ${report.submissionStageUpdated.length} plain stage changes ===`);
report.submissionStageUpdated.forEach((r) => console.log(` ${r.ref} "${r.title}": ${r.from} -> ${r.to}`));
console.log(`\n=== Submissions: ${report.submissionOutcomeRecorded.length} outcomes to record (incl. rejections) ===`);
report.submissionOutcomeRecorded.forEach((r) => console.log(` ${r.ref} "${r.title}": ${r.from} -> ${r.to} (at ${r.journal})`));
console.log(`\n=== Ongoing: ${report.ongoingAdvanced.length} to advance ===`);
report.ongoingAdvanced.forEach((r) => console.log(` ${r.ref} "${r.title}": ${r.from} -> ${r.to}`));
console.log(`\n=== Ongoing: ${report.ongoingSynced.length} already at or past the dataset's position (title/order only) ===`);
report.ongoingSynced.forEach((r) => console.log(` ${r.ref} "${r.title}"`));
console.log(`\n=== Needs manual review: ${report.skipped.length} (nothing changed for these) ===`);
report.skipped.forEach((r) => console.log(` [${r.source}] "${r.paper}"${r.ref ? ' (' + r.ref + ')' : ''} - ${r.reason}`));

console.log(APPLY ? '\nApplied.' : '\n(dry run - nothing written; re-run with --apply)');
