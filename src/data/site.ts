/**
 * Single source of truth for site content.
 * Copy lifted from the original mcaheart.com Wix build, restructured so
 * every page reads from typed data rather than hard-coded markup.
 */

export const site = {
  name: 'MCA Heart',
  tagline: 'Charting New Paths in Cardiology',
  description:
    'MCA Heart is a cardiovascular research collective led by M Chadi Alraies, MD, MPH - over 300 researchers publishing, presenting and teaching at the frontier of cardiology.',
  url: 'https://www.mcaheart.com',
  youtube: 'https://www.youtube.com/channel/UCR1U9EROhLsdeuCB4hlAw4w',
} as const;

export type NavLink = { label: string; href: string };
export type NavItem = { label: string; href?: string; children?: NavLink[] };

export const nav: NavItem[] = [
  { label: 'Heart Trending', href: '/heart-trending' },
  {
    label: 'Research',
    href: '/research-group',
    children: [
      { label: 'MCA Heart Research Lab', href: '/research-group' },
      { label: 'Publications', href: '/publications' },
    ],
  },
  {
    label: 'Get Involved',
    href: '/submit-idea',
    children: [
      { label: 'Submit an Idea', href: '/submit-idea' },
      { label: 'Join the Lab', href: '/join-lab' },
    ],
  },
  { label: 'Education', href: '/education' },
  { label: 'Contact', href: '/contact' },
];

export const director = {
  name: 'M Chadi Alraies',
  /** Short form - sits inline with the name everywhere, including the homepage headline. */
  credentials: 'MD, MPH',
  /** The extra fellowships - homepage only, shown as a secondary line under the name. */
  credentialsExtra: 'FACC, FSCAI',
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
} as const;

export const stats = [
  { value: '100+', label: 'papers published in major journals' },
  { value: '10+', label: 'presentations at every major conference' },
  { value: '10+', label: 'attendees at every major conference' },
  { value: '100+', label: 'active group members' },
] as const;

export const societies = [
  { name: 'SCAI - Society for Cardiovascular Angiography & Interventions', logo: '/assets/home/logo-scai.png' },
  { name: 'ACC - American College of Cardiology', logo: '/assets/home/logo-acc.jpg' },
  { name: 'AHA - American Heart Association', logo: '/assets/home/logo-aha.jpg' },
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
      "I've been part of the MCA Heart Research Lab since 2021, joining after meeting Dr. Yasar Sattar at ACC that year. This group and the mentorship provided by M Chadi Alraies, MD, MPH has been one of the most important reasons I matched into cardiology fellowship in the first attempt. The collegiality that exists here and the opportunities in research for trainees of all levels is unparalleled. Privileged to be a part of MCA.",
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
      'This group has allowed me to connect with other passionate professionals interested in Cardiology. The mentorship I’ve received from M Chadi Alraies, MD, MPH is invaluable and has really expanded my personal and professional growth.',
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
    body: 'At the MCA Heart Research Lab, we are a diverse community of researcher-physicians united by shared goals of growth, discovery, and impact. We foster collaboration, share knowledge, and support one another to thrive. Together, we are shaping the future of cardiovascular research while building lasting global connections.',
  },
  {
    kind: 'Our Vision',
    image: '/assets/research/vision.jpg',
    body: 'To lead the future of cardiovascular research through innovation, collaboration, and inclusivity. We aim to advance cardiology, improve patient outcomes, and empower the next generation of researchers to make a global impact.',
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
    body: 'Through our dedicated video series, including the flagship Heart of the Matter, we provide in-depth reviews of impactful cardiology research articles. Join us in exploring the science shaping the future of heart health.',
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
    { label: 'Publications', href: '/publications' },
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
