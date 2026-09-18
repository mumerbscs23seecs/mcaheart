import type { APIRoute } from 'astro';
import { contactSchema, OBS_CV } from '../../lib/contact-schema';
import { clientIp, rateLimit } from '../../lib/rate-limit';
import { deliverEnquiry } from '../../lib/mailer';
import type { Attachment } from '../../lib/email';
import { addRequest, type StoredFile } from '../../lib/requests';

// Runs on demand rather than being prerendered with the rest of the site.
export const prerender = false;

/** Attach to the notification email only when comfortably under Gmail's 25 MB. */
const EMAIL_ATTACH_MAX = 8 * 1024 * 1024;

const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

export const POST: APIRoute = async ({ request }) => {
  // --- 1. Throttle -------------------------------------------------------
  const limit = rateLimit(clientIp(request));
  if (!limit.ok) {
    return json(
      { ok: false, error: 'Too many submissions. Please try again later.' },
      429,
      { 'Retry-After': String(limit.retryAfterSec) },
    );
  }

  // --- 2. Parse ------------------------------------------------------------
  // Always multipart now (the observership panel can carry a CV), with a
  // JSON fallback kept for any non-browser caller that still posts JSON.
  let form: FormData | null = null;
  let raw: Record<string, unknown>;
  const contentType = request.headers.get('content-type') ?? '';

  try {
    if (contentType.includes('application/json')) {
      raw = await request.json();
    } else {
      form = await request.formData();
      raw = Object.fromEntries(
        Array.from(form.entries()).filter(([, v]) => typeof v === 'string'),
      );
    }
  } catch {
    return json({ ok: false, error: 'Could not read that request.' }, 400);
  }

  // --- 3. Validate -------------------------------------------------------
  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? '_');
      fieldErrors[key] ??= issue.message;
    }
    return json({ ok: false, error: 'Please check the highlighted fields.', fieldErrors }, 422);
  }

  // Honeypot tripped - accept silently so bots get no signal.
  if (parsed.data.company) {
    return json({ ok: true, message: 'Thank you - your enquiry has been received.' });
  }

  // --- 4. Optional CV (observership only) ---------------------------------
  let cv: StoredFile | null = null;
  if (form) {
    const f = form.get(OBS_CV.field);
    if (f instanceof File && f.size > 0) {
      if (f.size > OBS_CV.maxBytes) {
        return json(
          {
            ok: false,
            error: 'Please check the highlighted fields.',
            fieldErrors: { obsCv: `That file is over ${Math.round(OBS_CV.maxBytes / 1024 / 1024)} MB.` },
          },
          422,
        );
      }
      const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
      if (!OBS_CV.extensions.includes(ext as never)) {
        return json(
          {
            ok: false,
            error: 'Please check the highlighted fields.',
            fieldErrors: { obsCv: `Accepted types: ${OBS_CV.extensions.join(', ')}` },
          },
          422,
        );
      }
      cv = {
        filename: f.name,
        mime: f.type || 'application/octet-stream',
        size: f.size,
        bytes: Buffer.from(await f.arrayBuffer()),
      };
    }
  }

  // --- 5. Save (kept in memory - shows up under Admin → Requests) --------
  addRequest(parsed.data, cv);

  // --- 6. Deliver ----------------------------------------------------------
  const attachments: Attachment[] | undefined = cv
    ? cv.bytes.byteLength <= EMAIL_ATTACH_MAX
      ? [{ filename: cv.filename, content: cv.bytes.toString('base64') }]
      : undefined
    : undefined;
  const cvTooLarge = !!cv && !attachments;

  // Record is saved above either way - don't make the confirmation message
  // wait on SMTP (Gmail auth failure + Resend fallback can take seconds).
  deliverEnquiry(parsed.data, { attachments, cvFilename: cv?.filename, cvTooLarge }).catch((err) => {
    console.error('[contact] email failed (record kept):', err);
  });

  return json({
    ok: true,
    message: 'Thank you - your enquiry has been received. We will be in touch shortly.',
  });
};

// Anything other than POST.
export const ALL: APIRoute = () =>
  json({ ok: false, error: 'Method not allowed.' }, 405, { Allow: 'POST' });
