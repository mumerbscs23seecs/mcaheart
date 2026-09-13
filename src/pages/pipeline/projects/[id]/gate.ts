import type { APIRoute } from 'astro';
import { renderTransitionEmail, type TransitionTemplate } from '../../../../lib/pipeline-mailer';
import { sendEmail } from '../../../../lib/email';
import { isDocLink, DOC_LINK_HINT } from '../../../../lib/doc-links';
import { stagesFor } from '../../../../lib/lifecycle.mjs';
import pipelineCss from '../../../../styles/pipeline.css?raw';
import globalCss from '../../../../styles/global.css?raw';

export const prerender = false;

const REAL = (e: string | null | undefined) => !!e && !e.endsWith('@import.invalid');

async function recipientsFor(supabase: any, ids: (string | null)[]) {
  const clean = [...new Set(ids.filter(Boolean))] as string[];
  if (!clean.length) return [];
  const { data } = await supabase.from('people').select('email').in('id', clean);
  return (data ?? []).map((r: any) => r.email).filter(REAL);
}

const escHtml = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (v: string) => escHtml(v).replace(/"/g, '&quot;');

/**
 * Every project action that touches status routes through this page first:
 * nothing is written to the database, and no email sends, until the admin
 * clicks "Send email & apply" here. "Refresh preview" re-renders with the
 * edited subject/note without applying anything. Reuses the pipeline's own
 * CSS (imported as raw text - this is a plain API route, not an Astro page)
 * so it looks like the rest of the app rather than a bare form.
 */
function previewPage(opts: {
  back: string;
  actionLabel: string;
  recipients: string[];
  subject: string;
  bodyHtml: string;
  note: string;
  hidden: Record<string, string>;
}) {
  const hiddenInputs = Object.entries(opts.hidden)
    .map(([k, v]) => `<input type="hidden" name="${escAttr(k)}" value="${escAttr(v)}" />`)
    .join('\n        ');
  const recipientsLine = opts.recipients.length
    ? escHtml(opts.recipients.join(', '))
    : 'No recipients with a real email on file - the change will still apply, just nothing will send.';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Preview email · MCA Research Pipeline</title>
  <meta name="robots" content="noindex" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,400;0,600;0,700;1,400&display=swap" />
  <style>${globalCss}\n${pipelineCss}</style>
</head>
<body class="pl-body">
  <main class="pl-main" style="max-width:760px">
    <p class="pl-crumb"><a class="pl-link" href="${escAttr(opts.back)}">&larr; Back to project</a></p>
    <h1 class="pl-h1">Preview: ${escHtml(opts.actionLabel)}</h1>
    <p class="pl-sub">Nothing has changed yet. Review the email below, edit the subject or note if you like, then send.</p>

    <section class="pl-actions">
      <h2>Recipients</h2>
      <p class="pl-muted" style="padding:14px 0 4px">${recipientsLine}</p>
    </section>

    <form method="post" style="margin-top:18px">
      ${hiddenInputs}
      <div class="pl-actions">
        <h2>Email</h2>
        <div class="pl-actrow">
          <label class="pl-actlbl">Subject</label>
          <input name="email_subject" value="${escAttr(opts.subject)}" style="flex:1;min-width:260px" />
        </div>
        <div class="pl-actrow" style="align-items:flex-start">
          <label class="pl-actlbl">Note</label>
          <textarea name="note" rows="3" placeholder="Optional - appears in the email" style="flex:1;min-width:260px">${escHtml(opts.note)}</textarea>
        </div>
        <div class="pl-actrow">
          <label class="pl-actlbl">Preview</label>
          <iframe title="Email preview" style="flex:1;min-width:260px;height:340px;border:1px solid var(--border);background:#fff"
            srcdoc="${escAttr(opts.bodyHtml)}"></iframe>
        </div>
      </div>

      <div class="pl-mini" style="margin-top:18px">
        <button class="pl-btn pl-btn--ghost" type="submit" name="step" value="preview">Refresh preview</button>
        <button class="pl-btn" type="submit" name="step" value="confirm">Send email &amp; apply</button>
        <a class="pl-btn pl-btn--ghost" href="${escAttr(opts.back)}">Cancel</a>
      </div>
    </form>
  </main>
</body>
</html>`;
}

const html = (body: string) => new Response(body, { headers: { 'content-type': 'text/html; charset=utf-8' } });

export const POST: APIRoute = async ({ params, request, locals, redirect, url }) => {
  const { supabase, person } = locals;
  const projectId = params.id!;
  const back = `/pipeline/projects/${projectId}`;
  if (person.role !== 'admin') return redirect(`${back}?err=${encodeURIComponent('Admins only.')}`);

  const form = await request.formData();
  const gate = String(form.get('gate') ?? '');
  const step = String(form.get('step') ?? 'preview'); // every action previews first now
  // A change made from a list view returns there; anything else lands on the project.
  const ret = String(form.get('return') ?? '');
  const dest = /^\/pipeline\/[\w/-]*(\?[\w=&%-]*)?$/.test(ret) ? ret : back;
  const note = String(form.get('note') ?? '').trim() || undefined;
  // Optional coordinator "reviewed copy" link, attached alongside a decision.
  const reviewUrl = String(form.get('review_url') ?? '').trim();
  if (reviewUrl && !isDocLink(reviewUrl)) {
    return redirect(`${back}?err=${encodeURIComponent(DOC_LINK_HINT)}`);
  }

  const { data: p0 } = await supabase.from('projects').select('*').eq('id', projectId).maybeSingle();
  if (!p0) return redirect('/pipeline/conferences');

  let rpc: { fn: string; args: Record<string, unknown> };
  let mail: null | {
    template: TransitionTemplate;
    venue?: string;
    stageLabel?: string;
    to: (string | null)[];
  } = null;
  let actionLabel = 'Update';

  if (gate === '1') {
    const conference = String(form.get('conference') ?? '');
    rpc = { fn: 'gate1_send_to_conference', args: { p_project: projectId, p_conference: conference, p_recycled_from: null } };
    mail = { template: 'conference_assigned', venue: conference, to: [p0.lead_id, p0.analyst_id] };
    actionLabel = `Send to ${conference || 'conference'}`;
  } else if (gate === '2') {
    const proceed = String(form.get('proceed') ?? 'yes') === 'yes';
    rpc = {
      fn: 'gate2_proceed',
      args: { p_project: projectId, p_proceed: proceed, p_archive_reason: proceed ? null : String(form.get('archive_reason') ?? 'other') },
    };
    mail = {
      template: proceed ? 'proceeding_full_text' : 'not_proceeding_full_text',
      to: [p0.lead_id, p0.analyst_id, p0.colead_id],
    };
    actionLabel = proceed ? 'Proceed to full text' : 'Not proceeding - close out';
  } else if (gate === 'journal-outcome') {
    const attempt = String(form.get('attempt') ?? '');
    const outcome = String(form.get('outcome') ?? '');
    const nextJournal = String(form.get('next_journal') ?? '').trim() || null;
    rpc = { fn: 'record_journal_outcome', args: { p_attempt: attempt, p_outcome: outcome, p_next_journal: nextJournal } };
    const template: TransitionTemplate =
      outcome === 'accepted' ? 'journal_accepted' : outcome === 'withdrawn' ? 'journal_withdrawn' : 'journal_rejected';
    mail = { template, venue: p0.current_journal ?? undefined, to: [p0.lead_id, p0.analyst_id] };
    actionLabel = `Journal outcome - ${outcome}`;
  } else if (gate === '3') {
    const journal = String(form.get('journal') ?? '');
    const murl = String(form.get('manuscript_url') ?? '').trim() || null;
    rpc = { fn: 'gate3_submit_to_journal', args: { p_project: projectId, p_journal: journal, p_url: murl } };
    mail = { template: 'submitted_to_journal', venue: journal, to: [p0.lead_id, p0.analyst_id] };
    actionLabel = `Submit to ${journal || 'journal'}`;
  } else if (gate === 'abstract') {
    const outcome = String(form.get('outcome') ?? '');
    const attempt = String(form.get('attempt') ?? '');
    rpc = { fn: 'record_abstract_outcome', args: { p_attempt: attempt, p_outcome: outcome, p_presenter: null } };
    mail = {
      template: outcome === 'accepted' ? 'abstract_accepted' : 'abstract_rejected',
      venue: p0.current_conference ?? undefined,
      to: [p0.lead_id, p0.analyst_id, p0.presenter_id],
    };
    actionLabel = `Abstract outcome - ${outcome}`;
  } else if (gate === 'stage') {
    const stage = String(form.get('stage') ?? '');
    const journal = String(form.get('journal') ?? '').trim();
    const stageLabel = stagesFor(p0.phase).find((s: any) => s.code === stage)?.label ?? stage;
    if (p0.phase === 'journal' && stage === 'submitted') {
      // A journal-phase "Submitted - technical check" also records which journal.
      if (!journal) return redirect(`${back}?err=${encodeURIComponent('Enter the journal name.')}`);
      rpc = { fn: 'set_submitted_journal', args: { p_project: projectId, p_journal: journal } };
      mail = { template: 'stage_update', venue: journal, stageLabel, to: [p0.lead_id, p0.analyst_id] };
    } else {
      rpc = { fn: 'advance_stage', args: { p_project: projectId, p_stage: stage } };
      mail = { template: 'stage_update', stageLabel, to: [p0.lead_id, p0.analyst_id, p0.colead_id] };
    }
    actionLabel = `Set status to ${stageLabel}`;
  } else if (gate === 'clear-reassignment') {
    // Administrative housekeeping, not a status change - applies directly, no email/preview.
    const { error } = await supabase.rpc('clear_reassignment_flag', { p_project: projectId });
    if (error) return redirect(`${dest}${dest.includes('?') ? '&' : '?'}err=${encodeURIComponent(error.message)}`);
    return redirect(`${dest}${dest.includes('?') ? '&' : '?'}ok=${encodeURIComponent('Flag cleared.')}`);
  } else if (gate === 'request-decide') {
    const requestId = String(form.get('request') ?? '');
    const approve = String(form.get('approve') ?? '') === 'yes';
    rpc = { fn: 'decide_stage_change', args: { p_request: requestId, p_approve: approve, p_note: note ?? null } };
    const { data: reqRow } = await supabase
      .from('stage_change_requests')
      .select('requested_by,from_phase,to_stage')
      .eq('id', requestId)
      .maybeSingle();
    const stageLabel = reqRow ? stagesFor(reqRow.from_phase).find((s: any) => s.code === reqRow.to_stage)?.label ?? reqRow.to_stage : '';
    mail = {
      template: approve ? 'request_approved' : 'request_declined',
      stageLabel,
      to: [reqRow?.requested_by ?? null],
    };
    actionLabel = `${approve ? 'Approve' : 'Decline'} status request`;
  } else {
    return redirect(`${back}?err=unknown+action`);
  }

  const to = await recipientsFor(supabase, mail.to);
  const subjectOverride = String(form.get('email_subject') ?? '').trim();
  const rendered = renderTransitionEmail({
    to,
    template: mail.template,
    projectTitle: p0.title,
    ref: p0.ref,
    venue: mail.venue,
    stageLabel: mail.stageLabel,
    actor: person.full_name,
    note,
    link: `${url.origin}${back}`,
  });
  const subject = subjectOverride || rendered.subject;

  if (step !== 'confirm') {
    // Carry every original field forward as a hidden input so "confirm" (or
    // "refresh preview") can rebuild the exact same rpc/mail plan above.
    const hidden: Record<string, string> = {};
    for (const [k, v] of form.entries()) {
      if (k === 'step' || k === 'email_subject' || k === 'note') continue;
      hidden[k] = String(v);
    }
    return html(
      previewPage({
        back,
        actionLabel,
        recipients: to,
        subject,
        bodyHtml: rendered.html,
        note: note ?? '',
        hidden,
      }),
    );
  }

  const { error } = await supabase.rpc(rpc.fn, rpc.args);
  if (error) {
    const sep = dest.includes('?') ? '&' : '?';
    return redirect(`${dest}${sep}err=${encodeURIComponent(error.message)}`);
  }

  // A reviewed-copy link travels with the abstract / gate-2 / journal decision.
  if (reviewUrl && ['abstract', '2', 'journal-outcome'].includes(gate)) {
    await supabase.rpc('attach_review_link', { p_project: projectId, p_url: reviewUrl });
  }

  let emailNote = '';
  if (to.length) {
    const sent = await sendEmail({ to, subject, html: rendered.html }).catch((e) => ({ ok: false, error: String(e) }));
    emailNote = sent.ok ? ` · emailed ${to.length}` : ' · email failed';
  } else {
    emailNote = ' · no recipients with a real email';
  }

  const sep = dest.includes('?') ? '&' : '?';
  return redirect(`${dest}${sep}ok=${encodeURIComponent('Done' + emailNote)}`);
};
