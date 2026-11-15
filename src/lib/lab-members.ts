/**
 * Is an email address on the lab's member list (the people table)? Used to
 * flag topic requests, letter requests and ideas from people who are not
 * part of the lab.
 */
import { supabaseAdmin } from './supabase';

const real = (e: string | null | undefined) => !!e && !e.endsWith('@import.invalid');

/** Every member email, lower-cased. Empty (and `ok: false`) if the list can't be read. */
export async function labEmailSet(): Promise<{ ok: boolean; emails: Set<string> }> {
  try {
    const { data, error } = await supabaseAdmin().from('people').select('email');
    if (error) return { ok: false, emails: new Set() };
    return { ok: true, emails: new Set((data ?? []).map((r: any) => String(r.email ?? '').toLowerCase()).filter(real)) };
  } catch {
    return { ok: false, emails: new Set() };
  }
}

/** true / false, or null when the list couldn't be checked (then say nothing). */
export async function isLabMember(email: string): Promise<boolean | null> {
  const e = email.trim().toLowerCase();
  if (!e) return null;
  try {
    const { data, error } = await supabaseAdmin().from('people').select('id').eq('email', e).limit(1);
    if (error) return null;
    return (data ?? []).length > 0;
  } catch {
    return null;
  }
}

/** The line added to the lab's notification email when the sender isn't a member. */
export const NOT_IN_LAB_TEXT = 'Not in the lab database: this email address is not on the MCA Heart member list, so the sender is not currently part of the lab.';
