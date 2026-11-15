/**
 * Email replies to contact / member requests (Review > Requests), with a
 * starting template for each kind of request. Sent replies are kept in
 * request_replies (mca-pipeline/add-request-replies.sql).
 */
import { supabaseAdmin } from './supabase';
import { esc, p, emailShell, RED, TEXT, FONT, FOOTER_ON_BEHALF } from './email-layout';
import type { RequestRecord } from './requests';

export type ReplyTemplate = { key: string; label: string; subject: string; body: string };

const LAB_EMAIL = 'researchlab@mcaheart.com';

/** Fill {name}, {first}, {purpose}, {deadline}, {topic}, {start}, {end} from the request. */
export function fillTemplate(text: string, r: RequestRecord): string {
  const name = (r.fullName || '').trim();
  const values: Record<string, string> = {
    name: name || 'there',
    first: name.split(/\s+/)[0] || 'there',
    purpose: (r as any).recPurpose?.trim() || 'your application',
    deadline: (r as any).recDeadline?.trim() || 'your deadline',
    topic: (r as any).topicArea?.trim() || 'the area you mentioned',
    start: (r as any).obsStart?.trim() || 'your proposed start date',
    end: (r as any).obsEnd?.trim() || 'your proposed end date',
  };
  return text.replace(/\{(name|first|purpose|deadline|topic|start|end)\}/g, (_, k) => values[k]);
}

const t = (key: string, label: string, subject: string, body: string): ReplyTemplate => ({ key, label, subject, body: body.trim() });

const GENERAL = t('general', 'Write my own', 'Your message to MCA Heart Research Lab', `
Dear {name},

Thank you for getting in touch with MCA Heart Research Lab.

[Write your reply here.]

Please reply to this email if you have any questions.`);

/** Templates for each kind of request, best match first. The signature is added to every email. */
export const TEMPLATES: Record<string, ReplyTemplate[]> = {
  collaborate: [
    t('collab-yes', 'Interested', 'Collaborating with MCA Heart Research Lab', `
Dear {name},

Thank you for reaching out, and for thinking of MCA Heart Research Lab. We read your message with interest and would be glad to explore working together.

To help us take this forward, could you reply with:
- the research question or project you have in mind
- the data, setting or resources involved
- your timeline and any target conference or journal

Once we have these, one of our Research Coordinators will arrange a short call with Dr. Alraies' team to agree on next steps.

We look forward to hearing from you.`),
    t('collab-no', 'Not right now', 'Your collaboration enquiry', `
Dear {name},

Thank you for reaching out and for your interest in working with MCA Heart Research Lab.

We have given your message careful thought. Our team is fully committed to ongoing projects at the moment, so we are not able to take on a new collaboration right now.

We would be glad to hear from you again in a few months, and we wish you every success with your work.`),
  ],
  recommendation: [
    t('lor-yes', 'Happy to write it', 'Your letter of recommendation', `
Dear {name},

Thank you for asking us for a letter of recommendation for {purpose}. We are glad to support you.

So that the letter reflects your work accurately, please reply with:
- your updated CV
- a short summary of the projects you worked on with the lab and your role in each
- how the letter should be submitted, including any portal link

We will aim to have it ready before {deadline}. If anything changes in the meantime, just let us know.`),
    t('lor-info', 'Need more details', 'Your letter of recommendation', `
Dear {name},

Thank you for your request for a letter of recommendation for {purpose}.

Before we can begin, we need a little more from you:
- your updated CV
- the projects you have contributed to with the lab, with your role in each
- the deadline and how the letter should be submitted

Once we have these, we will confirm the next steps.`),
    t('lor-no', 'Not able to', 'Your letter of recommendation', `
Dear {name},

Thank you for your request for a letter of recommendation for {purpose}, and for your work with the lab.

Our letters are written for members who have contributed to completed projects, so we are not able to provide one at this stage. We would encourage you to keep contributing to ongoing projects, and you are very welcome to ask again once you have.

We wish you the very best with your application.`),
  ],
  topic: [
    t('topic-yes', 'Will find a project', 'Joining a new topic', `
Dear {name},

Thank you for letting us know you would like to take on a new topic in {topic}. We really appreciate your enthusiasm.

A Research Coordinator will match you with a suitable project and share the details with you shortly, including the lead and the next deadline.`),
    t('topic-wait', 'Nothing open yet', 'Joining a new topic', `
Dear {name},

Thank you for letting us know you would like to take on a new topic in {topic}.

We do not have an open project in this area just now, but we have noted your interest and will contact you as soon as a suitable one comes up.`),
  ],
  observership: [
    t('obs-review', 'Received, reviewing', 'Your observership request', `
Dear {name},

Thank you for your interest in an observership with Dr. Alraies. We have received your request for {start} to {end}.

Observership places are limited and depend on availability and hospital approval. We will review your request and come back to you with the next steps. In the meantime, please make sure your CV is up to date in case we need it.`),
    t('obs-no', 'Not available', 'Your observership request', `
Dear {name},

Thank you for your interest in an observership with Dr. Alraies.

Unfortunately, we are not able to offer an observership for {start} to {end}, as places are very limited. You are welcome to contact us again about a later date.

We wish you all the best with your training.`),
  ],
  trending: [
    t('trend-yes', 'Would love to', 'Appearing on Heart Trending', `
Dear {name},

Thank you for your interest in appearing on Heart Trending. We enjoyed reading your message and would love to have you on the show.

Could you reply with:
- the topic you would like to discuss
- a short bio
- a few dates and times that suit you over the coming weeks

We will then confirm the details with you.`),
    t('trend-no', 'Not this time', 'Appearing on Heart Trending', `
Dear {name},

Thank you for your interest in appearing on Heart Trending.

Our upcoming episodes are already planned, so we are not able to schedule this at the moment. We will keep your details and reach out if a suitable slot opens up.`),
  ],
  other: [],
};

/** The templates to offer for one request: its own first, then "write my own". */
export function templatesFor(r: RequestRecord): ReplyTemplate[] {
  return [...(TEMPLATES[r.intent] ?? []), GENERAL];
}

/** The email as it will be sent: the typed text (blank lines start a new
 *  paragraph, lines starting with "- " become a list), then the lab's signature. */
export function renderReplyEmail(body: string): string {
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
    p('Warm regards,', 'margin:26px 0 6px') +
    `<p style="margin:0;color:${TEXT};font-family:${FONT};font-size:14px;line-height:1.55"><strong>Operations Team</strong><br>MCA Heart Research Lab<br><a href="mailto:${LAB_EMAIL}" style="color:${RED}">${LAB_EMAIL}</a></p>`;
  return emailShell(blocks.join('') + signature, FOOTER_ON_BEHALF);
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
