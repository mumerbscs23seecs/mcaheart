/**
 * One-off backfill after mca-pipeline/add-full-titles.sql has been run:
 *   1. projects.full_title  <- the real academic title, matched to each
 *      journal-phase project by its existing `title` (the team's short
 *      name, e.g. "Afib recurrence - SRMA") against the dataset below.
 *   2. journal_attempts.journal <- the full journal name, replacing the
 *      raw abbreviation it was entered as (e.g. "JOA" -> "Journal of
 *      Arrhythmia"), wherever that abbreviation has a known full name.
 *
 * Source: the submissions dataset supplied 2026-10-04 (51 papers, every
 * journal-phase submission at the time). Run once with --dry first.
 *
 *   node scripts/backfill-submission-titles.mjs --dry
 *   node scripts/backfill-submission-titles.mjs
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const DRY = process.argv.includes('--dry');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const data = JSON.parse(fs.readFileSync('/tmp/mca-submissions-data.json', 'utf8'));

// --- 1. full_title backfill, matched by the existing short `title` -------
const { data: projects, error: projErr } = await supabase
  .from('projects')
  .select('id,ref,title,full_title')
  .eq('phase', 'journal');
if (projErr) throw projErr;

const byTitle = new Map(projects.map((p) => [p.title.trim().toLowerCase(), p]));
let titleUpdates = 0, titleSkipped = 0, titleMissing = [];
for (const sub of data.submissions) {
  const p = byTitle.get(sub.paper.trim().toLowerCase());
  if (!p) { titleMissing.push(sub.paper); continue; }
  if (p.full_title === sub.full) { titleSkipped++; continue; }
  titleUpdates++;
  console.log(`[title] ${p.ref} "${p.title}" -> full_title = "${sub.full}"`);
  if (!DRY) {
    const { error } = await supabase.from('projects').update({ full_title: sub.full }).eq('id', p.id);
    if (error) throw error;
  }
}
console.log(`\ntitle backfill: ${titleUpdates} to update, ${titleSkipped} already correct, ${titleMissing.length} unmatched`);
titleMissing.forEach((t) => console.log('  unmatched:', t));

// --- 2. journal raw -> full, built from every history + current entry ----
const journalMap = new Map();
for (const sub of data.submissions) {
  const entries = [...(sub.history || [])];
  if (sub.current) entries.push(sub.current);
  for (const e of entries) {
    // flag:true means the source data itself marks this raw<->full pairing
    // as unresolved (e.g. "CT" on the ICI/lung-cancer paper) - its "full"
    // is a confirm-this-later note, not an actual journal name, so it must
    // never be written into journal_attempts.
    if (e.raw && e.full && !e.flag) journalMap.set(e.raw, e.full);
  }
}

const { data: attempts, error: attErr } = await supabase.from('journal_attempts').select('id,journal');
if (attErr) throw attErr;

let journalUpdates = 0;
for (const a of attempts) {
  const full = journalMap.get(a.journal);
  if (!full || full === a.journal) continue;
  journalUpdates++;
  console.log(`[journal] "${a.journal}" -> "${full}"`);
  if (!DRY) {
    const { error } = await supabase.from('journal_attempts').update({ journal: full }).eq('id', a.id);
    if (error) throw error;
  }
}
console.log(`\njournal backfill: ${journalUpdates} rows to update`);

if (DRY) console.log('\n(dry run - nothing written)');
