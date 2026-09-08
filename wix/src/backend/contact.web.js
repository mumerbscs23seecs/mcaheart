/**
 * Velo web module — contact form handling.
 *
 * Destination in the Wix repo:  src/backend/contact.web.js
 *
 * This is the Wix equivalent of src/pages/api/contact.ts in the Astro build.
 * Call it from page code with:
 *
 *   import { submitEnquiry } from 'backend/contact.web';
 *   const result = await submitEnquiry(payload);
 */

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';

const INTENTS = ['join', 'collaborate'];

const INTENT_LABELS = {
  join: 'Interested in joining the MCA Research Group',
  collaborate: 'Looking for a collaboration',
};

/** Collection to create in the Content Manager (see wix/README.md). */
const COLLECTION = 'Enquiries';

const str = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * Mirrors the zod schema in src/lib/contact-schema.ts. Kept dependency-free
 * because Velo backend files should stay light.
 */
function validate(input) {
  const errors = {};

  const fullName = str(input.fullName);
  if (fullName.length < 2) errors.fullName = 'Please enter your full name.';
  else if (fullName.length > 120) errors.fullName = 'That name is too long.';

  const email = str(input.email).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    errors.email = 'Please enter a valid email address.';
  }

  const phone = str(input.phone);
  if (phone && !/^[0-9+()\-.\s]{0,40}$/.test(phone)) {
    errors.phone = 'Phone can only contain digits and + ( ) - .';
  }

  const intent = str(input.intent);
  if (!INTENTS.includes(intent)) {
    errors.intent = 'Please choose why you are getting in touch.';
  }

  const message = str(input.message);
  if (message.length < 10) {
    errors.message = 'Please tell us a little more — at least 10 characters.';
  } else if (message.length > 4000) {
    errors.message = 'Please keep your message under 4000 characters.';
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    data: {
      fullName,
      email,
      phone,
      location: str(input.location).slice(0, 160),
      designation: str(input.designation).slice(0, 160),
      intent,
      intentLabel: INTENT_LABELS[intent],
      message,
    },
  };
}

export const submitEnquiry = webMethod(Permissions.Anyone, async (payload = {}) => {
  // Honeypot: accept silently so bots get no signal that they were caught.
  if (str(payload.company)) {
    return { ok: true, message: 'Thank you — your enquiry has been received.' };
  }

  const { ok, errors, data } = validate(payload);
  if (!ok) {
    return { ok: false, error: 'Please check the highlighted fields.', fieldErrors: errors };
  }

  try {
    await wixData.insert(
      COLLECTION,
      { ...data, submittedAt: new Date() },
      { suppressAuth: true },
    );
  } catch (err) {
    console.error('[contact] insert failed:', err);
    return {
      ok: false,
      error: 'We could not send that just now. Please email us directly.',
    };
  }

  return {
    ok: true,
    message: 'Thank you — your enquiry has been received. We will be in touch shortly.',
  };
});
