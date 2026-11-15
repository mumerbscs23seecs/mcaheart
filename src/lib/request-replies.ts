/**
 * Email replies to contact / member requests (Review > Requests), with a
 * template library in request-templates.ts. Sent replies are kept in
 * request_replies (mca-pipeline/add-request-replies.sql).
 */
import { supabaseAdmin } from './supabase';
import { esc, p, emailShell, RED, TEXT, FONT, FOOTER_ON_BEHALF } from './email-layout';

const LAB_EMAIL = 'researchlab@mcaheart.com';

/** The email around a typed reply: paragraphs, "- " bullet lists, links, and (unless turned off) the Operations Team signature. */
export function renderReplyEmail(body: string, opts: { formal?: boolean; signature?: boolean } = {}): string {
  const linkify = (h: string) =>
    h.replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)]/g, (u) => `<a href="${u}" style="color:${RED}">${u}</a>`);
  const blocks = body
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => {
      const lines = b.split('\n');
      const intro = lines.filter((l) => !/^\s*[-•]\s+/.test(l));
      const items = lines.filter((l) => /^\s*[-•]\s+/.test(l));
      if (!items.length) return p(linkify(esc(b)).replace(/\n/g, '<br>'));
      const head = intro.length ? p(linkify(esc(intro.join('\n'))).replace(/\n/g, '<br>'), 'margin-bottom:8px') : '';
      const list = `<ul style="margin:0 0 18px;padding-left:22px;color:${TEXT};font-family:${FONT};font-size:14px;line-height:1.6">${items
        .map((l) => `<li style="margin:0 0 4px">${linkify(esc(l.replace(/^\s*[-•]\s+/, '')))}</li>`)
        .join('')}</ul>`;
      return head + list;
    });
  const signature =
    p(opts.formal ? 'Sincerely,' : 'Warm regards,', 'margin:26px 0 6px') +
    `<p style="margin:0;color:${TEXT};font-family:${FONT};font-size:14px;line-height:1.55"><strong>Operations Team</strong><br>MCA Heart Research Lab<br><a href="mailto:${LAB_EMAIL}" style="color:${RED}">${LAB_EMAIL}</a></p>`;
  return emailShell(blocks.join('') + (opts.signature === false ? '' : signature), FOOTER_ON_BEHALF);
}

export type SentReply = { id: string; request_id: string; sent_at: string; sent_by: string; to_email: string; subject: string; body: string };

/** Replies for every request, newest first. `ready` is false until the SQL has been run. */
export async function listReplies(): Promise<{ ready: boolean; byRequest: Map<string, SentReply[]> }> {
  const byRequest = new Map<string, SentReply[]>();
  const { data, error } = await supabaseAdmin()
    .from('request_replies')
    .select('id,request_id,sent_at,sent_by,to_email,subject,body')
    .order('sent_at', { ascending: false });
  if (error) return { ready: false, byRequest };
  for (const r of (data ?? []) as SentReply[]) byRequest.set(r.request_id, [...(byRequest.get(r.request_id) ?? []), r]);
  return { ready: true, byRequest };
}

export async function recordReply(row: Omit<SentReply, 'id' | 'sent_at'> & { template: string | null }): Promise<string | null> {
  const { error } = await supabaseAdmin().from('request_replies').insert(row);
  return error ? error.message : null;
}
