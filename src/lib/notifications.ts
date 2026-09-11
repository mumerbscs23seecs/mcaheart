/**
 * Notification inbox for the members-area top bar (AppLayout).
 *
 * The notifications table lives in Supabase (created by mca-pipeline/requests.sql)
 * and is written by the pipeline's security-definer functions. The members area
 * runs on the in-memory session, not a Supabase one, so we read here with the
 * service-role client filtered by the person's own id. Never exposed to the
 * browser.
 */
import { supabaseAdmin } from './supabase';

export interface Notif {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

async function personId(email: string): Promise<string | null> {
  const admin = supabaseAdmin();
  const { data } = await admin.from('people').select('id').eq('email', email.toLowerCase()).maybeSingle();
  return data?.id ?? null;
}

export async function getNotifications(email: string): Promise<{ items: Notif[]; unread: number }> {
  try {
    const id = await personId(email);
    if (!id) return { items: [], unread: 0 };
    const { data } = await supabaseAdmin()
      .from('notifications')
      .select('id,kind,title,body,link,read_at,created_at')
      .eq('recipient_id', id)
      .order('created_at', { ascending: false })
      .limit(20);
    const items = (data ?? []) as Notif[];
    return { items, unread: items.filter((n) => !n.read_at).length };
  } catch {
    // requests.sql not run yet, or no service key - degrade to no inbox.
    return { items: [], unread: 0 };
  }
}

export async function markAllNotificationsRead(email: string): Promise<number> {
  try {
    const id = await personId(email);
    if (!id) return 0;
    const { data } = await supabaseAdmin()
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_id', id)
      .is('read_at', null)
      .select('id');
    return (data ?? []).length;
  } catch {
    return 0;
  }
}
