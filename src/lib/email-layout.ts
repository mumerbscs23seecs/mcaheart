/**
 * The one look every email uses (modelled on Wiley's journal emails): grey
 * page, the MCA logo with a bold Merriweather "MCA HEART", a white card, a
 * small grey footer line. Everything is inline-styled, since most mail clients ignore
 * <style> blocks; Open Sans only loads where the client allows web fonts and
 * falls back to the system sans-serif elsewhere.
 */
export const FONT = "'Open Sans', 'Segoe UI', Helvetica, Arial, sans-serif";
const SERIF = "Merriweather, Georgia, 'Times New Roman', Times, serif";
export const RED = '#7a1322';
export const TEXT = '#333333';
export const MUTED = '#777777';

export const esc = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A body paragraph. `extra` appends inline CSS (e.g. 'margin-bottom:0'). */
export const p = (html: string, extra = '') =>
  `<p style="margin:0 0 18px;color:${TEXT};font-family:${FONT};font-size:14px;line-height:1.6;${extra}">${html}</p>`;

/** A bold line above the body, for emails that need a title of their own. */
export const heading = (text: string) =>
  `<p style="margin:0 0 22px;color:#1a1a1a;font-family:${FONT};font-size:19px;font-weight:700;line-height:1.3">${text}</p>`;

export const link = (href: string, label = href) => `<a href="${href}" style="color:${RED}">${label}</a>`;

export const button = (href: string, label: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:8px auto 28px">
    <tr><td style="background:${RED};border-radius:4px">
      <a href="${href}" style="display:inline-block;padding:15px 44px;color:#ffffff;font-family:${FONT};font-size:15px;font-weight:600;text-decoration:none">${label}</a>
    </td></tr>
  </table>`;

/** A highlighted note (coordinator / reviewer comments). Escapes `note`. */
export const noteBlock = (note: string | null | undefined, label = 'Note from the coordinator') =>
  note
    ? `<div style="margin:0 0 24px;padding:16px 18px;background:#f6f6f6;border-left:3px solid ${RED};color:${TEXT};font-family:${FONT};font-size:14px;line-height:1.6;white-space:pre-wrap"><strong>${label}:</strong><br>${esc(note)}</div>`
    : '';

/** Grey panel for secondary information (e.g. "Important information"). `html` is trusted. */
export const infoBox = (html: string) =>
  `<div style="margin:4px 0 24px;padding:18px 20px;background:#f6f6f6;color:${TEXT};font-family:${FONT};font-size:13px;line-height:1.6">${html}</div>`;

/** Label / value rows for the internal notification emails. Values are escaped. */
export const dataTable = (rows: Array<[string, string]>) =>
  `<table role="presentation" style="border-collapse:collapse;width:100%;margin:0 0 20px">${rows
    .map(
      ([k, v]) => `<tr>
        <td style="padding:9px 16px 9px 0;border-bottom:1px solid #eeeeee;color:${MUTED};font-family:${FONT};font-size:13px;font-weight:600;line-height:1.4;vertical-align:top;width:34%">${esc(k)}</td>
        <td style="padding:9px 0;border-bottom:1px solid #eeeeee;color:${TEXT};font-family:${FONT};font-size:14px;line-height:1.6;white-space:pre-wrap;vertical-align:top">${esc(v)}</td>
      </tr>`,
    )
    .join('')}</table>`;

// Header: the MCA monogram beside "MCA HEART" in bold Merriweather, every
// letter the same size. Laid out with a table, which every mail client
// centres reliably. The logo is served from the live site, so it shows in
// real inboxes and in the site's previews alike.
const LOGO = 'https://mcaheart.com/assets/brand/mca-mark-light.png';
const WORDMARK = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 32px">
      <tr>
        <td style="padding-right:12px;vertical-align:middle"><img src="${LOGO}" width="44" height="44" alt="MCA" style="display:block;border:0;width:44px;height:44px"></td>
        <td style="vertical-align:middle;font-family:${SERIF};font-size:26px;font-weight:700;line-height:1;letter-spacing:0.05em;color:#1a1a1a;white-space:nowrap"><span style="color:${RED}">MCA</span> HEART</td>
      </tr>
    </table>`;

/** Wrap `inner` (already-built paragraphs) in the frame. `footer` is trusted HTML; '' for none. */
export function emailShell(inner: string, footer: string): string {
  return `<style>@import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&family=Merriweather:wght@700&display=swap');</style>
<div style="background:#f3f3f3;padding:40px 16px;font-family:${FONT}">
  <div style="max-width:640px;margin:0 auto">
    ${WORDMARK}
    <div style="background:#ffffff;padding:44px 48px 36px">
      ${inner}
    </div>
    ${footer ? `<p style="margin:20px 0 0;text-align:center;color:${MUTED};font-family:${FONT};font-size:12px;line-height:1.6">${footer}</p>` : ''}
  </div>
</div>`;
}

/** Footer for emails the site sends automatically to members. */
export const FOOTER_AUTO =
  'This is an automated message from the MCA Heart Research Workflow. Please reply to this email rather than on WhatsApp so that the conversation stays on record.';

/** Footer for emails sent to applicants and idea submitters. */
export const FOOTER_ON_BEHALF = "This message was sent by Dr. M. Chadi Alraies' team on his behalf.";

/** Footer for the internal notifications the website sends to the lab inbox. */
export const FOOTER_INTERNAL = 'Sent automatically by the MCA Heart website. Reply to this email to respond to the sender.';
