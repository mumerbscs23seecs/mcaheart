/**
 * Regenerates src/data/publications.ts from PubMed.
 *
 *   node scripts/fetch-publications.mjs [count]
 *
 * The generated file is committed, so the publications page prerenders real
 * citations into static HTML (good for SEO and for visitors with no JS). The
 * page then refreshes itself against the live NCBI API on load.
 *
 * NCBI allows 3 requests/sec unauthenticated; we stay well under that.
 */
import fs from 'node:fs';
import path from 'node:path';

const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

/** Matches every spelling of the author's name used in the literature. */
export const AUTHOR_TERM =
  '(Alraies, Chadi[Author]) OR (Alraies, M Chadi[Author]) OR Alraies MC[Author]';

const WANT = Number(process.argv[2] ?? 200);
const OUT = path.join('src', 'data', 'publications.ts');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Bucket a paper by title keywords — same taxonomy the source build used. */
function categorise(title) {
  const t = title.toLowerCase();
  const has = (...words) => words.some((w) => t.includes(w));

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

function decode(s = '') {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/<\/?[^>]+>/g, '')
    .replace(/\.$/, '')
    .trim();
}

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'mcaheart-website/1.0' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

async function main() {
  const term = encodeURIComponent(AUTHOR_TERM);

  console.log('Searching PubMed…');
  const search = await getJson(
    `${EUTILS}/esearch.fcgi?db=pubmed&term=${term}&retmode=json&retmax=${WANT}&sort=pub_date`,
  );

  const total = Number(search.esearchresult?.count ?? 0);
  const ids = search.esearchresult?.idlist ?? [];
  console.log(`  ${total} indexed in total; fetching the ${ids.length} most recent`);

  const articles = [];

  // esummary in batches — long id lists get rejected as a GET.
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    console.log(`  summaries ${i + 1}–${i + batch.length}…`);
    const sum = await getJson(
      `${EUTILS}/esummary.fcgi?db=pubmed&id=${batch.join(',')}&retmode=json`,
    );

    for (const id of batch) {
      const doc = sum.result?.[id];
      if (!doc || doc.error) continue;

      const title = decode(doc.title);
      const authors = (doc.authors ?? []).map((a) => a.name).filter(Boolean);
      const doi = (doc.articleids ?? []).find((a) => a.idtype === 'doi')?.value ?? '';

      articles.push({
        pmid: id,
        title,
        journal: doc.source || 'Journal',
        pubDate: doc.pubdate || '',
        year: Number(String(doc.pubdate ?? '').match(/\d{4}/)?.[0]) || 0,
        authors,
        doi,
        volume: doc.volume || '',
        issue: doc.issue || '',
        pages: doc.pages || '',
        category: categorise(title),
      });
    }

    await sleep(400); // stay comfortably inside NCBI's rate limit
  }

  const banner = `/**
 * GENERATED FILE — do not edit by hand.
 * Regenerate with:  node scripts/fetch-publications.mjs [count]
 * Last generated:   ${new Date().toISOString().slice(0, 10)}
 */

export type Publication = {
  pmid: string;
  title: string;
  journal: string;
  pubDate: string;
  year: number;
  authors: string[];
  doi: string;
  volume: string;
  issue: string;
  pages: string;
  category: string;
};

/** Every spelling of the author's name used in the literature. */
export const AUTHOR_TERM = ${JSON.stringify(AUTHOR_TERM)};

/** Total works indexed by PubMed at the time of generation. */
export const TOTAL_INDEXED = ${total};

export const PUBMED_SEARCH_URL =
  'https://pubmed.ncbi.nlm.nih.gov/?term=' + encodeURIComponent(AUTHOR_TERM) + '&sort=pub_date';

export const PUBLICATIONS: Publication[] = ${JSON.stringify(articles, null, 2)};
`;

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, banner);

  const byCat = {};
  for (const a of articles) byCat[a.category] = (byCat[a.category] ?? 0) + 1;

  console.log(`\nWrote ${articles.length} publications to ${OUT}`);
  for (const [c, n] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${c}`);
  }
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
