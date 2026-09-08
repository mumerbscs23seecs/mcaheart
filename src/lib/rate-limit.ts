/**
 * Fixed-window rate limiter, in-process.
 *
 * Adequate for a single-instance Node deployment. If this is ever run across
 * multiple instances, swap the Map for Redis/Upstash — the interface stays the
 * same.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_HITS = 20; // shared across the contact / idea / recruitment forms
const DISABLED = import.meta.env.DEV; // off in local dev so testing isn't blocked

/** Drop expired buckets so the Map cannot grow without bound. */
function sweep(now: number) {
  if (buckets.size < 500) return;
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key);
  }
}

export function rateLimit(key: string): {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
} {
  if (DISABLED) return { ok: true, remaining: MAX_HITS, retryAfterSec: 0 };

  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true, remaining: MAX_HITS - 1, retryAfterSec: 0 };
  }

  existing.count += 1;

  if (existing.count > MAX_HITS) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  return { ok: true, remaining: MAX_HITS - existing.count, retryAfterSec: 0 };
}

/** Best-effort client IP from common proxy headers. */
export function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return (
    request.headers.get('x-real-ip') ??
    request.headers.get('cf-connecting-ip') ??
    'unknown'
  );
}
