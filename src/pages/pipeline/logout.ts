import type { APIRoute } from 'astro';
import { supabaseForRequest } from '../../lib/supabase';
import { endSession } from '../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const supabase = supabaseForRequest(request, cookies);
  await supabase.auth.signOut();
  endSession(cookies);
  return redirect('/login');
};

export const GET: APIRoute = (ctx) => POST(ctx);
