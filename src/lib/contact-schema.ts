import { z } from 'zod';

/**
 * Shared between the browser and the API route so client-side hints and
 * server-side enforcement can never drift apart.
 */

/** Every kind of request the admin inbox (Admin -> Requests) can hold. */
export const INTENTS = ['collaborate', 'recommendation', 'topic', 'observership', 'trending', 'other'] as const;
export type Intent = (typeof INTENTS)[number];

/** What the public Contact form offers. Letters of recommendation and joining
 *  a topic are members-only, asked for from the portal's Requests page. */
export const PUBLIC_INTENTS = ['collaborate', 'observership', 'trending', 'other'] as const;
export type PublicIntent = (typeof PUBLIC_INTENTS)[number];

export const INTENT_LABELS: Record<Intent, string> = {
  collaborate: 'Looking for a collaboration',
  recommendation: 'Letter of recommendation',
  topic: 'Join a new topic',
  observership: 'Request for observership',
  trending: 'Join Heart Trending',
  other: 'Other reason',
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

    intent: z.enum(PUBLIC_INTENTS, {
      errorMap: () => ({ message: 'Please choose why you are getting in touch.' }),
    }),

    // --- Collaboration - just the free-text note below.
    message: optText(4000),

    // --- Letter of recommendation. Older public enquiries only carried a
    // name; member requests (portal) carry the rest.
    recName: optText(120),
    recPurpose: optText(300),
    recDeadline: optText(20),
    recWork: optText(4000),

    // --- Join a new topic (members).
    topicArea: optText(300),
    topicRole: optText(120),
    topicHours: optText(40),
    topicNote: optText(4000),

    /** 'member' for requests sent from the portal. */
    source: optText(20),

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

    // --- Appearing on Heart Trending.
    trendingMessage: optText(4000),

    // --- Anything else. Each panel gets its own field rather than reusing
    // `message`, since a hidden panel's inputs still submit and two fields
    // of the same name would overwrite each other.
    otherMessage: optText(4000),
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

    if (data.intent === 'trending') {
      need(
        data.trendingMessage && data.trendingMessage.trim().length >= 10,
        'trendingMessage',
        'Please tell us a little more - at least 10 characters.',
      );
    }

    if (data.intent === 'other') {
      need(
        data.otherMessage && data.otherMessage.trim().length >= 10,
        'otherMessage',
        'Please tell us a little more - at least 10 characters.',
      );
    }
  });

/** A stored request: a public enquiry, or a member request from the portal. */
export type ContactPayload = Omit<z.infer<typeof contactSchema>, 'intent'> & { intent: Intent };

/** Member requests from the portal's Requests page. */
export const memberRequestSchema = z.discriminatedUnion('intent', [
  z.object({
    intent: z.literal('recommendation'),
    recPurpose: z.string({ required_error: 'Tell us what the letter is for.' }).trim().min(3, 'Tell us what the letter is for.').max(300),
    recDeadline: z.string({ required_error: 'Add the deadline.' }).trim().min(1, 'Add the deadline.').max(20),
    recWork: z.string({ required_error: 'List the papers or projects you worked on - at least 10 characters.' }).trim().min(10, 'List the papers or projects you worked on - at least 10 characters.').max(4000),
  }),
  z.object({
    intent: z.literal('topic'),
    topicArea: z.string({ required_error: 'Tell us the area or kind of topic.' }).trim().min(3, 'Tell us the area or kind of topic.').max(300),
    topicRole: z.string({ required_error: 'Choose how you would like to help.' }).trim().min(1, 'Choose how you would like to help.').max(120),
    topicHours: optText(40),
    topicNote: optText(4000),
  }),
]);

/** CV upload limit for the observership request - matches the field's own help text. */
export const OBS_CV = {
  field: 'obsCv',
  maxBytes: 10 * 1024 * 1024,
  extensions: ['.pdf', '.doc', '.docx'],
} as const;
