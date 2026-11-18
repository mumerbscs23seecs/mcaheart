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

/** Ways a member can offer to help on a new topic (the lab's skills, plus Other). */
export const TOPIC_ROLES = [
  'Analysis for TriNetX',
  'Analysis for NIS/NRD',
  'Manuscript writing',
  'Screening/Extraction for meta-analysis',
  'Visuals',
  'Other',
] as const;
export const TOPIC_ROLE_LABEL: Record<(typeof TOPIC_ROLES)[number], string> = {
  'Analysis for TriNetX': 'TriNetX analysis',
  'Analysis for NIS/NRD': 'NIS / NRD analysis',
  'Manuscript writing': 'Manuscript writing',
  'Screening/Extraction for meta-analysis': 'Screening and extraction for a meta-analysis',
  Visuals: 'Visual or graphical abstract, tables and figures',
  Other: 'Something else (write it in)',
};

/** How a member uses AI tools in their work. */
export const AI_PLANS = ['none', 'editing', 'drafting'] as const;
export const AI_PLAN_LABEL: Record<(typeof AI_PLANS)[number], string> = {
  none: 'I do not use AI tools',
  editing: 'Only for language and editing',
  drafting: 'For drafting text, code or analysis',
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
    // Added 17 Nov 2026: the kinds of help offered, availability, an AI
    // disclosure and three confirmations.
    topicRoles: z.array(z.string().max(80)).max(10).optional(),
    topicOther: optText(300),
    topicFrom: optText(20),
    topicUntil: optText(20),
    aiPlan: optText(20),
    aiPlanParts: optText(1000),
    aiProofread: optText(5),
    aiDeclaration: optText(5),
    deadlineAck: optText(5),
    textedCoordinator: optText(5),

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
    topicRoles: z.array(z.enum(TOPIC_ROLES)).min(1, 'Choose at least one way you can help.'),
    topicOther: optText(300),
    topicArea: optText(300),
    topicHours: z.string({ required_error: 'Tell us how many hours a week you can give.' }).trim().min(1, 'Tell us how many hours a week you can give.').max(40),
    topicFrom: z.string({ required_error: 'Add the date you can start.' }).trim().min(1, 'Add the date you can start.').max(20),
    topicUntil: optText(20),
    aiPlan: z.enum(AI_PLANS, { errorMap: () => ({ message: 'Tell us whether you use AI tools.' }) }),
    aiPlanParts: optText(1000),
    // Only asked when AI is used (the declaration below).
    aiDeclaration: optText(5),
    deadlineAck: z.literal('yes', { errorMap: () => ({ message: 'Please confirm this.' }) }),
    textedCoordinator: z.literal('yes', { errorMap: () => ({ message: 'Please text Muhammad Burhan first, then tick this.' }) }),
    topicNote: optText(4000),
  }),
]).superRefine((d, ctx) => {
    if (d.intent !== 'topic') return;
    if (d.topicRoles.includes('Other') && !d.topicOther?.trim())
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['topicOther'], message: 'Say what else you can help with.' });
    if (d.aiPlan !== 'none' && !d.aiPlanParts?.trim())
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['aiPlanParts'], message: 'Say which parts AI would help with.' });
    if (d.aiPlan !== 'none' && d.aiDeclaration !== 'yes')
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['aiDeclaration'], message: 'Please accept the AI declaration.' });
    if (d.topicUntil && d.topicFrom && d.topicUntil < d.topicFrom)
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['topicUntil'], message: 'The end date is before the start date.' });
  });



/** CV upload limit for the observership request - matches the field's own help text. */
export const OBS_CV = {
  field: 'obsCv',
  maxBytes: 10 * 1024 * 1024,
  extensions: ['.pdf', '.doc', '.docx'],
} as const;

/** Shown to members who say they use AI tools (Join a new topic). */
export const AI_DECLARATION =
  'I confirm that AI will be used exclusively for text editing and refinement, not for content generation or interpretation. All intellectual contributions, research and analysis will be my own. I accept full responsibility for the accuracy and academic integrity of my work.';
/** Every member confirms this before joining a topic. */
export const DEADLINE_DECLARATION =
  'I acknowledge that failure to complete an assigned task within the specified timeframe may result in removal from the assigned project or topic, and may affect my eligibility for future research opportunities.';
