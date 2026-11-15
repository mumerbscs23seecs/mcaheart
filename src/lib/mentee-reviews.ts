/**
 * Private mentee reviews (mca-pipeline/add-mentee-reviews.sql). Readable only
 * by admins and the lead / co-lead of the project - the database enforces
 * that, so these helpers just read through the visitor's own client.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type MenteeReview = {
  id: string;
  project_id: string;
  person_id: string;
  reviewer_id: string | null;
  created_at: string;
  overall: number;
  quality: number | null;
  reliability: number | null;
  communication: number | null;
  initiative: number | null;
  work_again: 'yes' | 'maybe' | 'no' | null;
  strengths: string | null;
  improve: string | null;
};

/** The 1-5 scores besides "overall", in the order they're shown. */
export const SCORE_FIELDS = [
  ['quality', 'Quality of work'],
  ['reliability', 'Meets deadlines'],
  ['communication', 'Communication'],
  ['initiative', 'Initiative'],
] as const;

export const WORK_AGAIN_LABEL = { yes: 'Yes', maybe: 'Maybe', no: 'No' } as const;

const COLS = 'id,project_id,person_id,reviewer_id,created_at,overall,quality,reliability,communication,initiative,work_again,strengths,improve';

/** Reviews matching the filter, newest first. `ready` is false until the SQL has been run. */
export async function listReviews(
  supabase: SupabaseClient,
  filter: { projectId?: string; personId?: string },
): Promise<{ ready: boolean; reviews: MenteeReview[] }> {
  let q = supabase.from('mentee_reviews').select(COLS).order('created_at', { ascending: false });
  if (filter.projectId) q = q.eq('project_id', filter.projectId);
  if (filter.personId) q = q.eq('person_id', filter.personId);
  const { data, error } = await q;
  if (error) return { ready: false, reviews: [] };
  return { ready: true, reviews: (data ?? []) as MenteeReview[] };
}

/** Average of a score across reviews (ignoring blanks), to one decimal, or null. */
export function average(reviews: MenteeReview[], field: 'overall' | (typeof SCORE_FIELDS)[number][0]): number | null {
  const vals = reviews.map((r) => r[field]).filter((v): v is number => typeof v === 'number');
  if (!vals.length) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

export const fmtReviewDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
