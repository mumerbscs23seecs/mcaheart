import { sendEmail } from './email';
import { esc, p, heading, button, link, emailShell } from './email-layout';

/**
 * Account-access emails (invite a new member / resend a set-password link),
 * sent from researchlab@ through src/lib/email.ts.
 */
export async function deliverAccessLink(opts: {
  to: string;
  name: string;
  link: string;
  kind: 'invite' | 'reset';
}): Promise<{ ok: boolean; error?: string }> {
  const isInvite = opts.kind === 'invite';
  const subject = isInvite ? 'Welcome to MCA Heart: set your password' : 'Reset your MCA Heart password';
  const lead = isInvite
    ? 'You have been added to the MCA Heart members area. Please set a password to get started.'
    : 'Here is a link to set a new password for the MCA Heart members area.';

  const inner =
    heading(isInvite ? 'Welcome to MCA Heart' : 'Reset your password') +
    p(`Dear ${esc(opts.name)},`) +
    p(lead) +
    button(opts.link, isInvite ? 'Set your password' : 'Reset password') +
    p(`This link expires in 1 hour. If the button does not work, paste this into your browser:<br>${link(opts.link)}`, 'font-size:13px;color:#777777;word-break:break-all') +
    p('Kind regards,<br>MCA Heart Research Lab', 'margin-bottom:0');

  return sendEmail({
    to: opts.to,
    subject,
    html: emailShell(inner, 'If you did not expect this email, you can ignore it.'),
  });
}
