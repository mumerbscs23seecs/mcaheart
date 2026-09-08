import { z } from 'zod';

/**
 * Research-idea intake form. Shared between the browser (hints) and the API
 * route (enforcement) so the two cannot drift.
 *
 * Mirrors the group's Google Form. Some fields are conditional on the research
 * type: "Database" ideas and "Meta-analysis" ideas ask for different things.
 * The uploaded file is handled separately in the API route.
 */

export const RESEARCH_TYPES = ['Database', 'Meta-analysis'] as const;
export type ResearchType = (typeof RESEARCH_TYPES)[number];

export const DATABASES = [
  'National Inpatient Sample (NIS)',
  'TriNetX',
  'DMC PCI Database',
  'National Readmissions Database',
  'Not sure',
] as const;
export type Database = (typeof DATABASES)[number];

export const CONFERENCES = ['TCT', 'SCAI', 'ACC', 'flexible', 'none'] as const;
export type Conference = (typeof CONFERENCES)[number];

export const CONFERENCE_LABELS: Record<Conference, string> = {
  TCT: 'TCT — Transcatheter Cardiovascular Therapeutics',
  SCAI: 'SCAI — Society for Cardiovascular Angiography and Interventions',
  ACC: 'ACC — American College of Cardiology',
  flexible: 'No specific conference — submit to whichever is nearest',
  none: 'Not aiming to present at a conference',
};

export const COMMITMENTS = ['agree', 'abstract-only'] as const;
export type Commitment = (typeof COMMITMENTS)[number];

/** Commitment wording differs by research type (1 month vs 2 months). */
export const COMMITMENT_LABELS: Record<ResearchType, Record<Commitment, string>> = {
  Database: {
    agree:
      'I can complete the manuscript draft within one month of receiving the analysis, and accept that I may be removed and the topic reassigned if I do not.',
    'abstract-only':
      'The topic may not suit a full-length paper — I intend to present the abstract only.',
  },
  'Meta-analysis': {
    agree:
      'I can complete the manuscript draft within two months, and accept that the topic may be reassigned to another lead if I do not.',
    'abstract-only':
      'The idea may not be amenable to a paper — I intend to do the abstract only.',
  },
};

const longText = (min: number, label: string, max = 3000) =>
  z.string().trim().min(min, `${label} — please add a little more detail.`).max(max, `${label} is too long.`);
const optText = (max: number) => z.string().trim().max(max).optional().default('');

export const ideaSchema = z
  .object({
    // --- shared ---------------------------------------------------------
    leadEmail: z.string().trim().toLowerCase().email('Enter a valid email address.').max(200),
    contactNumber: z
      .string()
      .trim()
      .min(5, 'Enter a contact number.')
      .max(40)
      .regex(/^[0-9+()\-.\s]+$/, 'Phone can only contain digits and + ( ) - .'),
    title: z.string().trim().min(6, 'Give the idea a title.').max(250, 'That title is too long.'),
    leadName: z.string().trim().min(2, 'Enter the lead investigator’s full name.').max(120),
    researchType: z.enum(RESEARCH_TYPES, { errorMap: () => ({ message: 'Choose the type of research.' }) }),

    population: longText(10, 'Population'),
    intervention: longText(2, 'Intervention / exposure'),
    comparison: longText(2, 'Control / comparison'),
    outcomes: longText(3, 'Outcomes'),
    rationale: z.string().trim().min(10, 'Add a short rationale.').max(600, 'Keep the rationale to about two lines.'),

    conference: z.enum(CONFERENCES, { errorMap: () => ({ message: 'Choose a conference option.' }) }),
    commitment: z.enum(COMMITMENTS, { errorMap: () => ({ message: 'Please select one of the commitment options.' }) }),

    // --- Database only --------------------------------------------------
    databases: z.array(z.enum(DATABASES)).optional().default([]),
    studyDesign: optText(600),
    priorStudies: optText(3000),
    latestStudy: optText(600),

    // --- Meta-analysis only -------------------------------------------
    previousMetaDate: optText(300),
    newStudies: optText(3000),
    sampleSizeIncrease: optText(120),

    // Honeypot — must pass; the route checks it after parsing.
    company: z.string().max(200).optional(),
  })
  .superRefine((d, ctx) => {
    const require = (field: keyof typeof d, min: number, message: string) => {
      const v = d[field];
      if (typeof v === 'string' && v.trim().length < min) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message });
      }
    };

    if (d.researchType === 'Database') {
      if (!d.databases || d.databases.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['databases'],
          message: 'Select at least one database (or “Not sure”).',
        });
      }
      require('studyDesign', 3, 'Describe the proposed study design.');
      require('priorStudies', 3, 'List similar published studies (or state that there are none).');
      require('latestStudy', 3, 'Provide the latest study published on this topic (DOI, year, author, journal).');
    } else {
      require('previousMetaDate', 2, 'When was the previous meta-analysis conducted?');
      require('newStudies', 5, 'List the NEW studies planned for inclusion, with links / DOIs.');
      require('sampleSizeIncrease', 1, 'Give the approximate % increase in sample size vs previous meta-analyses.');
    }
  });

export type IdeaPayload = z.infer<typeof ideaSchema>;

/** Upload constraints, enforced in the API route. */
export const UPLOAD = {
  maxBytes: 10 * 1024 * 1024,
  extensions: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt', '.png', '.jpg', '.jpeg'],
} as const;
