import type { APIRoute } from 'astro';
import { recruitmentSchema, UPLOADS } from '../../lib/recruitment-schema';
import { clientIp, rateLimit } from '../../lib/rate-limit';
import { addApplication, type StoredFile } from '../../lib/applications';
import { deliverApplication } from '../../lib/recruitment-mailer';
import type { Attachment } from '../../lib/email';

export const prerender = false;

/** Attach to the notification email only when comfortably under Gmail's 25 MB. */
const EMAIL_ATTACH_MAX = 8 * 1024 * 1024;

const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

type Slot = keyof typeof UPLOADS;

async function readFile(
  form: FormData,
  slot: Slot,
): Promise<{ file: StoredFile | null; error?: string }> {
  const spec = UPLOADS[slot];
  const f = form.get(spec.field);
  if (!(f instanceof File) || f.size === 0) return { file: null };
  if (f.size > spec.maxBytes) {
    return { file: null, error: `That file is over ${Math.round(spec.maxBytes / 1024 / 1024)} MB.` };
  }
  const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
  if (!spec.extensions.includes(ext as never)) {
    return { file: null, error: `Accepted types: ${spec.extensions.join(', ')}` };
  }
  const bytes = Buffer.from(await f.arrayBuffer());
  return { file: { filename: f.name, mime: f.type || 'application/octet-stream', size: f.size, bytes } };
}

export const POST: APIRoute = async ({ request }) => {
  const limit = rateLimit(clientIp(request));
  if (!limit.ok) {
    return json({ ok: false, error: 'Too many submissions. Please try again later.' }, 429, {
      'Retry-After': String(limit.retryAfterSec),
    });
  }

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
    name: str('name'),
    email: str('email'),
    gradYear: str('gradYear'),
    jobStatus: str('jobStatus'),
    fellowshipPlan: str('fellowshipPlan'),
    researchExperience: str('researchExperience'),
    letterOfInterest: str('letterOfInterest'),
    expertise: str('expertise'),
    profileLink: str('profileLink'),
    currentStatus: str('currentStatus'),
    professionalGoals: str('professionalGoals'),
    internalRef: str('internalRef'),
    referralSource: str('referralSource'),
    whatsapp: str('whatsapp'),
    company: form.get('company') ?? undefined,
  };

  const parsed = recruitmentSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? '_');
      fieldErrors[key] ??= issue.message;
    }
    return json({ ok: false, error: 'Please check the highlighted fields.', fieldErrors }, 422);
  }

  if (parsed.data.company) {
    return json({ ok: true, message: 'Thank you - your application has been received.' });
  }

  // --- Files (both required) ------------------------------------------------
  const fieldErrors: Record<string, string> = {};
  const cvRes = await readFile(form, 'cv');
  const hsRes = await readFile(form, 'headshot');
  if (cvRes.error) fieldErrors.cv = cvRes.error;
  else if (!cvRes.file) fieldErrors.cv = 'Attach your CV (PDF or Word).';
  if (hsRes.error) fieldErrors.headshot = hsRes.error;
  else if (!hsRes.file) fieldErrors.headshot = 'Attach a recent headshot.';
  if (Object.keys(fieldErrors).length) {
    return json({ ok: false, error: 'Please check the highlighted fields.', fieldErrors }, 422);
  }

  // --- Save (files held in memory) ---------------------------------------
  addApplication(parsed.data, { cv: cvRes.file, headshot: hsRes.file });

  // --- Notify ----------------------------------------------------------
  const attachments: Attachment[] = [];
  const filesInPanel: string[] = [];
  for (const f of [cvRes.file!, hsRes.file!]) {
    if (f.size <= EMAIL_ATTACH_MAX) {
      attachments.push({ filename: f.filename, content: f.bytes.toString('base64') });
    } else {
      filesInPanel.push(f.filename);
    }
  }
  try {
    await deliverApplication(parsed.data, { attachments, filesInPanel });
  } catch (err) {
    console.error('[recruitment] email failed (record kept):', err);
  }

  return json({
    ok: true,
    message:
      'Thank you - your application has been submitted. You will get an email with the outcome, usually within five days. No response within three weeks? Email researchoperations@mcaheart.com.',
  });
};

export const ALL: APIRoute = () => json({ ok: false, error: 'Method not allowed.' }, 405, { Allow: 'POST' });
