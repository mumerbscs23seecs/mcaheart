import { z } from 'zod';

/**
 * MCA Research Lab recruitment application. Shared between the browser (hints)
 * and the API route (enforcement). The CV and headshot files are handled in
 * the API route — they arrive as Files in the multipart body.
 */

export const JOB_STATUSES = [
  'PGY-1 IM',
  'PGY-2 IM',
  'PGY-3 IM',
  'USMLE aspirant / IM residency applicant',
  'Cardiology fellow',
  'Medical student / pre-med',
  'Attending / hospitalist',
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const EXPERTISE = [
  'Data screening / extraction for meta-analysis',
  'Analysis for meta-analysis',
  'Manuscript writing',
  'Large database analysis (NIS / NRD / NEDS / CDC)',
  'Visuals',
  'Not much experience in any of these',
] as const;
export type Expertise = (typeof EXPERTISE)[number];

const longText = (min: number, label: string, max = 4000) =>
  z.string().trim().min(min, `${label} — please add a little more.`).max(max, `${label} is too long.`);
const optText = (max: number) => z.string().trim().max(max).optional().default('');

export const recruitmentSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name.').max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(200),

  gradYear: z
    .string()
    .trim()
    .min(4, 'Enter the year you graduated (or expect to).')
    .max(40),

  jobStatus: z.enum(JOB_STATUSES, { errorMap: () => ({ message: 'Select your current status.' }) }),

  fellowshipPlan: z
    .string()
    .trim()
    .min(1, 'Enter your plan, or "N/A".')
    .max(300),

  researchExperience: longText(10, 'Research experience'),
  letterOfInterest: longText(20, 'Letter of interest'),

  expertise: z.enum(EXPERTISE, { errorMap: () => ({ message: 'Select your main area of expertise.' }) }),

  profileLink: z
    .string()
    .trim()
    .min(4, 'Add a ResearchGate, Google Scholar or PubMed link.')
    .max(500),

  currentStatus: optText(2000),
  professionalGoals: optText(1000),
  internalRef: optText(1000),

  referralSource: longText(3, 'How you heard about us'),

  whatsapp: z
    .string()
    .trim()
    .min(6, 'Enter your WhatsApp number with country code.')
    .max(40)
    .regex(/^[0-9+()\-.\s]+$/, 'Phone can only contain digits and + ( ) - .'),

  // Honeypot — must pass; the route checks it after parsing.
  company: z.string().max(200).optional(),
});

export type RecruitmentPayload = z.infer<typeof recruitmentSchema>;

/**
 * Upload limits enforced in the API route. Kept modest for the in-memory demo;
 * production stores files in object storage and can allow much larger.
 */
export const UPLOADS = {
  cv: { field: 'cv', maxBytes: 15 * 1024 * 1024, extensions: ['.pdf', '.doc', '.docx'] },
  headshot: { field: 'headshot', maxBytes: 8 * 1024 * 1024, extensions: ['.png', '.jpg', '.jpeg', '.webp'] },
} as const;
