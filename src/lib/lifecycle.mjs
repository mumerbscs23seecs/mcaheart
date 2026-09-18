// Single source of truth for the MCA pipeline state machine.
// Platform-neutral: import from Astro API routes, or paste into a Wix backend .js file.
// Run `node lifecycle.mjs` to self-check.

export const PHASES = ['idea', 'conference', 'manuscript', 'journal', 'archived'];

// stage code -> { phase, label }. Order within a phase is the array order.
export const STAGES = [
  ['idea',       'no_progress',   'No progress'],
  ['idea',       'plan_final',    'Analysis plan finalized'],
  ['idea',       'analysis_done', 'Analysis done'],
  ['idea',       'ready',         'Ready'],

  ['conference', 'abstract_wip',  'Abstract being written'],
  ['conference', 'submitted',     'Submitted to conference'],
  ['conference', 'accepted',      'Accepted'],
  ['conference', 'rejected',      'Rejected'],

  ['manuscript', 'ms_1_4',        '1/6 Analysis shared / being revised'],
  ['manuscript', 'ms_2_4',        '2/6 Results & methods being written'],
  ['manuscript', 'ms_3_4',        '3/6 Introduction & discussion being written'],
  ['manuscript', 'ms_4_4',        '4/6 Final formatting / tables / references / SF'],
  ['manuscript', 'ms_5_review',   '5/6 Sent for review to RG Operations'],
  ['manuscript', 'ms_6_comments', '6/6 Addressing RG Operations comments'],

  // Phase C mirrors what SNAPP / Wiley actually show the corresponding author,
  // intersected with what the Submissions sheet already tracks. Anything finer
  // (reviewer invited / reviewer accepted) is publisher-side and cannot be kept
  // accurate by hand - read it in SNAPP, do not retype it here.
  ['journal',    'submitted',     'Submitted - technical check'],
  ['journal',    'with_editor',   'With editor'],
  ['journal',    'under_review',  'Under review'],
  ['journal',    'revision_req',  'Revision requested'],
  ['journal',    'revision_review','Revision under review'],
  ['journal',    'rejected_comments','Rejected with comments'],
  ['journal',    'rejected_no_comments','Rejected with no comments'],
  ['journal',    'accepted',      'Accepted'],
  ['journal',    'published',     'Published'],
].map(([phase, code, label]) => ({ phase, code, label }));

export const stagesFor = (phase) => STAGES.filter(s => s.phase === phase);
export const stageOf = (code) => STAGES.find(s => s.code === code);

export const ARCHIVE_REASONS = [
  'not_novel', 'needs_reanalysis', 'lead_unresponsive',
  'insufficient_data', 'superseded', 'other',
];

// Gates are the ONLY way a project changes phase. Admin-only, everywhere.
export const GATES = {
  gate1_conference: { from: ['idea', 'conference'], to: 'conference' },
  gate2_full_text:  { from: ['conference'],         to: 'manuscript' }, // or 'archived' on No
  gate3_journal:    { from: ['manuscript'],         to: 'journal' }, // → stage 'submitted'
};

/**
 * Can `actor` move `project` to `newStage`?
 * Returns null if allowed, otherwise a string explaining why not.
 * This is the whole authorisation rule for stage edits - do not duplicate it in the UI.
 */
export function stageChangeError(project, newStage, actor) {
  if (project.archived_at) return 'Project is archived.';
  const target = stageOf(newStage);
  if (!target) return `Unknown stage "${newStage}".`;
  if (target.phase !== project.phase)
    return `Stage "${target.label}" belongs to phase ${target.phase}; project is in ${project.phase}. Use a gate.`;
  if (newStage === project.stage) return 'Stage unchanged.';

  const isAdmin = actor.role === 'admin';
  const isOwner = [project.lead_id, project.colead_id, project.analyst_id]
    .filter(Boolean).includes(actor.id);
  if (!isAdmin && !isOwner) return 'Only an admin, the lead, or the analyst can change this stage.';

  // Only admins may set an outcome - it freezes an attempt row.
  // NOTE: 'accepted' exists in both the conference and journal phases, so this must
  // test the phase too. Testing the stage code alone would let a lead close a
  // conference attempt from the journal screen, and vice versa.
  const OUTCOMES = {
    conference: ['accepted', 'rejected'],
    journal:    ['accepted', 'published', 'rejected_comments', 'rejected_no_comments'],
  };
  if ((OUTCOMES[target.phase] ?? []).includes(newStage) && !isAdmin)
    return `Only an admin can record a ${target.phase} outcome.`;
  return null;
}

/**
 * Revision rounds. SNAPP's status history repeats the whole review cycle per round;
 * a single 'revision_review' stage cannot say whether this is round 1 or round 3.
 * The round lives on the journal attempt and increments when a revision is requested.
 */
export function nextRevisionRound(attempt, newStage) {
  return newStage === 'revision_req' ? (attempt.revision_round ?? 0) + 1
                                     : (attempt.revision_round ?? 0);
}

/** Human reference, e.g. MCA-0142. Never show a uuid to a person. */
export const refOf = (n) => `MCA-${String(n).padStart(4, '0')}`;

/** Gate 3 requires a finished manuscript. */
export function gate3Error(project) {
  if (project.phase !== 'manuscript') return 'Only a manuscript-phase project can be submitted.';
  if (!['ms_5_review', 'ms_6_comments'].includes(project.stage))
    return 'Reach stage 5 (sent to RG Operations) before submitting to a journal.';
  if (!project.manuscript_url) return 'Add the manuscript link first.';
  return null;
}

/** Conferences offered at Gate 1: nearest 3 with an open abstract deadline. */
export function gate1Options(conferences, today = new Date()) {
  const t = today.toISOString().slice(0, 10);
  return conferences
    .filter(c => c.abstract_deadline >= t)
    .sort((a, b) => a.abstract_deadline.localeCompare(b.abstract_deadline))
    .slice(0, 3);
}

const DAY = 86400000;
const days = (from, to) => Math.floor((new Date(to) - new Date(from)) / DAY);

/** Derived flags. Never store these - recompute on read. */
export function flags(project, today = new Date()) {
  const active = !project.archived_at && !project.parked && project.phase !== 'archived';
  const staleDays = days(project.stage_changed_at, today);
  return {
    active,
    overdue:    active && !!project.next_target && project.next_target < today.toISOString().slice(0, 10),
    overdueBy:  project.next_target ? days(project.next_target, today) : null,
    stale:      active && staleDays >= 21,   // stage untouched - notes do NOT reset this
    daysInStage: staleDays,
  };
}

// ---------------------------------------------------------------- self-check
if (import.meta.url === `file://${process.argv[1]}`) {
  const { strict: a } = await import('node:assert');
  const admin = { id: 'u-admin', role: 'admin' };
  const lead  = { id: 'u-lead',  role: 'member' };
  const other = { id: 'u-other', role: 'member' };
  const p = {
    phase: 'manuscript', stage: 'ms_2_4', lead_id: 'u-lead', analyst_id: 'u-mb',
    stage_changed_at: '2026-08-12', next_target: '2026-09-01',
    manuscript_url: null, archived_at: null, parked: false,
  };

  a.equal(stageChangeError(p, 'ms_3_4', lead), null, 'lead may advance own project');
  a.match(stageChangeError(p, 'ms_3_4', other), /Only an admin/, 'stranger may not');
  a.match(stageChangeError(p, 'under_review', admin), /belongs to phase journal/, 'no phase-skipping via stage');
  a.match(stageChangeError(p, 'nonsense', admin), /Unknown stage/);
  a.match(stageChangeError({ ...p, archived_at: '2026-01-01' }, 'ms_3_4', admin), /archived/);
  a.match(stageChangeError({ phase: 'conference', stage: 'abstract_wip', lead_id: 'u-lead' }, 'accepted', lead),
          /conference outcome/, 'conference outcome is admin-only');
  a.match(stageChangeError({ phase: 'journal', stage: 'under_review', lead_id: 'u-lead' }, 'published', lead),
          /journal outcome/, 'journal outcome is admin-only');
  a.equal(stageChangeError({ phase: 'journal', stage: 'under_review', lead_id: 'u-lead' }, 'revision_review', lead),
          null, 'lead may still move within phase C');

  a.match(gate3Error(p), /Reach stage 5/);
  a.match(gate3Error({ ...p, stage: 'ms_5_review' }), /manuscript link/);
  a.equal(gate3Error({ ...p, stage: 'ms_5_review', manuscript_url: 'x' }), null);

  const confs = [
    { name: 'SCAI 2026', abstract_deadline: '2025-11-01' },   // past
    { name: 'TCT 2026',  abstract_deadline: '2026-05-16' },   // past on our test date
    { name: 'ACC 2027',  abstract_deadline: '2026-10-12' },
    { name: 'SCAI 2027', abstract_deadline: '2026-11-30' },
    { name: 'TCT 2027',  abstract_deadline: '2027-05-15' },
    { name: 'ACC 2028',  abstract_deadline: '2027-10-10' },
  ];
  const opts = gate1Options(confs, new Date('2026-09-05'));
  a.deepEqual(opts.map(c => c.name), ['ACC 2027', 'SCAI 2027', 'TCT 2027'], 'nearest 3 open deadlines');

  const f = flags(p, new Date('2026-09-05'));
  a.equal(f.overdue, true); a.equal(f.overdueBy, 4);
  a.equal(f.daysInStage, 24); a.equal(f.stale, true);
  a.equal(flags({ ...p, parked: true }, new Date('2026-09-05')).overdue, false, 'parked never chases');

  a.equal(stagesFor('manuscript').length, 6);
  a.equal(stagesFor('journal').length, 9);
  a.equal(nextRevisionRound({ revision_round: 1 }, 'revision_req'), 2, 'round increments on request');
  a.equal(nextRevisionRound({ revision_round: 1 }, 'revision_review'), 1, 'and only then');
  a.equal(refOf(142), 'MCA-0142');
  console.log('lifecycle self-check: all assertions passed');
}
