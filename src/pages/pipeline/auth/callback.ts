import type { APIRoute } from 'astro';
import { supabaseForRequest, supabaseAdmin } from '../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async ({ request, cookies, url, redirect }) => {
  const tokenHash = url.searchParams.get('token_hash');
  if (!tokenHash) return redirect('/pipeline/login?error=missing');

  const supabase = supabaseForRequest(request, cookies);
  const { error } = await supabase.auth.verifyOtp({ type: 'email', token_hash: tokenHash });
  if (error) return redirect('/pipeline/login?error=expired');

  // Session cookies are now set. Link the auth user to its invited people row.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.email) {
    await supabaseAdmin()
      .from('people')
      .update({ auth_id: user.id })
      .eq('email', user.email)
      .is('auth_id', null);
  }

  const next = url.searchParams.get('next');
  return redirect(next && next.startsWith('/pipeline') ? next : '/pipeline');
};
