import { sendEmail } from './email';

/**
 * Account-access emails (invite a new member / resend a set-password link).
 * Same transport as everything else — src/lib/email.ts (Gmail primary, Resend
 * fallback). Env: NOTIFY_FROM for the sender display (ignored by Gmail).
 */
const FROM = import.meta.env.NOTIFY_FROM ?? 'MCA Heart <onboarding@resend.dev>';

function esc(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function deliverAccessLink(opts: {
  to: string;
  name: string;
  link: string;
  kind: 'invite' | 'reset';
}): Promise<{ ok: boolean; error?: string }> {
  const isInvite = opts.kind === 'invite';
  const subject = isInvite
    ? '[MCA Heart] You’ve been added — set your password'
    : '[MCA Heart] Reset your password';
  const lead = isInvite
    ? 'An admin has added you to the MCA Heart members area. Set a password to get started.'
    : 'Here’s a fresh link to set a new password for the MCA Heart members area.';

  const html = `<div style="background:#f8fafc;padding:28px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid rgba(43,57,144,.14);border-radius:12px;padding:28px">
    <p style="margin:0 0 4px;color:#a51c30;font:700 11px/1 Arial,sans-serif;text-transform:uppercase;letter-spacing:.22em">MCA Heart</p>
    <h1 style="margin:0 0 12px;color:#1e293b;font:600 20px/1.3 Georgia,serif">${isInvite ? 'Welcome to MCA Heart' : 'Reset your password'}</h1>
    <p style="margin:0 0 8px;color:#1e293b;font:14px/1.6 Arial,sans-serif">Hi ${esc(opts.name)},</p>
    <p style="margin:0 0 18px;color:#1e293b;font:14px/1.6 Arial,sans-serif">${lead}</p>
    <p style="margin:0 0 18px">
      <a href="${opts.link}" style="display:inline-block;padding:12px 22px;background:#a51c30;color:#fff;
         font:600 14px/1 Arial,sans-serif;text-decoration:none;border-radius:999px">
        ${isInvite ? 'Set your password' : 'Reset password'}
      </a>
    </p>
    <p style="margin:0;color:#64748b;font:12px/1.6 Arial,sans-serif">
      This link expires in 1 hour. If the button doesn’t work, paste this into your browser:<br>
      <a href="${opts.link}" style="color:#a51c30">${opts.link}</a>
    </p>
  </div>
</div>`;

  return sendEmail({ to: opts.to, from: FROM, subject, html });
}
