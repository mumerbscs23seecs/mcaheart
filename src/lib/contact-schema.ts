import { z } from 'zod';

/**
 * Shared between the browser and the API route so client-side hints and
 * server-side enforcement can never drift apart.
 */

export const INTENTS = ['collaborate', 'recommendation', 'observership'] as const;
export type Intent = (typeof INTENTS)[number];

export const INTENT_LABELS: Record<Intent, string> = {
  collaborate: 'Looking for a collaboration',
  recommendation: 'Letter of recommendation',
  observership: 'Request for observership',
};

export const VISA_OPTIONS = [
  "I don't need a visa to complete rotation",
  'I need a visa and I have a valid visa',
  'I need a visa and would need to apply for visa',
] as const;
export type VisaOption = (typeof VISA_OPTIONS)[number];

const optText = (max: number) => z.string().trim().max(max).optional().or(z.literal(''));

export const contactSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, 'Please enter your full name.')
      .max(120, 'That name is too long.'),

    email: z
      .string()
      .trim()
      .toLowerCase()
      .email('Please enter a valid email address.')
      .max(200),

    phone: z
      .string()
      .trim()
      .max(40)
      .regex(/^[0-9+()\-.\s]*$/, 'Phone can only contain digits and + ( ) - .')
      .optional()
      .or(z.literal('')),

    location: z.string().trim().max(160).optional().or(z.literal('')),

    designation: z.string().trim().max(160).optional().or(z.literal('')),

    intent: z.enum(INTENTS, {
      errorMap: () => ({ message: 'Please choose why you are getting in touch.' }),
    }),

    // --- Collaboration - just the free-text note below.
    message: optText(4000),

    // --- Letter of recommendation - more fields to follow; just a name for now.
    recName: optText(120),

    // --- Request for observership.
    obsName: optText(120),
    obsApplyDate: optText(60),
    obsNeedsLetter: z.enum(['yes', 'no']).optional(),
    obsStatus: optText(2000),
    obsUsmle: optText(2000),
    obsVisa: z.enum(VISA_OPTIONS).optional(),
    obsGradYear: optText(40),
    obsStart: optText(20),
    obsEnd: optText(20),
    // The CV file itself arrives as a File in the multipart body and is
    // pulled straight off the FormData in the API route, not through zod.

    // Honeypot: real users never see or fill this field. It must *pass*
    // validation so bots get a 200 rather than a hint that they were caught -
    // the route checks it after parsing.
    company: z.string().max(200).optional(),
  })
  .superRefine((data, ctx) => {
    const need = (ok: unknown, path: string, message: string) => {
      if (!ok) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
    };

    if (data.intent === 'collaborate') {
      need(
        data.message && data.message.trim().length >= 10,
        'message',
        'Please tell us a little more - at least 10 characters.',
      );
    }

    if (data.intent === 'recommendation') {
      need(data.recName && data.recName.trim().length >= 2, 'recName', 'Please enter your full name.');
    }

    if (data.intent === 'observership') {
      need(data.obsName && data.obsName.trim().length >= 2, 'obsName', 'Please enter your name.');
      need(
        data.obsApplyDate && data.obsApplyDate.trim().length >= 3,
        'obsApplyDate',
        'Please tell us when you plan to apply.',
      );
      need(data.obsNeedsLetter, 'obsNeedsLetter', 'Please choose yes or no.');
      need(
        data.obsStatus && data.obsStatus.trim().length >= 5,
        'obsStatus',
        'Please tell us your exact professional status.',
      );
      need(data.obsVisa, 'obsVisa', 'Please choose the option that fits you.');
      need(
        data.obsGradYear && data.obsGradYear.trim().length >= 4,
        'obsGradYear',
        'Please enter your year of graduation.',
      );
      need(data.obsStart, 'obsStart', 'Please add an intended start date.');
      need(data.obsEnd, 'obsEnd', 'Please add an intended end date.');
    }
  });

export type ContactPayload = z.infer<typeof contactSchema>;

/** CV upload limit for the observership request - matches the field's own help text. */
export const OBS_CV = {
  field: 'obsCv',
  maxBytes: 10 * 1024 * 1024,
  extensions: ['.pdf', '.doc', '.docx'],
} as const;
