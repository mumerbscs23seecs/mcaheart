/**
 * Document links accepted on pipeline projects — a member's draft link and the
 * coordinator's reviewed-copy link. Google Docs / Drive, OneDrive, or
 * SharePoint only, HTTPS only.
 */
const EXACT_HOSTS = new Set([
  'docs.google.com',
  'drive.google.com',
  'onedrive.live.com',
  '1drv.ms',
]);

export const DOC_LINK_HINT = 'Paste a Google Docs, OneDrive, or SharePoint link.';

export function isDocLink(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  const host = u.hostname.toLowerCase();
  return EXACT_HOSTS.has(host) || host.endsWith('.sharepoint.com');
}

/** Short label for display next to a stored link. */
export function docLinkLabel(url: string | null | undefined): string {
  if (!url) return '';
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes('google')) return 'Google Docs';
    if (host.includes('sharepoint')) return 'SharePoint';
    if (host.includes('onedrive') || host === '1drv.ms') return 'OneDrive';
    return host;
  } catch {
    return 'link';
  }
}
