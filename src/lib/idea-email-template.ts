/**
 * The idea-outcome letter, kept free of server-only imports so the admin
 * Ideas page can also run it in the browser for its live preview.
 */
import { esc, p, infoBox, emailShell, FONT, RED, TEXT, MUTED } from './email-layout';

/** The four boxes on the lab's idea-outcome template. */
export type IdeaOutcome = 'approved' | 'rejected' | 'modify' | 'details';
export const OUTCOME_LABEL: Record<IdeaOutcome, string> = {
  approved: 'Idea approved for further work',
  rejected: 'Idea rejected',
  modify: 'Modifications suggested',
  details: 'Further details requested',
};

export interface IdeaDecisionOpts {
  to: string;
  title: string;
  /** The ticked box. */
  outcome: IdeaOutcome;
  /** The explanation shown under the boxes. */
  note: string | null;
  cc?: string[];
  bcc?: string[];
}

const BOXES: IdeaOutcome[] = ['approved', 'rejected', 'modify', 'details'];

/** The lab's idea-outcome letter: thanks, then the four boxes with the
 *  decision ticked, the explanation, and the manuscript timeline. */
export function renderIdeaDecisionEmail(opts: IdeaDecisionOpts): { subject: string; html: string } {
  const subject = `Update on your submitted idea: ${opts.title}`;
  const label = (text: string) => `<strong style="color:#1a1a1a">${text}</strong>`;

  const boxes =
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 0">` +
    BOXES.map((b) => {
      const on = b === opts.outcome;
      return `<tr>
        <td style="width:26px;padding:3px 0;vertical-align:top;font-family:${FONT};font-size:15px;line-height:1.5;color:${on ? RED : MUTED}">${on ? '&#10003;' : '&#9744;'}</td>
        <td style="padding:3px 0;font-family:${FONT};font-size:14px;line-height:1.6;color:${TEXT};${on ? 'font-weight:700' : ''}">${OUTCOME_LABEL[b]}</td>
      </tr>`;
    }).join('') +
    `</table>`;

  const explanation = opts.note?.trim()
    ? `<span style="white-space:pre-wrap;font-weight:700;color:#1a1a1a">${esc(opts.note.trim())}</span>`
    : '-';

  const inner =
    p('Dear Author,') +
    p(`Thank you for submitting your idea "<strong>${esc(opts.title)}</strong>" to the MCA Heart Research Lab. We evaluate ideas based on clinical relevance, methodological practicality, and publication value. Any relevant comments and the outcome of your idea submission are at the bottom of this email.`) +
    p('Best regards,<br>MCA Heart Research Lab') +
    `<div style="margin:4px 0 24px;padding-top:22px;border-top:1px solid #eeeeee">` +
    p(`${label('Comments:')}${boxes}`) +
    p(`${label('Explanation:')}<br>${explanation}`) +
    `</div>` +
    infoBox(
      `<strong>Important instructions:</strong><br>If your idea is accepted for further processing, the lead author must complete and provide the full manuscript within 1 month from the date the analysis is provided. Failure to follow this timeline may result in the lead author's demotion from first authorship and the lab will appoint a new lead.`,
    );

  return { subject, html: emailShell(inner, '') };
}
