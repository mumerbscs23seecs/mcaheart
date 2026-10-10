/**
 * Single source of truth for site content.
 * Copy lifted from the original mcaheart.com Wix build, restructured so
 * every page reads from typed data rather than hard-coded markup.
 */

export const site = {
  name: 'MCA Heart',
  tagline: 'Charting New Paths in Cardiology',
  description:
    'MCA Heart is a cardiovascular research collective led by M Chadi Alraies, MD MPH - over 300 researchers publishing, presenting and teaching at the frontier of cardiology.',
  url: 'https://www.mcaheart.com',
  youtube: 'https://www.youtube.com/channel/UCR1U9EROhLsdeuCB4hlAw4w',
  instagram: 'https://www.instagram.com/mca_heart_lab/',
  x: 'https://x.com/mca_heart',
} as const;

export type NavLink = { label: string; href: string };
export type NavItem = { label: string; href?: string; children?: NavLink[] };

export const nav: NavItem[] = [
  { label: 'Research', href: '/research-group' },
  { label: 'Education', href: '/education' },
  {
    label: 'Get Involved',
    href: '/submit-idea',
    children: [
      { label: 'Submit an Idea', href: '/submit-idea' },
      { label: 'Join the Lab', href: '/join-lab' },
      { label: 'Contact Us', href: '/contact' },
    ],
  },
];

export const director = {
  name: 'M Chadi Alraies',
  /** Short form - sits inline with the name everywhere except the homepage headline. No commas between the letters, by request. */
  credentials: 'MD MPH',
  /** Full form - homepage only. */
  credentialsFull: 'MD MPH FACC FSCAI',
  /** Full title list - homepage only (research-group.astro shows just name + credentials). */
  roles: [
    'Head and Principal Investigator, MCA Heart Research Lab',
    'Clinical Associate Professor of Medicine, Wayne State University',
    'Associate Program Director, Interventional Cardiology Fellowship, Detroit Medical Center',
    'Clinical Assistant Professor of Medicine, Michigan State University College of Osteopathic Medicine',
    'Medical Director, Cardiac Catheterization Laboratory, Harper University Hospital',
    'Medical Director, Interventional Cardiology Research, Harper University Hospital',
    'Medical Director, Cardiac Rehab, Rehab Institute of Michigan',
  ],
  /** Homepage director card, top row - academic and institutional profiles.
   *  Sits above the social row and carries no heading of its own. */
  academicLinks: [
    { label: 'Wayne State University profile', icon: 'university', url: 'https://cardiology.med.wayne.edu/profile/hj4412' },
    { label: 'Detroit Medical Center profile', icon: 'hospital', url: 'https://www.dmc.org/provider/1689828238' },
    { label: 'ResearchGate', icon: 'researchgate', url: 'https://www.researchgate.net/profile/M-Chadi-Alraies' },
    { label: 'Google Scholar', icon: 'scholar', url: 'https://scholar.google.com/citations?user=iRYSyHEAAAAJ&hl=en' },
  ],
  /** Homepage director card, second row - the "Connect" heading sits here. */
  socialLinks: [
    { label: 'X', icon: 'x', url: 'https://x.com/chadialraies' },
    { label: 'Instagram', icon: 'instagram', url: 'https://www.instagram.com/chadi_mca/' },
    { label: 'LinkedIn', icon: 'linkedin', url: 'https://www.linkedin.com/in/chadi-alraies-md-facc-fscai-65131711/' },
    // Kept exactly as supplied - Facebook rejects automated requests, so the
    // share link could not be resolved to a canonical profile URL to tidy it.
    { label: 'Facebook', icon: 'facebook', url: 'https://www.facebook.com/share/1DmnRtHt8x/?mibextid=wwXIfr' },
  ],
} as const;

/**
 * Research page - "Recent papers on PubMed" grid. Static for now (manually
 * updated); the plan is to replace this with a live PubMed feed fetch, the
 * same pattern already used for the YouTube feeds on Heart Trending/
 * Education (cached server-side so it stays current without hammering
 * PubMed on every page load) - see the placement mockup for the rationale.
 */
export const recentPublications = [
  {
    journal: 'JACC Cardiovasc Interv',
    date: 'Sep 2026',
    title: 'Outcomes of Complex High-Risk PCI in Patients With Prior CABG: A TriNetX Analysis',
    authors: 'Alraies MC, Basit J, et al.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/?term=chadi+alraies&sort=date&size=200',
  },
  {
    journal: 'Catheter Cardiovasc Interv',
    date: 'Aug 2026',
    title: 'National Trends in Mechanical Circulatory Support for Cardiogenic Shock, 2016-2024',
    authors: 'Burhan M, Alraies MC, et al.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/?term=chadi+alraies&sort=date&size=200',
  },
  {
    journal: 'Am J Cardiol',
    date: 'Aug 2026',
    title: 'Sex-Based Disparities in TAVR Access: A Nationwide Inpatient Sample Study',
    authors: 'Darboe R, Pareddy A, et al.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/?term=chadi+alraies&sort=date&size=200',
  },
  {
    journal: 'Struct Heart',
    date: 'Jul 2026',
    title: 'Long-Term Follow-Up After Transcatheter Edge-to-Edge Repair in Functional MR',
    authors: 'Hanmandlu A, Awad A, et al.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/?term=chadi+alraies&sort=date&size=200',
  },
  {
    journal: 'Cardiovasc Revasc Med',
    date: 'Jul 2026',
    title: 'Meta-Analysis of Radial vs. Femoral Access in Endovascular Intervention',
    authors: 'Elnaggar K, Husainy B, et al.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/?term=chadi+alraies&sort=date&size=200',
  },
  {
    journal: 'JAMA Cardiol',
    date: 'Jun 2026',
    title: 'Thirty-Day Readmission After Heart Failure Hospitalization: An NRD Study',
    authors: 'Azzalini G, Alraies MC, et al.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/?term=chadi+alraies&sort=date&size=200',
  },
] as const;

export const stats = [
  { value: '100+', label: 'papers published in major journals' },
  { value: '10+', label: 'presentations at every major conference' },
  { value: '10+', label: 'attendees at every major conference' },
  { value: '100+', label: 'active group members' },
] as const;

/** Landing page - second stat row, same numbers as the research page's
 * "Publications" section (manuscripts/abstracts/researchers a year). */
export const researchStats = [
  { value: '75+', label: 'peer-reviewed manuscripts every year' },
  { value: '150+', label: 'abstracts presented every year' },
  { value: '300+', label: 'active researchers & trainees' },
] as const;

/**
 * "Our work has been presented at". Each entry links to that body's own
 * index of M Chadi Alraies' work.
 *
 * `logo` is null where no logo file has been supplied yet - the row falls
 * back to the abbreviation set in `abbr`, styled to sit at the same weight
 * as the logos. Drop a file in /assets/home/ and set `logo` to swap it in.
 */
export const societies = [
  {
    name: 'SCAI - Society for Cardiovascular Angiography & Interventions',
    abbr: 'SCAI',
    logo: '/assets/home/logo-scai.png',
    // White-on-transparent variant for dark mode - the default logo's dark
    // wordmark disappears against a dark page background.
    logoDark: '/assets/home/logo-scai-dark.webp',
    url: 'https://www.jscai.org/action/doSearch?type=quicksearch&text1=chadi+alraies&field1=AllField&startPage=&ContentItemType=abs',
  },
  {
    name: 'ACC - American College of Cardiology',
    abbr: 'ACC',
    logo: '/assets/home/logo-acc.jpg',
    logoDark: '/assets/home/logo-acc-dark.webp',
    url: 'https://www.jacc.org/action/doSearch?AllField=%28chadi+alraies%29+AND+%28ACC%29',
  },
  {
    name: 'TCT - Transcatheter Cardiovascular Therapeutics',
    abbr: 'TCT',
    logo: '/assets/home/logo-tct.png',
    logoDark: '/assets/home/logo-tct-dark.webp',
    url: 'https://www.jacc.org/action/doSearch?AllField=%28chadi+alraies%29+AND+%28TCT%29',
  },
  {
    name: 'AHA - American Heart Association',
    abbr: 'AHA',
    logo: '/assets/home/logo-aha.webp',
    logoDark: '/assets/home/logo-aha-dark.webp',
    // OpenAlex, filtered to this author's conference abstracts in Circulation
    // (the AHA Scientific Sessions abstract record).
    url: 'https://openalex.org/works?page=1&filter=authorships.author.id:a5087694600,type:conference-abstract,primary_location.source.id:s116251202',
  },
  {
    name: 'CVI - Cardiovascular Innovations',
    abbr: 'CVI',
    logo: '/assets/home/logo-cvi.webp',
    logoDark: '/assets/home/logo-cvi-dark.webp',
    url: 'https://cvinnovations.org/?s=chadi+alraies',
  },
] as const;

/* -------------------------------------------------------------------------- */
/* Heart Trending - video series                                              */
/* -------------------------------------------------------------------------- */

export type Video = {
  title: string;
  youtubeId: string;
  thumb: string;
  blurb: string;
};

// Newest upload first - this is also the fallback list heart-trending.astro
// shows as "Just uploaded" if the live YouTube feed ever fails. Pulled from
// the real @hearttrendingwithchadi channel (youtube.com/feeds/videos.xml was
// down site-wide when this was written, so the channel's own /videos page
// was scraped directly; every id/title/date was checked against the video's
// real YouTube watch page). Re-check dates the same way before editing this
// list, and keep new entries sorted newest-first.
export const videos: Video[] = [
  {
    title: 'THE HEART OF THE MATTER | EDITION II - EPISODE 05',
    youtubeId: '3m7yDmsmE0E',
    thumb: 'https://i.ytimg.com/vi/3m7yDmsmE0E/hqdefault.jpg',
    blurb: 'Uploaded Aug 2, 2026',
  },
  {
    title: 'THE HEART OF THE MATTER | EDITION II - EPISODE 04',
    youtubeId: 'DCpGiiP2aAU',
    thumb: 'https://i.ytimg.com/vi/DCpGiiP2aAU/hqdefault.jpg',
    blurb: 'Uploaded Jun 28, 2026',
  },
  {
    title: 'FACET Webinar | February 2026 | Dr. Lorenzo Azzalini',
    youtubeId: 'w9-jnEb2cR0',
    thumb: 'https://i.ytimg.com/vi/w9-jnEb2cR0/hqdefault.jpg',
    blurb: 'Uploaded May 12, 2026',
  },
  {
    title: 'SIF Conversations with Dr. Gregg Stone | What’s New in Mitral Valve Transcatheter Interventions',
    youtubeId: 'rZBdPQ_kRQM',
    thumb: 'https://i.ytimg.com/vi/rZBdPQ_kRQM/hqdefault.jpg',
    blurb: 'Uploaded May 12, 2026',
  },
  {
    title: 'THE HEART OF THE MATTER | EDITION II - EPISODE 03',
    youtubeId: 'gin56IbR5Xo',
    thumb: 'https://i.ytimg.com/vi/gin56IbR5Xo/hqdefault.jpg',
    blurb: 'Uploaded May 9, 2026',
  },
  {
    title: 'FACET Webinar | December 2025 | Dr. Nicolas Van Mieghem',
    youtubeId: 'i5Yr32f1_dE',
    thumb: 'https://i.ytimg.com/vi/i5Yr32f1_dE/hqdefault.jpg',
    blurb: 'Uploaded May 8, 2026',
  },
  {
    title: 'FACET Webinar | January 2026 | Dr. Evan Shlofmitz',
    youtubeId: 'oyGxJ8kXbNc',
    thumb: 'https://i.ytimg.com/vi/oyGxJ8kXbNc/hqdefault.jpg',
    blurb: 'Uploaded May 8, 2026',
  },
  {
    title: 'SIF Conversations with Dr. Morton Kern | SIF 2026',
    youtubeId: 'gOIPkMIodZk',
    thumb: 'https://i.ytimg.com/vi/gOIPkMIodZk/hqdefault.jpg',
    blurb: 'Uploaded May 2, 2026',
  },
  {
    title: '🌟 Meet Our Team | MCA Research Group | SCAI 2026, Montreal, Canada 🌟',
    youtubeId: '6J9iRoJ_0SM',
    thumb: 'https://i.ytimg.com/vi/6J9iRoJ_0SM/hqdefault.jpg',
    blurb: 'Uploaded Apr 19, 2026',
  },
  {
    title: 'RSH 2026 | Dr Misabahul Ferdous & Dr Chadi Alraies',
    youtubeId: 'CmurhEnpf_I',
    thumb: 'https://i.ytimg.com/vi/CmurhEnpf_I/hqdefault.jpg',
    blurb: 'Uploaded Apr 7, 2026',
  },
  {
    title: 'RSH 2026 | Dr Ihab Sulaiman & Dr Chadi Alraies',
    youtubeId: '1JWtIvSgcV0',
    thumb: 'https://i.ytimg.com/vi/1JWtIvSgcV0/hqdefault.jpg',
    blurb: 'Uploaded Mar 9, 2026',
  },
  {
    title: 'RSH 2026 | Dr Gilbert Tang & Dr Chadi Alraies',
    youtubeId: 'uDwftvoVVBg',
    thumb: 'https://i.ytimg.com/vi/uDwftvoVVBg/hqdefault.jpg',
    blurb: 'Uploaded Mar 9, 2026',
  },
];

// The Heart of the Matter playlist's own fallback, same rule as `videos`
// above but scraped from the playlist page (youtube.com/playlist?list=...)
// so it only ever shows real Heart of the Matter episodes, not the whole
// channel - what education.astro's playlist fetch would return live.
export const heartOfTheMatterEpisodes: Video[] = [
  {
    title: 'THE HEART OF THE MATTER | EDITION II - EPISODE 05',
    youtubeId: '3m7yDmsmE0E',
    thumb: 'https://i.ytimg.com/vi/3m7yDmsmE0E/hqdefault.jpg',
    blurb: 'Uploaded Aug 2, 2026',
  },
  {
    title: 'THE HEART OF THE MATTER | EDITION II - EPISODE 04',
    youtubeId: 'DCpGiiP2aAU',
    thumb: 'https://i.ytimg.com/vi/DCpGiiP2aAU/hqdefault.jpg',
    blurb: 'Uploaded Jun 28, 2026',
  },
  {
    title: 'THE HEART OF THE MATTER | EDITION II - EPISODE 02',
    youtubeId: 'rpajuc8yMxM',
    thumb: 'https://i.ytimg.com/vi/rpajuc8yMxM/hqdefault.jpg',
    blurb: 'Uploaded Jan 25, 2026',
  },
  {
    title: 'THE HEART OF THE MATTER | EDITION II - EPISODE 1',
    youtubeId: 'FmUxnAo202o',
    thumb: 'https://i.ytimg.com/vi/FmUxnAo202o/hqdefault.jpg',
    blurb: 'Uploaded Jan 10, 2026',
  },
  {
    title: 'THE HEART OF THE MATTER | EPISODE 12',
    youtubeId: 'RaMfunXynaE',
    thumb: 'https://i.ytimg.com/vi/RaMfunXynaE/hqdefault.jpg',
    blurb: 'Uploaded Aug 31, 2025',
  },
  {
    title: 'THE HEART OF THE MATTER | EPISODE 11',
    youtubeId: 'xGo0cRT9YMU',
    thumb: 'https://i.ytimg.com/vi/xGo0cRT9YMU/hqdefault.jpg',
    blurb: 'Uploaded Aug 29, 2025',
  },
  {
    title: 'THE HEART OF THE MATTER | EPISODE 10',
    youtubeId: '8wctXY8Z9Zk',
    thumb: 'https://i.ytimg.com/vi/8wctXY8Z9Zk/hqdefault.jpg',
    blurb: 'Uploaded May 31, 2025',
  },
  {
    title: 'THE HEART OF THE MATTER | EPISODE 9',
    youtubeId: 'gM6B6kahM1c',
    thumb: 'https://i.ytimg.com/vi/gM6B6kahM1c/hqdefault.jpg',
    blurb: 'Uploaded May 17, 2025',
  },
  {
    title: 'THE HEART OF THE MATTER | EPISODE 8',
    youtubeId: 'nUbFf064DvA',
    thumb: 'https://i.ytimg.com/vi/nUbFf064DvA/hqdefault.jpg',
    blurb: 'Uploaded Apr 20, 2025',
  },
  {
    title: 'THE HEART OF THE MATTER | EPISODE 7',
    youtubeId: 'XvM2f3HZXdw',
    thumb: 'https://i.ytimg.com/vi/XvM2f3HZXdw/hqdefault.jpg',
    blurb: 'Uploaded Apr 8, 2025',
  },
  {
    title: 'THE HEART OF THE MATTER | EPISODE 6',
    youtubeId: 'C8xb-kTrkFI',
    thumb: 'https://i.ytimg.com/vi/C8xb-kTrkFI/hqdefault.jpg',
    blurb: 'Uploaded Mar 25, 2025',
  },
  {
    title: 'THE HEART OF THE MATTER | EPISODE 5',
    youtubeId: 'AMtC6iYvLpE',
    thumb: 'https://i.ytimg.com/vi/AMtC6iYvLpE/hqdefault.jpg',
    blurb: 'Uploaded Mar 9, 2025',
  },
];

export type Playlist = {
  title: string;
  playlistId: string;
  thumb: string;
};

/**
 * The channel's playlists, in the order youtube.com/@hearttrendingwithchadi
 * /playlists lists them (most recently updated first). Scraped from that page
 * and checked against it - there is no public feed that lists a channel's
 * playlists, so this is maintained by hand: add new ones at the top.
 *
 * "The Heart of the Matter" is deliberately absent - it has its own section,
 * hero and full episode list further down the same page.
 */
export const playlists: Playlist[] = [
  {
    title: 'SIF 2026',
    playlistId: 'PLU8rCA-F825WHJhXj1KM8RUj3AkoRmTqt',
    thumb: 'https://i.ytimg.com/vi/rZBdPQ_kRQM/hqdefault.jpg',
  },
  {
    title: 'RSH 2026',
    playlistId: 'PLU8rCA-F825W-U2d-wqj2N2xh21FOEG4E',
    thumb: 'https://i.ytimg.com/vi/CmurhEnpf_I/hqdefault.jpg',
  },
  {
    title: 'NYEVS 2025',
    playlistId: 'PLU8rCA-F825Wc_5Rj5zS5TD-U1z1cCq2y',
    thumb: 'https://i.ytimg.com/vi/zUnJRbLDdNA/hqdefault.jpg',
  },
  {
    title: 'NCVH Conversations',
    playlistId: 'PLU8rCA-F825UZcSeLxNy3sEXy5lCWB3_0',
    thumb: 'https://i.ytimg.com/vi/pnnkpjZ7lBY/hqdefault.jpg',
  },
  {
    title: 'SIF 2025',
    playlistId: 'PLU8rCA-F825WT8PXUGU8BGbqk1Vxe5OIN',
    thumb: 'https://i.ytimg.com/vi/hini2dxwD9s/hqdefault.jpg',
  },
  {
    title: 'RSH Interviews',
    playlistId: 'PLU8rCA-F825XTRkKFd6uALqMmAwv4wrY2',
    thumb: 'https://i.ytimg.com/vi/mCbGTOgm0oA/hqdefault.jpg',
  },
  {
    title: 'TCT 2024: Wrap Up',
    playlistId: 'PLU8rCA-F825Vub9nISva8p15aMrfMmBr2',
    thumb: 'https://i.ytimg.com/vi/k7JguFN_BAY/hqdefault.jpg',
  },
  {
    title: 'ESC Congress 2024, London',
    playlistId: 'PLU8rCA-F825VeynJWtnetHrHvzUcrIELH',
    thumb: 'https://i.ytimg.com/vi/jsrkbwsrAs8/hqdefault.jpg',
  },
  {
    title: 'NYEVS 2024 Interviews',
    playlistId: 'PLU8rCA-F825U1N000-TCtkEWBdNY5DKuD',
    thumb: 'https://i.ytimg.com/vi/7finr0EvWqE/hqdefault.jpg',
  },
  {
    title: 'Monthly Webinar',
    playlistId: 'PLU8rCA-F825WQN9WoUmFAk8eOPXb94Hzp',
    thumb: 'https://i.ytimg.com/vi/w9-jnEb2cR0/hqdefault.jpg',
  },
  {
    title: 'NCVH 2024',
    playlistId: 'PLU8rCA-F825UAmMK_WHJD_SGaZg5mWXoL',
    thumb: 'https://i.ytimg.com/vi/Si95Wgru8hY/hqdefault.jpg',
  },
  {
    title: 'SCAI 24',
    playlistId: 'PLU8rCA-F825Uz-CWqKd0NtMc5rJL648Gh',
    thumb: 'https://i.ytimg.com/vi/eFSj3dGQAA0/hqdefault.jpg',
  },
  {
    title: 'SIF 2024',
    playlistId: 'PLU8rCA-F825U86YGVAkCLmc9W78vjV1fh',
    thumb: 'https://i.ytimg.com/vi/W-SdWJIwfTQ/hqdefault.jpg',
  },
  {
    title: 'NCVH 2023',
    playlistId: 'PLU8rCA-F825VB9vkORzuWsNAgAb7Aiv7u',
    thumb: 'https://i.ytimg.com/vi/2vh36qNBOvg/hqdefault.jpg',
  },
  {
    title: 'SCAI 2023',
    playlistId: 'PLU8rCA-F825XueyMJOeqiqwdzWHVwufsw',
    thumb: 'https://i.ytimg.com/vi/mcncHPT1a9E/hqdefault.jpg',
  },
  {
    title: 'ARCH Talks',
    playlistId: 'PLU8rCA-F825WK3G57tX1mrRM-oIOxnsim',
    thumb: 'https://i.ytimg.com/vi/7aXkxcK52Sw/hqdefault.jpg',
  },
  {
    title: 'Promos',
    playlistId: 'PLU8rCA-F825X2awHx93RIDKHN4BOQBMP0',
    thumb: 'https://i.ytimg.com/vi/b_lGJksNumQ/hqdefault.jpg',
  },
  {
    title: 'Patient Education',
    playlistId: 'PLU8rCA-F825XT2kaEtgseAOPjMZ8_m7CY',
    thumb: 'https://i.ytimg.com/vi/0i0CelwftRk/hqdefault.jpg',
  },
];

/* -------------------------------------------------------------------------- */
/* Research group                                                             */
/* -------------------------------------------------------------------------- */

// Testimonials ('What our members say') moved to src/lib/testimonials.ts -
// they're admin-managed and persisted in Supabase now, not static here.

export const missionVision = [
  {
    kind: 'Our Mission',
    image: '/assets/research/mission.jpg',
    body: 'At the MCA Heart Research Lab, we bring together physician-researchers and trainees from around the world with a shared commitment to advancing cardiovascular medicine. Through collaboration, mentorship, and rigorous research, we generate meaningful evidence, foster academic growth, and translate scientific discovery into improved patient care.',
  },
  {
    kind: 'Our Vision',
    image: '/assets/research/vision.jpg',
    body: 'To advance the future of cardiovascular medicine through innovative research, global collaboration, and excellence in education. We aim to generate impactful evidence, improve cardiovascular outcomes, and develop the next generation of researchers and physician-leaders.',
  },
] as const;

/* -------------------------------------------------------------------------- */
/* Education                                                                  */
/* -------------------------------------------------------------------------- */

export const education = {
  series: {
    name: 'Heart of the Matter',
    logo: '/assets/education/thotm-logo.png',
    thumb: '/assets/education/hotm-thumb.jpg',
    quote:
      'Join our expert team as they review the latest published research articles, delivering insights and practical implications for cardiology.',
    body: [
      'The Heart of the Matter is an educational series led by residents and medical students, focused on the latest randomized controlled trials and emerging evidence in cardiovascular medicine.',
      'Each episode takes a closer look at the research behind important developments in cardiology, exploring study design, patient populations, interventions, outcomes, statistical findings, limitations, and clinical implications.',
      'The series encourages participants to look beyond the headline results, critically evaluate the evidence, and develop a deeper understanding of how new research may influence cardiovascular practice.',
    ],
  },
  webinar: {
    name: 'Monthly Webinar Series',
    image: '/assets/education/webinar.jpg',
    partner: 'FACET',
    partnerNote: 'in association with facet.org',
    body: 'Discussing recent publications highlighting new techniques and science related to interventional, endovascular and structural cardiology - and much more.',
  },
} as const;

/* -------------------------------------------------------------------------- */
/* Contact                                                                    */
/* -------------------------------------------------------------------------- */

export const contactIntents = [
  {
    id: 'join',
    icon: '\u{1FA7A}',
    title: 'Interested in Joining the Lab?',
    body: 'MCA Heart brings together medical students, residents, fellows, physicians, and researchers working on cardiovascular research. Learn more about the lab and our application process.',
    ctaLabel: 'Join the Lab',
    href: '/join-lab',
  },
  {
    id: 'collaborate',
    icon: '\u{1F4E2}',
    title: 'Interested in Collaborating?',
    body: 'We work with researchers, physicians, institutions, and other organizations on cardiovascular research and education. For collaboration inquiries, contact our team and tell us a little about what you have in mind.',
    ctaLabel: "Let's Connect",
    href: '/contact#enquiry',
  },
] as const;

export const footerLinks = {
  quick: [
    { label: 'Heart Trending', href: '/education#heart-trending' },
    { label: 'MCA Heart Research Lab', href: '/research-group' },
    { label: 'Submit an Idea', href: '/submit-idea' },
    { label: 'Join the Lab', href: '/join-lab' },
    { label: 'Education', href: '/education' },
    { label: 'Contact', href: '/contact' },
  ],
  other: [
    { label: 'About Us', href: '/research-group#about' },
    { label: 'Our Team', href: '/research-group#voices' },
    { label: 'Networking', href: '/research-group#why-us' },
  ],
  legal: [
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms & Conditions', href: '/terms' },
  ],
} as const;
