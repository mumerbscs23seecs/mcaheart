/**
 * Pulls the lab's most recent PubMed papers straight from NCBI's public
 * E-utilities - no API key needed for this volume of traffic. Same shape
 * as youtube-feed.ts: an in-memory cache so a burst of visitors doesn't
 * each trigger their own fetch, and a fallback to stale cache (rather than
 * an empty section) if a fetch ever fails.
 *
 *   esearch  - "give me the most recent PMIDs for this author"
 *   esummary - "give me title/journal/date/authors for those PMIDs"
 */
export interface PublicationRecord {
  pmid: string;
  title: string;
  journal: string;
  date: string;
  authors: string;
  url: string;
}

const CACHE_MS = 30 * 60 * 1000; // 30 minutes
// Matches the free-text search the site's own "View Our Publications" link
// already uses (pubmed.ncbi.nlm.nih.gov/?term=chadi+alraies&sort=date) -
// same result set, not the stricter [Author]-field search.
const SEARCH_TERM = 'chadi alraies';
let cache: { at: number; papers: PublicationRecord[] } | null = null;

function fmtDate(pubdate: string): string {
  // esummary's pubdate is usually "2026 Sep 15" or just "2026 Sep" / "2026" -
  // keep it to "Mon YYYY" when we can, otherwise pass the raw string through.
  const m = pubdate.match(/^(\d{4})\s+([A-Za-z]{3})/);
  return m ? `${m[2]} ${m[1]}` : pubdate;
}

function authorLine(authors: Array<{ name?: string }> | undefined): string {
  const names = (authors ?? []).map((a) => a.name).filter((n): n is string => !!n);
  if (names.length === 0) return '';
  if (names.length <= 3) return names.join(', ');
  return `${names.slice(0, 3).join(', ')}, et al.`;
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`PubMed E-utilities ${res.status}`);
  return res.json();
}

export async function fetchRecentPublications(limit = 6): Promise<PublicationRecord[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.papers.slice(0, limit);

  try {
    const searchUrl =
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json` +
      `&sort=pub+date&retmax=${limit}&term=${encodeURIComponent(SEARCH_TERM)}`;
    const search = await fetchJson(searchUrl);
    const ids: string[] = search?.esearchresult?.idlist ?? [];
    if (ids.length === 0) throw new Error('esearch returned no PMIDs');

    const summaryUrl =
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(',')}`;
    const summary = await fetchJson(summaryUrl);
    const result = summary?.result;
    if (!result) throw new Error('esummary returned no result');

    const papers: PublicationRecord[] = ids
      .map((pmid): PublicationRecord | null => {
        const rec = result[pmid];
        if (!rec || !rec.title) return null;
        return {
          pmid,
          title: String(rec.title).replace(/\.$/, ''),
          journal: rec.fulljournalname || rec.source || '',
          date: fmtDate(rec.pubdate || rec.sortpubdate || ''),
          authors: authorLine(rec.authors),
          url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
        };
      })
      .filter((p): p is PublicationRecord => p !== null);

    cache = { at: Date.now(), papers };
    return papers.slice(0, limit);
  } catch (err) {
    console.error('[pubmed-feed] fetch failed, using stale cache if any:', err);
    return (cache?.papers ?? []).slice(0, limit);
  }
}
