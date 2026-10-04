/**
 * One-off backfill after mca-pipeline/add-order-and-hide.sql has been run:
 * sets projects.submission_order to each paper's position in the 2026-10-04
 * submissions dataset (0-based), matched by the existing short `title`.
 * Submissions.astro then orders by this, nulls last, so anything outside
 * that dataset just falls to the bottom instead of being unsorted.
 *
 *   node scripts/backfill-submission-order.mjs --dry
 *   node scripts/backfill-submission-order.mjs
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const DRY = process.argv.includes('--dry');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const data = JSON.parse(fs.readFileSync('/tmp/mca-submissions-data.json', 'utf8'));

const { data: projects, error: projErr } = await supabase
  .from('projects')
  .select('id,ref,title,submission_order')
  .eq('phase', 'journal');
if (projErr) throw projErr;

const byTitle = new Map(projects.map((p) => [p.title.trim().toLowerCase(), p]));
let updates = 0, skipped = 0, missing = [];

for (let i = 0; i < data.submissions.length; i++) {
  const sub = data.submissions[i];
  const p = byTitle.get(sub.paper.trim().toLowerCase());
  if (!p) { missing.push(sub.paper); continue; }
  if (p.submission_order === i) { skipped++; continue; }
  updates++;
  console.log(`[order] ${p.ref} "${p.title}" -> submission_order = ${i}`);
  if (!DRY) {
    const { error } = await supabase.from('projects').update({ submission_order: i }).eq('id', p.id);
    if (error) throw error;
  }
}
console.log(`\norder backfill: ${updates} to update, ${skipped} already correct, ${missing.length} unmatched`);
missing.forEach((t) => console.log('  unmatched:', t));
if (DRY) console.log('\n(dry run - nothing written)');
