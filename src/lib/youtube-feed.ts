/**
 * Pulls a channel's (or playlist's) most recent videos straight from
 * YouTube's public Atom feed - no API key, no quota, nothing to configure
 * or ever expire.
 *
 *   https://www.youtube.com/feeds/videos.xml?channel_id=<id>
 *   https://www.youtube.com/feeds/videos.xml?playlist_id=<id>
 *
 * Returns up to 15 most-recent videos. Cached in memory for CACHE_MS so a
 * burst of visitors doesn't each trigger their own fetch; on a failed fetch
 * we fall back to whatever's cached (even if stale) rather than showing
 * nothing.
 */
import type { Video } from '../data/site';

const CACHE_MS = 20 * 60 * 1000; // 20 minutes
const cache = new Map<string, { at: number; videos: Video[] }>();

function unescapeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '’')
    .replace(/&amp;/g, '&')
    .trim();
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `Uploaded ${d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

function parseFeed(xml: string): Video[] {
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
  return entries
    .map((entry): Video | null => {
      const id = entry.match(/<yt:videoId>(.*?)<\/yt:videoId>/)?.[1];
      const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1];
      const published = entry.match(/<published>(.*?)<\/published>/)?.[1];
      if (!id || !title) return null;
      return {
        title: unescapeXml(title),
        youtubeId: id,
        thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        blurb: published ? fmtDate(published) : 'Latest upload',
      };
    })
    .filter((v): v is Video => v !== null);
}

async function fetchFeed(url: string, cacheKey: string, limit: number): Promise<Video[]> {
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.videos.slice(0, limit);

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`YouTube feed ${res.status}`);
    const videos = parseFeed(await res.text());
    cache.set(cacheKey, { at: Date.now(), videos });
    return videos.slice(0, limit);
  } catch (err) {
    console.error(`[youtube-feed] fetch failed for ${cacheKey}, using stale cache if any:`, err);
    return (hit?.videos ?? []).slice(0, limit);
  }
}

export async function fetchLatestVideos(channelId: string, limit = 8): Promise<Video[]> {
  return fetchFeed(
    `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`,
    `channel:${channelId}`,
    limit,
  );
}

export async function fetchPlaylistVideos(playlistId: string, limit = 12): Promise<Video[]> {
  return fetchFeed(
    `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(playlistId)}`,
    `playlist:${playlistId}`,
    limit,
  );
}
