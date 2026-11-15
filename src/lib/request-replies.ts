/**
 * Email replies to contact / member requests (Review > Requests), with a
 * starting template for each kind of request. Sent replies are kept in
 * request_replies (mca-pipeline/add-request-replies.sql).
 */
import { supabaseAdmin } from './supabase';
import { esc, p, emailShell, RED, FOOTER_ON_BEHALF } from './email-layout';
import type { RequestRecord } from './requests';

export type ReplyTemplate = { key: string; label: string; subject: string; body: string };

const SIGN_OFF = 'Best regards,\nOperations Team\nMCA Heart Research Lab';

/** Fill {name}, {purpose}, {deadline}, {topic}, {start}, {end} from the request. */
export function fillTemplate(text: string, r: RequestRecord): string {
  const first = (r.fullName || '').trim().split(/\s+/)[0] || 'there';
  const values: Record<string, string> = {
    name: (r.fullName || '').trim() || 'there',
    first,
    purpose: (r as any).recPurpose?.trim() || 'your application',
    deadline: (r as any).recDeadline?.trim() || 'your deadline',
    topic: (r as any).topicArea?.trim() || 'the area you mentioned',
    start: (r as any).obsStart?.trim() || 'your start date',
    end: (r as any).obsEnd?.trim() || 'your end date',
  };
  return text.replace(/\{(name|first|purpose|deadline|topic|start|end)\}/g, (_, k) => values[k]);
}

const t = (key: string, label: string, subject: string, body: string): ReplyTemplate => ({
  key, label, subject, body: `${body.trim()}\n\n${SIGN_OFF}`,
});

const BLANK = t('blank', 'Blank reply', 'Re: your message to MCA Heart Research Lab', `Dear {name},\n\n`);

const GENERAL = t(
  'general', 'General reply',
  'Re: your message to MCA Heart Research Lab',
  `Dear {name},

Thank you for contacting MCA Heart Research Lab. We have received your message and read it carefully.

[Write your reply here.]

If you have any further questions, please reply to this email.`,
);

/** Templates offered for each kind of request, best match first. */
export const TEMPLATES: Record<string, ReplyTemplate[]> = {
  collaborate: [
    t('collab-yes', 'Interested, ask for details',
      'Your collaboration enquiry - MCA Heart Research Lab',
      `Dear {name},

Thank you for reaching out to MCA Heart Research Lab about a possible collaboration. We have read your message and would be glad to explore it further.

Could you share a little more about the project you have in mind: the research question, the data or resources involved, and your expected timeline? Once we have these details, a Research Coordinator will be in touch to arrange a short call.`),
    t('collab-no', 'Not able to take it on',
      'Your collaboration enquiry - MCA Heart Research Lab',
      `Dear {name},

Thank you for reaching out to MCA Heart Research Lab about a possible collaboration, and for your interest in working with us.

After reviewing your message, we are unfortunately not able to take on this collaboration at the moment, as our current projects and team capacity are fully committed. We would be happy to hear from you again in the future.

We wish you every success with your work.`),
  ],
  recommendation: [
    t('lor-yes', 'Happy to write it',
      'Your letter of recommendation request',
      `Dear {name},

Thank you for your request for a letter of recommendation for {purpose}. We are glad to support you.

To help us prepare the letter, please reply with your updated CV, your personal statement or a short summary of what you would like the letter to highlight, and any submission instructions or portal links. We will do our best to have the letter ready before {deadline}.`),
    t('lor-info', 'Need more information',
      'Your letter of recommendation request',
      `Dear {name},

Thank you for your request for a letter of recommendation for {purpose}.

Before we can move forward, we need a little more information. Please reply with your updated CV, a summary of the projects you have contributed to with the lab, and the deadline and submission instructions for the letter.`),
    t('lor-no', 'Unable to write it',
      'Your letter of recommendation request',
      `Dear {name},

Thank you for your request for a letter of recommendation for {purpose}.

After reviewing your work with the lab so far, we are unfortunately not able to provide a letter at this time. Letters are written for members who have contributed to completed projects with the lab. We encourage you to keep contributing, and you are welcome to request a letter again in the future.`),
  ],
  topic: [
    t('topic-yes', 'Will add them to a topic',
      'Joining a new topic',
      `Dear {name},

Thank you for letting us know you would like to join a new topic in {topic}. We appreciate your interest in taking on more work with the lab.

A Research Coordinator will match you with a suitable project and share the details with you shortly.`),
    t('topic-wait', 'Nothing open right now',
      'Joining a new topic',
      `Dear {name},

Thank you for letting us know you would like to join a new topic in {topic}.

We do not have an open project in this area right now, but we have noted your interest and will reach out as soon as a suitable one becomes available.`),
  ],
  observership: [
    t('obs-next', 'Received, will review',
      'Your observership request',
      `Dear {name},

Thank you for your interest in an observership with Dr. Alraies. We have received your request for {start} to {end}.

Observership places are limited and depend on availability and approval, so we will review your request and get back to you with the next steps. Please make sure your CV is up to date in case we need it.`),
    t('obs-no', 'Not available for those dates',
      'Your observership request',
      `Dear {name},

Thank you for your interest in an observership with Dr. Alraies.

Unfortunately, we are not able to offer an observership for {start} to {end}. Places are very limited. You are welcome to contact us again for a later date.`),
  ],
  trending: [
    t('trend-yes', 'Interested in having them on',
      'Appearing on Heart Trending',
      `Dear {name},

Thank you for your interest in appearing on Heart Trending. We enjoyed reading your message and would like to explore having you on the show.

Could you reply with the topic you would like to discuss, a short bio, and a few dates and times that suit you over the coming weeks? We will then confirm the details.`),
    t('trend-no', 'Not at this time',
      'Appearing on Heart Trending',
      `Dear {name},

Thank you for your interest in appearing on Heart Trending.

Our upcoming episodes are already planned, so we are not able to schedule this at the moment. We will keep your details on file and reach out if a suitable slot opens up.`),
  ],
  other: [],
};

/** The templates to offer for one request: its own, then the general ones. */
export function templatesFor(r: RequestRecord): ReplyTemplate[] {
  return [...(TEMPLATES[r.intent] ?? []), GENERAL, BLANK];
}

/** The email as it will be sent: the typed text, paragraph by paragraph, in the lab's frame. */
export function renderReplyEmail(body: string): string {
  const linkify = (h: string) =>
    h.replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)]/g, (u) => `<a href="${u}" style="color:${RED}">${u}</a>`);
  const paras = body
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => p(linkify(esc(para)).replace(/\n/g, '<br>')));
  return emailShell(paras.join(''), FOOTER_ON_BEHALF);
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
