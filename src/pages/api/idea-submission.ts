import type { APIRoute } from 'astro';
import { ideaSchema, DATABASES, UPLOAD, type Database } from '../../lib/idea-schema';
import { clientIp, rateLimit } from '../../lib/rate-limit';
import { deliverIdea, type Attachment } from '../../lib/idea-mailer';
import { addIdea } from '../../lib/ideas';

export const prerender = false;

const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

export const POST: APIRoute = async ({ request }) => {
  // --- 1. Throttle -----------------------------------------------------------
  const limit = rateLimit(clientIp(request));
  if (!limit.ok) {
    return json(
      { ok: false, error: 'Too many submissions. Please try again later.' },
      429,
      { 'Retry-After': String(limit.retryAfterSec) },
    );
  }

  // --- 2. Parse (always multipart from the form) ----------------------------
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: 'Could not read that submission.' }, 400);
  }

  const str = (name: string) => {
    const v = form.get(name);
    return typeof v === 'string' ? v : '';
  };
  const raw = {
    leadEmail: str('leadEmail'),
    contactNumber: str('contactNumber'),
    title: str('title'),
    leadName: str('leadName'),
    researchType: str('researchType'),
    population: str('population'),
    intervention: str('intervention'),
    comparison: str('comparison'),
    outcomes: str('outcomes'),
    rationale: str('rationale'),
    conference: str('conference'),
    commitment: str('commitment'),
    // Database-only
    databases: form.getAll('databases').filter((v): v is Database => DATABASES.includes(v as Database)),
    studyDesign: str('studyDesign'),
    priorStudies: str('priorStudies'),
    latestStudy: str('latestStudy'),
    // Meta-analysis-only
    previousMetaDate: str('previousMetaDate'),
    newStudies: str('newStudies'),
    sampleSizeIncrease: str('sampleSizeIncrease'),
    company: form.get('company') ?? undefined,
  };

  // --- 3. Validate ---------------------------------------------------------
  const parsed = ideaSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? '_');
      fieldErrors[key] ??= issue.message;
    }
    return json({ ok: false, error: 'Please check the highlighted fields.', fieldErrors }, 422);
  }

  // Honeypot tripped - accept silently.
  if (parsed.data.company) {
    return json({ ok: true, message: 'Thank you - your research idea has been received.' });
  }

  // --- 4. Optional file --------------------------------------------------
  let attachment: Attachment | undefined;
  const file = form.get('supportingDoc');
  if (file instanceof File && file.size > 0) {
    if (file.size > UPLOAD.maxBytes) {
      return json(
        { ok: false, error: 'That file is over 10 MB.', fieldErrors: { supportingDoc: 'Maximum size is 10 MB.' } },
        422,
      );
    }
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!UPLOAD.extensions.includes(ext as (typeof UPLOAD.extensions)[number])) {
      return json(
        {
          ok: false,
          error: 'That file type is not accepted.',
          fieldErrors: { supportingDoc: `Accepted: ${UPLOAD.extensions.join(', ')}` },
        },
        422,
      );
    }
    const buf = Buffer.from(await file.arrayBuffer());
    attachment = { filename: file.name, content: buf.toString('base64') };
  }

  // --- 5. Save, then deliver in the background ---------------------------
  // The record is saved either way, so the confirmation message shouldn't
  // wait on SMTP (Gmail's auth failure + Resend fallback can take several
  // seconds) - fire the email and respond immediately.
  addIdea(parsed.data, attachment?.filename ?? null);
  deliverIdea(parsed.data, attachment).catch((err) => {
    console.error('[idea] email delivery failed (record kept):', err);
  });

  return json({
    ok: true,
    message:
      'Thank you - your research idea has been submitted. The team will review it for feasibility and publication value and follow up about next steps.',
  });
};

export const ALL: APIRoute = () =>
  json({ ok: false, error: 'Method not allowed.' }, 405, { Allow: 'POST' });
