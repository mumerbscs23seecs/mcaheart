/**
 * One-off repair: the youtubeId values in src/data/site.ts were mapped to the
 * wrong titles, because the IDs were harvested from the original Wix page with
 * `sort -u`, which discarded their document order.
 *
 * Each id below was confirmed against https://www.youtube.com/oembed.
 */
import fs from 'node:fs';

const file = 'src/data/site.ts';
let s = fs.readFileSync(file, 'utf8');

const fix = {
  'NCVH 2024 Interviews':         'Si95Wgru8hY',
  'Pulmonary Embolism':           '0i0CelwftRk',
  'TCT 2024 Wrap Up':             'k7JguFN_BAY',
  'NYEVS 2024':                   'tCDK0wvu6RE',
  'SCAI 2024':                    'yp0oDs7AHZ0',
  'ESC Congress 2024 Interviews': 'uveL7Xj_ObE',
  'TCT Presenters Promo':         'PW1UN0ZBgHI',
  'Monthly Webinar':              'z36YGMAaBwk',
};

// Plain string surgery — no regex, no escaping games.
for (const [title, id] of Object.entries(fix)) {
  const anchor = `title: '${title}',`;
  const at = s.indexOf(anchor);
  if (at === -1) { console.log('  !! title not found:', title); continue; }

  const keyAt = s.indexOf("youtubeId: '", at);
  if (keyAt === -1) { console.log('  !! youtubeId not found after:', title); continue; }

  const valStart = keyAt + "youtubeId: '".length;
  const valEnd = s.indexOf("'", valStart);
  const old = s.slice(valStart, valEnd);

  if (old !== id) console.log(`  ${title}:  ${old} -> ${id}`);
  s = s.slice(0, valStart) + id + s.slice(valEnd);
}

fs.writeFileSync(file, s);
console.log('written');
