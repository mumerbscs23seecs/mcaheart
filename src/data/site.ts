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
  { label: 'Heart Trending', href: '/heart-trending' },
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
  /** Homepage director card - profile links, icon-only buttons. */
  links: [
    { label: 'X', icon: 'x', url: 'https://x.com/chadialraies' },
    { label: 'LinkedIn', icon: 'linkedin', url: 'https://www.linkedin.com/in/chadi-alraies-md-facc-fscai-65131711/' },
    { label: 'Wayne State University profile', icon: 'university', url: 'https://cardiology.med.wayne.edu/profile/hj4412' },
    { label: 'Detroit Medical Center profile', icon: 'hospital', url: 'https://www.dmc.org/provider/1689828238' },
    { label: 'ResearchGate', icon: 'researchgate', url: 'https://www.researchgate.net/profile/M-Chadi-Alraies' },
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
  { value: '75+', label: 'manuscripts published a year' },
  { value: '150+', label: 'abstracts presented a year' },
  { value: '300+', label: 'active researchers & trainees' },
] as const;

export const societies = [
  {
    name: 'SCAI - Society for Cardiovascular Angiography & Interventions',
    logo: '/assets/home/logo-scai.png',
    // White-on-transparent variant for dark mode - the default logo's dark
    // wordmark disappears against a dark page background.
    logoDark: '/assets/home/logo-scai-dark.webp',
    url: 'https://www.jscai.org/action/doSearch?type=quicksearch&text1=chadi+alraies&field1=AllField&startPage=&ContentItemType=abs',
  },
  {
    name: 'ACC - American College of Cardiology',
    logo: '/assets/home/logo-acc.jpg',
    logoDark: '/assets/home/logo-acc-dark.webp',
    url: 'https://www.jacc.org/action/doSearch?AllField=%28chadi+alraies%29+AND+%28ACC%29',
  },
  {
    name: 'TCT - Transcatheter Cardiovascular Therapeutics',
    logo: '/assets/home/logo-tct.png',
    logoDark: '/assets/home/logo-tct-dark.webp',
    url: 'https://www.jacc.org/action/doSearch?AllField=%28chadi+alraies%29+AND+%28TCT%29',
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

export const videos: Video[] = [
  {
    title: 'NCVH 2024 Interviews',
    youtubeId: 'Si95Wgru8hY',
    thumb: '/assets/trending/video-1.jpg',
    blurb: 'Faculty interviews recorded on the floor at New Cardiovascular Horizons.',
  },
  {
    title: 'Pulmonary Embolism',
    youtubeId: '0i0CelwftRk',
    thumb: '/assets/trending/video-2.jpg',
    blurb: 'A focused discussion on contemporary PE management and intervention.',
  },
  {
    title: 'TCT 2024 Wrap Up',
    youtubeId: 'k7JguFN_BAY',
    thumb: '/assets/trending/video-3.jpg',
    blurb: 'The trials, the data and the takeaways from Transcatheter Cardiovascular Therapeutics.',
  },
  {
    title: 'NYEVS 2024',
    youtubeId: 'tCDK0wvu6RE',
    thumb: '/assets/trending/video-4.jpg',
    blurb: 'Highlights from the New York Endovascular Symposium.',
  },
  {
    title: 'SCAI 2024',
    youtubeId: 'yp0oDs7AHZ0',
    thumb: '/assets/trending/video-5.jpg',
    blurb: 'Conversations with interventional leaders at the SCAI Scientific Sessions.',
  },
  {
    title: 'ESC Congress 2024 Interviews',
    youtubeId: 'uveL7Xj_ObE',
    thumb: '/assets/trending/video-6.jpg',
    blurb: 'European Society of Cardiology congress coverage and investigator interviews.',
  },
  {
    title: 'TCT Presenters Promo',
    youtubeId: 'PW1UN0ZBgHI',
    thumb: '/assets/trending/video-7.jpg',
    blurb: 'Meet the MCA researchers presenting their work at TCT.',
  },
  {
    title: 'Monthly Webinar',
    youtubeId: 'z36YGMAaBwk',
    thumb: '/assets/trending/video-8.jpg',
    blurb: 'Recent publications on interventional, endovascular and structural technique.',
  },
];

/* -------------------------------------------------------------------------- */
/* Research group                                                             */
/* -------------------------------------------------------------------------- */

export type Testimonial = {
  quote: string;
  name: string;
  affiliation: string;
  future: string;
  photo: string;
};

export const testimonials: Testimonial[] = [
  {
    quote:
      "I've been part of the MCA Heart Research Lab since 2021, joining after meeting Dr. Yasar Sattar at ACC that year. This group and the mentorship provided by M Chadi Alraies, MD MPH has been one of the most important reasons I matched into cardiology fellowship in the first attempt. The collegiality that exists here and the opportunities in research for trainees of all levels is unparalleled. Privileged to be a part of MCA.",
    name: 'Varun Victor',
    affiliation: 'Aultman Hospital / Canton Medical Education Foundation / NEOMED University',
    future: 'Interventional Cardiology fellowship',
    photo: '/assets/research/varun-victor.jpg',
  },
  {
    quote:
      'Joining the MCA Heart Research Lab has not only deepened my research skills but also connected me with like-minded individuals who share my passion for the field. These collaborations have been invaluable as I prepare for my cardiology application.',
    name: 'Heena Kaushal Asnani',
    affiliation: 'IM Resident at Roger Williams Medical Center, Boston University',
    future: 'Cardiology fellowship',
    photo: '/assets/research/heena-asnani.jpg',
  },
  {
    quote:
      'This group has allowed me to connect with other passionate professionals interested in Cardiology. The mentorship I’ve received from M Chadi Alraies, MD MPH is invaluable and has really expanded my personal and professional growth.',
    name: 'Ankit Hanmandlu',
    affiliation: 'Wayne State University / Detroit Medical Center',
    future: 'Cardiology',
    photo: '/assets/research/ankit-hanmandlu.jpg',
  },
  {
    quote:
      "This group has been instrumental in helping me achieve my goals by exposing me to some of the most important topics in cardiology. The collaborative environment sharpens my skills in identifying valuable research questions in the field. These experiences have laid a strong foundation for my future endeavors in academic and clinical cardiology.",
    name: 'Amir Behzad Bagheri',
    affiliation: 'Internal Medicine Department, University of Pittsburgh Medical Center',
    future: 'Interventional Cardiology',
    photo: '/assets/research/amir-bagheri.jpg',
  },
  {
    quote:
      'This group introduced me to clinical research that aligns with my interest in cardiology, building on my experience shadowing and working as a medical assistant intern in the field.',
    name: 'Mowaffak Alraiyes',
    affiliation: 'Interventional Cardiology Research Department, Wayne State School of Medicine, DMC',
    future: 'Medical School',
    photo: '/assets/research/mowaffak-alraiyes.jpg',
  },
  {
    quote:
      'This group has helped me make connections and build my CV by doing high-quality research.',
    name: 'Salman Abdul Basit',
    affiliation: 'Resident Physician, Internal Medicine, The Wright Center',
    future: 'Cardiology Aspirant',
    photo: '/assets/research/salman-basit.jpg',
  },
];

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
    cadence: 'New episodes every other Saturday',
    quote:
      'Join our expert team as they review the latest published research articles, delivering insights and practical implications for cardiology.',
    body: 'The Heart of the Matter is an educational series led by residents and medical students, focused on the latest randomized controlled trials and emerging evidence in cardiovascular medicine. Each episode takes a closer look at the research behind important developments in cardiology, exploring study design, patient populations, interventions, outcomes, statistical findings, limitations, and clinical implications. The series encourages participants to look beyond the headline results, critically evaluate the evidence, and develop a deeper understanding of how new research may influence cardiovascular practice.',
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
    title: 'Looking to join us?',
    body: 'Passionate about cardiology? Whether you are a researcher, physician, or medical student, the MCA Heart Research Lab is the place to grow your skills and contribute to impactful research.',
  },
  {
    id: 'collaborate',
    icon: '\u{1F4E2}',
    title: 'Want to collaborate?',
    body: 'We welcome partnerships with researchers, institutions and industry leaders. Let us work together on groundbreaking cardiovascular studies.',
  },
] as const;

export const footerLinks = {
  quick: [
    { label: 'Heart Trending', href: '/heart-trending' },
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
    { label: 'Latest Content', href: '/heart-trending' },
    { label: 'Events', href: '/education' },
  ],
  legal: [
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms & Conditions', href: '/terms' },
  ],
} as const;
