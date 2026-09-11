import { z } from 'zod';

/**
 * Shared between the browser and the API route so client-side hints and
 * server-side enforcement can never drift apart.
 */

export const INTENTS = ['join', 'collaborate'] as const;
export type Intent = (typeof INTENTS)[number];

export const contactSchema = z.object({
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

  message: z
    .string()
    .trim()
    .min(10, 'Please tell us a little more - at least 10 characters.')
    .max(4000, 'Please keep your message under 4000 characters.'),

  // Honeypot: real users never see or fill this field. It must *pass*
  // validation so bots get a 200 rather than a hint that they were caught -
  // the route checks it after parsing.
  company: z.string().max(200).optional(),
});

export type ContactPayload = z.infer<typeof contactSchema>;

export const INTENT_LABELS: Record<Intent, string> = {
  join: 'Interested in joining the MCA Research Group',
  collaborate: 'Looking for a collaboration',
};
