/**
 * Shared bits for the "calm" list pages (Submissions, Ongoing, Conferences):
 * one colour per status, the action icons, and the date format.
 */

// The dot and text colour each status gets in the list tables.
const GREY = '#5b6472', BLUE = '#2563a8', AMBER = '#b06a0a', CORAL = '#c0432b', TEAL = '#0f766e',
  RED = '#a12a2a', GREEN = '#166534', INDIGO = '#3b3fa3', PLUM = '#6b3a7d';

const STAGE_COLOR: Record<string, Record<string, string>> = {
  journal: {
    awaited: GREY, submitted: BLUE, under_review: AMBER, revision_req: CORAL, revision_review: TEAL,
    halted: GREY, rejected_comments: RED, rejected_no_comments: RED, accepted: GREEN, published: GREEN,
  },
  manuscript: { ms_1_4: GREY, ms_2_4: BLUE, ms_3_4: INDIGO, ms_4_4: PLUM, ms_5_review: AMBER, ms_6_comments: TEAL },
  conference: {
    no_progress: GREY, plan_final: BLUE, screening: INDIGO, analysis_done: PLUM, ready: TEAL,
    submitted: AMBER, accepted: GREEN, rejected: RED, not_sent: GREY,
  },
};
export const stageColor = (phase: string, stage: string) => STAGE_COLOR[phase]?.[stage] ?? GREY;
/** Colour for a decided conference attempt (accepted / rejected / withdrawn / pending). */
export const outcomeColor = (outcome: string | null) =>
  outcome === 'accepted' ? GREEN : outcome === 'rejected' || outcome === 'withdrawn' ? RED : AMBER;

// Closed shapes carry class "f" so the Duotone icon style can tint them.
const PATHS: Record<string, string> = {
  progress: '<path d="M3 12a9 9 0 0 1 9-9" opacity=".3"/><path d="M12 3a9 9 0 1 1-9 9"/><path d="m8.5 12.2 2.4 2.4 4.6-4.8"/>',
  email: '<rect class="f" x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  journal: '<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  search: '<circle class="f" cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  play: '<rect class="f" x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9.5 4.5 2.5-4.5 2.5z"/>',
  folder: '<path class="f" d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  doc: '<path class="f" d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5M9.5 13h6M9.5 17h4"/>',
  youtube: '<rect class="f" x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="m10.5 9.5 4 2.5-4 2.5z"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  open: '<path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  edit: '<path class="f" d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  up: '<path d="M12 19V5"/><path d="m6 11 6-6 6 6"/>',
  down: '<path d="M12 5v14"/><path d="m6 13 6 6 6-6"/>',
  trash: '<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path class="f" d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/>',
  check: '<circle class="f" cx="12" cy="12" r="9"/><path d="m8 12.5 2.7 2.7L16 10"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  hand: '<path class="f" d="M8 11V5.5a1.5 1.5 0 0 1 3 0V10m0-1.5V4.5a1.5 1.5 0 0 1 3 0V10m0-3.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-.5a6 6 0 0 1-5-2.7L3.6 14a1.6 1.6 0 0 1 2.6-1.8L8 14"/>',
  palette: '<path class="f" d="M12 22a10 10 0 1 1 10-10c0 3-2 4-4 4h-2a2 2 0 0 0-1 3.7c.7.5.4 2.3-3 2.3z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7" r="1"/>',
};
export type IconName = keyof typeof PATHS;
export const icon = (name: string) =>
  `<svg class="cv-ic" viewBox="0 0 24 24" aria-hidden="true">${PATHS[name] ?? ''}</svg>`;

/** MM-DD-YYYY, as the rest of the workflow writes dates. */
export const fmtDate = (d: string | null) => {
  if (!d) return '-';
  const dt = new Date(d);
  return `${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}-${dt.getFullYear()}`;
};

/** What the side drawer shows for a paper, the same on every list page.
 *  Rendered into the row as data-cv-info (JSON); empty values are dropped. */
export function drawerInfo(p: any): string {
  const info: Record<string, string> = {
    ref: p.ref ?? '',
    type: p.study_type ?? '',
    lead: p.lead_name ?? '',
    analyst: p.analyst_name ?? '',
    conference: p.current_conference ?? '',
    journal: p.current_journal ?? '',
    started: p.created_at ? fmtDate(p.created_at) : '',
    updated: p.stage_changed_at ? fmtDate(p.stage_changed_at) : '',
  };
  return JSON.stringify(Object.fromEntries(Object.entries(info).filter(([, v]) => v)));
}
