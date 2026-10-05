import { defineMiddleware } from 'astro:middleware';
import { getPipelineSession } from './lib/pipeline-auth';
import { setRequestUser } from './lib/auth';

/** Signed-in areas. /login is resolved too, so a signed-in visitor is sent on. */
const GATED = ['/admin', '/pipeline', '/account'];
const PASSWORD_PAGE = '/account/password';

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, request, cookies, redirect, locals } = context;
  const path = url.pathname;
  const gated = GATED.some((p) => path === p || path.startsWith(p + '/'));
  if (!gated && path !== '/login') return next();

  const session = await getPipelineSession(request, cookies);

  if (session) {
    const { person } = session;
    setRequestUser(cookies, {
      id: person.id,
      name: person.full_name,
      email: person.email,
      role: person.role === 'admin' ? 'admin' : 'member',
    });
    locals.supabase = session.supabase;
    locals.person = person;
    // A shared starting password must be replaced before anything else works.
    if (gated && session.mustChangePassword && path !== PASSWORD_PAGE) {
      return redirect(`${PASSWORD_PAGE}?first=1`);
    }
  } else if (gated) {
    return redirect(`/login?next=${encodeURIComponent(path + url.search)}`);
  }

  const res = await next();
  // Signed-in data changes on every action - never let a browser (or its
  // back/forward cache) show a stale copy after a change.
  if (gated) res.headers.set('Cache-Control', 'no-store, must-revalidate');
  return res;
});
