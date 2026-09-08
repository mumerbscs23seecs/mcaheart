import type { Publication } from '../data/publications';
import { AUTHOR_TERM } from '../data/publications';

/**
 * PubMed helpers shared by the prerendered page and its client island.
 * Framework-agnostic on purpose — no DOM, no imports beyond the data types.
 */

const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

export const CATEGORIES = [
  'Interventional & Cath Lab',
  'Structural Heart & TAVR',
  'Heart Failure & Shock',
  'Cardio-Oncology & Arrhythmias',
  'Outcomes & Clinical Epidemiology',
] as const;

export const pubmedUrl = (pmid: string) => `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;

export const doiUrl = (p: Pick<Publication, 'doi' | 'pmid'>) =>
  p.doi ? `https://doi.org/${p.doi}` : pubmedUrl(p.pmid);

/** "Smith J, Doe A, … Alraies MC" — keeps lists readable without hiding the PI. */
export function authorString(authors: string[], max = 5): string {
  if (authors.length <= max) return authors.join(', ');
  return `${authors.slice(0, max - 1).join(', ')} … ${authors[authors.length - 1]}`;
}

/* -------------------------------------------------------------------------- */
/* Citations                                                                  */
/* -------------------------------------------------------------------------- */

export type CitationFormat = 'AMA' | 'APA' | 'BibTeX';

export function formatCitation(p: Publication, format: CitationFormat): string {
  const list =
    p.authors.slice(0, 6).join(', ') + (p.authors.length > 6 ? ', et al' : '');
  const year = p.year || String(p.pubDate).match(/\d{4}/)?.[0] || 'n.d.';
  const issue = p.issue ? `(${p.issue})` : '';

  if (format === 'AMA') {
    return [
      `${list}. ${p.title}. ${p.journal}. ${p.pubDate};${p.volume}${issue}`,
      p.pages ? `:${p.pages}` : '',
      '.',
      p.doi ? ` doi:${p.doi}` : '',
    ].join('');
  }

  if (format === 'APA') {
    return [
      `${list} (${year}). ${p.title}. ${p.journal}`,
      p.volume ? `, ${p.volume}${issue}` : '',
      p.pages ? `, ${p.pages}` : '',
      '. ',
      p.doi ? `https://doi.org/${p.doi}` : pubmedUrl(p.pmid),
    ].join('');
  }

  return `@article{alraies${year}_${p.pmid},
  author  = {${p.authors.join(' and ')}},
  title   = {${p.title}},
  journal = {${p.journal}},
  year    = {${year}},
  volume  = {${p.volume}},
  number  = {${p.issue}},
  pages   = {${p.pages}},
  doi     = {${p.doi}},
  pmid    = {${p.pmid}},
  url     = {${pubmedUrl(p.pmid)}}
}`;
}

/* -------------------------------------------------------------------------- */
/* Live lookups (browser only)                                                */
/* -------------------------------------------------------------------------- */

const withTimeout = (ms: number) => {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return { signal: c.signal, done: () => clearTimeout(t) };
};

/** Fetch a single abstract. Returns null when PubMed has none on file. */
export async function fetchAbstract(pmid: string): Promise<string | null> {
  const { signal, done } = withTimeout(12000);
  try {
    const res = await fetch(
      `${EUTILS}/efetch.fcgi?db=pubmed&id=${encodeURIComponent(pmid)}&retmode=xml`,
      { signal },
    );
    if (!res.ok) throw new Error(String(res.status));
    const xml = await res.text();

    const parts = xml.match(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/gi);
    if (!parts?.length) return null;

    return parts
      .map((chunk) => {
        const label = chunk.match(/Label="([^"]+)"/i)?.[1];
        const body = chunk.replace(/<\/?[^>]+>/g, '').trim();
        return label ? `${label}: ${body}` : body;
      })
      .join('\n\n');
  } catch {
    return null;
  } finally {
    done();
  }
}

/**
 * Search this author's works on PubMed. Any query is ANDed with the author
 * term so results can never drift onto someone else's papers.
 */
export async function searchLive(
  query = '',
  retmax = 60,
): Promise<{ total: number; results: Publication[] } | null> {
  const q = query.trim();
  const term = q ? `(${AUTHOR_TERM}) AND (${q})` : AUTHOR_TERM;

  const a = withTimeout(12000);
  try {
    const searchRes = await fetch(
      `${EUTILS}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(term)}` +
        `&retmode=json&retmax=${retmax}&sort=pub_date`,
      { signal: a.signal },
    );
    if (!searchRes.ok) throw new Error(String(searchRes.status));
    const search = await searchRes.json();
    a.done();

    const ids: string[] = search.esearchresult?.idlist ?? [];
    const total = Number(search.esearchresult?.count ?? 0);
    if (!ids.length) return { total: 0, results: [] };

    const b = withTimeout(12000);
    const sumRes = await fetch(
      `${EUTILS}/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`,
      { signal: b.signal },
    );
    if (!sumRes.ok) throw new Error(String(sumRes.status));
    const sum = await sumRes.json();
    b.done();

    const results = ids
      .map((id): Publication | null => {
        const d = sum.result?.[id];
        if (!d || d.error) return null;
        const title = String(d.title ?? '')
          .replace(/<\/?[^>]+>/g, '')
          .replace(/&amp;/g, '&')
          .replace(/\.$/, '');
        const authors = (d.authors ?? []).map((x: { name: string }) => x.name);
        return {
          pmid: id,
          title,
          journal: d.source || 'Journal',
          pubDate: d.pubdate || '',
          year: Number(String(d.pubdate ?? '').match(/\d{4}/)?.[0]) || 0,
          authors,
          doi: (d.articleids ?? []).find((x: { idtype: string }) => x.idtype === 'doi')?.value ?? '',
          volume: d.volume || '',
          issue: d.issue || '',
          pages: d.pages || '',
          category: categorise(title),
        };
      })
      .filter((x): x is Publication => x !== null);

    return { total, results };
  } catch {
    return null; // caller falls back to the prerendered set
  }
}

/** Mirrors scripts/fetch-publications.mjs so live and cached results agree. */
export function categorise(title: string): string {
  const t = title.toLowerCase();
  const has = (...w: string[]) => w.some((x) => t.includes(x));

  if (has('tavr', 'aortic', 'valvular', 'valve', 'mitral', 'tricuspid', 'structural', 'stenosis'))
    return 'Structural Heart & TAVR';
  if (has('heart failure', 'shock', 'cardiogenic', 'impella', 'chf'))
    return 'Heart Failure & Shock';
  if (has('arrhythmia', 'fibrillation', 'ablation', 'cancer', 'checkpoint', 'melanoma', 'cardio-oncology'))
    return 'Cardio-Oncology & Arrhythmias';
  if (has('disparities', 'trends', 'mortality', 'meta-analysis', 'prevalence', 'prevent', 'racial'))
    return 'Outcomes & Clinical Epidemiology';
  return 'Interventional & Cath Lab';
}
