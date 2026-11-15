import type { APIRoute } from 'astro';
import { currentUser } from '../../../lib/auth';
import { castVote, listVotes, reviewerFor, scoreVotes, REVIEWERS, type Vote } from '../../../lib/applications';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

/** One reviewer's vote from the Applicants list, saved straight away. Keeps any note they left. */
export const POST: APIRoute = async ({ request, cookies }) => {
  const me = currentUser(cookies);
  if (!me) return json({ ok: false, error: 'Please sign in again.' }, 401);
  if (me.role !== 'admin') return json({ ok: false, error: 'Only admins can vote.' }, 403);
  const reviewer = reviewerFor(me.email);
  if (!reviewer) return json({ ok: false, error: 'Only Jawad and Burhan vote on applications.' }, 403);

  const form = await request.formData();
  const appId = String(form.get('appId') ?? '');
  const vote = String(form.get('vote') ?? '') as Vote;
  if (!/^[0-9a-f-]{36}$/i.test(appId)) return json({ ok: false, error: 'Unknown application.' }, 400);
  if (!['accept', 'withhold', 'reject'].includes(vote)) return json({ ok: false, error: 'Pick Accept, Withhold or Reject.' }, 400);

  try {
    const before = (await listVotes()).get(appId);
    const r = await castVote(appId, reviewer, vote, before?.[reviewer]?.note ?? '', me.email);
    if (!r.ok) return json({ ok: false, error: r.error ?? 'Could not save your vote.' }, 400);
    const after = (await listVotes()).get(appId);
    const result = scoreVotes(after);
    return json({
      ok: true,
      count: REVIEWERS.filter((x) => after?.[x.key]).length,
      result,
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : 'Could not save your vote.' }, 500);
  }
};
