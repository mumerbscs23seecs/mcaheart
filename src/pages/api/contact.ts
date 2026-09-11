import type { APIRoute } from 'astro';
import { contactSchema } from '../../lib/contact-schema';
import { clientIp, rateLimit } from '../../lib/rate-limit';
import { deliverEnquiry } from '../../lib/mailer';

// Runs on demand rather than being prerendered with the rest of the site.
export const prerender = false;

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

  // --- 2. Parse ----------------------------------------------------------
  let raw: unknown;
  const contentType = request.headers.get('content-type') ?? '';

  try {
    if (contentType.includes('application/json')) {
      raw = await request.json();
    } else {
      // Fallback for a no-JS native form POST.
      raw = Object.fromEntries(await request.formData());
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

  // --- 4. Deliver --------------------------------------------------------
  try {
    await deliverEnquiry(parsed.data);
  } catch (err) {
    console.error('[contact] delivery failed:', err);
    return json(
      { ok: false, error: 'We could not send that just now. Please email us directly.' },
      502,
    );
  }

  return json({
    ok: true,
    message: 'Thank you - your enquiry has been received. We will be in touch shortly.',
  });
};

// Anything other than POST.
export const ALL: APIRoute = () =>
  json({ ok: false, error: 'Method not allowed.' }, 405, { Allow: 'POST' });
