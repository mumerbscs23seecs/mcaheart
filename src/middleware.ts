import { defineMiddleware } from 'astro:middleware';
import { getPipelineSession, bridgeAdminSession } from './lib/pipeline-auth';
import { currentUser as inMemoryUser } from './lib/auth';

/** Gate every /pipeline route. Preferred path: the visitor is already signed
 *  into the members area - bridgeAdminSession() gives them a Supabase session
 *  transparently. Magic-link (/pipeline/login) stays as a fallback. */
export const onRequest = defineMiddleware(async (context, next) => {
  const { url, request, cookies, redirect, locals } = context;

  if (!url.pathname.startsWith('/pipeline')) return next();
  if (url.pathname === '/pipeline/login' || url.pathname.startsWith('/pipeline/auth/')) return next();

  const inMem = inMemoryUser(cookies);
  let session = await getPipelineSession(request, cookies);

  // A Supabase session left behind by a *different* person (the members-area
  // "Log out" only clears the in-memory session) would otherwise be trusted
  // here. If it doesn't match who is signed into the members area, drop it and
  // re-bridge from the current in-memory identity.
  if (session && inMem && session.person.email.toLowerCase() !== inMem.email.toLowerCase()) {
    await session.supabase.auth.signOut();
    session = null;
  }

  session = session ?? (await bridgeAdminSession(request, cookies));

  if (!session) {
    return redirect(`/login?next=${encodeURIComponent(url.pathname + url.search)}`);
  }

  locals.supabase = session.supabase;
  locals.person = session.person;

  // Pipeline data changes on every gate action - never let a browser (or its
  // back/forward cache) show a stale copy after a change.
  const res = await next();
  res.headers.set('Cache-Control', 'no-store, must-revalidate');
  return res;
});
