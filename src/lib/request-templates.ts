/**
 * Reply templates for Review > Requests, in the same shape as the paper email
 * library (src/lib/email-templates.ts): a category, a title, a one-line
 * description, a subject and a body. The reply page fills the placeholders
 * from the request and lets the coordinator edit everything before sending.
 *
 * Placeholders: {{recipient}} {{sender}} {{topic}} {{purpose}} {{deadline}}
 * {{start}} {{end}} {{notes}} {{ideaLink}} {{joinLink}}
 */
export interface RequestTemplate {
  category: string;
  title: string;
  description: string;
  subject: string;
  body: string;
}

/** Which category opens first for each kind of request. */
export const CATEGORY_FOR_INTENT: Record<string, string> = {
  collaborate: 'Collaboration',
  recommendation: 'Letter of recommendation',
  topic: 'Joining a topic',
  observership: 'Observership',
  trending: 'Heart Trending',
  other: 'General',
};

const SIGN = `Best regards,
{{sender}}
MCA Heart Research Lab
researchlab@mcaheart.com`;

const t = (category: string, title: string, description: string, subject: string, body: string): RequestTemplate =>
  ({ category, title, description, subject, body: `${body.trim()}\n\n${SIGN}` });

export const REQUEST_TEMPLATES: RequestTemplate[] = [
  // ---------------------------------------------------------------- collaboration
  t('Collaboration', 'Interested: ask for project details',
    'Show interest and ask for what the team needs to assess the proposal.',
    'Your collaboration proposal to MCA Heart Research Lab', `
Dear {{recipient}},

Thank you for contacting MCA Heart Research Lab and for your interest in collaborating with us. We have read your message and would be glad to explore this further.

To help us assess the proposal, could you please share:
- the research question and study design you have in mind
- the data source, setting or resources involved
- your proposed timeline and any target conference or journal
- the roles you expect each team to take

Once we have these details, we will review them with Dr. Alraies and get back to you with next steps.

{{notes}}`),
  t('Collaboration', 'Invite to a call',
    'Suggest a short call to discuss the collaboration.',
    'Arranging a call about your collaboration proposal', `
Dear {{recipient}},

Thank you for your message and for the details you shared. We would like to discuss your proposal in more detail.

Could you please let us know two or three times over the coming week that would suit you for a short video call of about 20 minutes? Please include your time zone, and we will confirm a slot and send a meeting link.

{{notes}}`),
  t('Collaboration', 'Under review with Dr. Alraies',
    'Confirm the proposal has been passed to Dr. Alraies for review.',
    'Your collaboration proposal is under review', `
Dear {{recipient}},

Thank you for your proposal. We have shared it with Dr. Alraies for review and will be in touch once we have his feedback. This usually takes one to two weeks.

If anything changes on your side in the meantime, or if you have additional material to share, please reply to this email.

{{notes}}`),
  t('Collaboration', 'Research idea: use the idea form',
    'Point them to the idea submission form for a structured review.',
    'Submitting your research idea to MCA Heart Research Lab', `
Dear {{recipient}},

Thank you for sharing your research idea with us. So that our team can review it properly, please submit it through our research idea form:

{{ideaLink}}

The form asks for the population, exposure, comparison and outcomes, which allows Dr. Alraies and the Research Fellows to assess feasibility and decide on next steps. You will hear from us once the review is complete.

{{notes}}`),
  t('Collaboration', 'Unable to collaborate at this time',
    'Decline politely, leaving the door open for the future.',
    'Your collaboration proposal', `
Dear {{recipient}},

Thank you for contacting MCA Heart Research Lab and for thinking of us for this project.

After careful consideration, we are unable to take on this collaboration at present, as our team's current commitments would not allow us to give it the attention it deserves. This is not a reflection on the merit of your proposal.

We would be glad to hear from you again in the future, and we wish you every success with the project.

{{notes}}`),

  // ---------------------------------------------------------------- recommendation
  t('Letter of recommendation', 'Request received and under review',
    'Acknowledge the request, with the purpose and deadline they gave.',
    'Your letter of recommendation request', `
Dear {{recipient}},

Thank you for your request for a letter of recommendation for {{purpose}}. We have noted your deadline of {{deadline}}.

Letter requests are considered individually, based on each member's contributions, reliability and engagement with the lab. We will review your request with Dr. Alraies and let you know the outcome as soon as possible.

{{notes}}`),
  t('Letter of recommendation', 'More information needed',
    'Ask for the documents and details needed to consider the letter.',
    'Information needed for your letter of recommendation', `
Dear {{recipient}},

Thank you for your request for a letter of recommendation for {{purpose}}. Before we can consider it, could you please send us:
- your current CV
- a list of the projects and papers you contributed to in the lab, with your role in each
- the program or position the letter is for, and how it should be submitted (portal link, email address or upload instructions)
- any specific points the letter should address

Please send these at least three weeks before your deadline of {{deadline}}, so there is enough time to prepare the letter.

{{notes}}`),
  t('Letter of recommendation', 'Approved: letter in preparation',
    'Confirm the letter is being prepared and explain the next steps.',
    'Your letter of recommendation', `
Dear {{recipient}},

We are pleased to let you know that Dr. Alraies has agreed to provide a letter of recommendation for {{purpose}}.

The letter is now being prepared, and we will submit it before your deadline of {{deadline}}. If the program sends a request or portal link directly, please forward it to us so nothing is missed.

Thank you for your contributions to the lab.

{{notes}}`),
  t('Letter of recommendation', 'Letter submitted',
    'Confirm the letter has been sent or uploaded.',
    'Your letter of recommendation has been submitted', `
Dear {{recipient}},

This is to confirm that your letter of recommendation for {{purpose}} has been submitted.

Please check your application portal to confirm it has been received, and let us know if anything else is needed. We wish you the very best with your application.

{{notes}}`),
  t('Letter of recommendation', 'Deadline too close',
    'Explain the deadline does not leave enough time to prepare a letter.',
    'Your letter of recommendation request', `
Dear {{recipient}},

Thank you for your request for a letter of recommendation for {{purpose}}.

Unfortunately, the deadline of {{deadline}} does not leave enough time for the letter to be reviewed and prepared properly. We ask for at least three weeks' notice for every letter request.

If the deadline can be extended, or for future applications, please send your request again with more notice and we will be glad to consider it.

{{notes}}`),
  t('Letter of recommendation', 'Unable to provide a letter',
    'Decline formally, with the lab policy as the reason.',
    'Your letter of recommendation request', `
Dear {{recipient}},

Thank you for your request for a letter of recommendation for {{purpose}}.

Letters are provided only where a member's demonstrated contributions, performance and engagement with the lab allow Dr. Alraies to write a strong and specific letter, and only for members who are currently active in the lab. After reviewing your request, we are unable to provide a letter at this time.

We appreciate your involvement with the lab and wish you every success with your application.

{{notes}}`),

  // ---------------------------------------------------------------- topic
  t('Joining a topic', 'Noted: we will match you',
    'Confirm their interest is recorded and they will be matched when a topic opens.',
    'Your request to join a research topic', `
Dear {{recipient}},

Thank you for your interest in joining a new research topic in {{topic}}.

We have noted your preferences and the time you can commit. When a suitable topic opens, a Research Fellow will contact you with the details and introduce you to the project lead. Topics open regularly, but the wait can be a few weeks.

In the meantime, you are welcome to attend the weekly meeting every Sunday at 12:00 noon Eastern Time, where new topics are often announced.

{{notes}}`),
  t('Joining a topic', 'Topic available: next steps',
    'Offer a place on a topic and explain what happens next.',
    'A research topic is available for you', `
Dear {{recipient}},

Thank you for your interest in joining a research topic in {{topic}}. We are pleased to let you know that a place is available on a project that matches your interests.

The project lead will contact you shortly with the protocol, your role and the timeline. Please reply to confirm that you are able to take this on, and let us know if your availability has changed.

{{notes}}`),
  t('Joining a topic', 'More detail needed',
    'Ask about skills, experience and time commitment before matching.',
    'Your request to join a research topic', `
Dear {{recipient}},

Thank you for your interest in joining a research topic in {{topic}}. To match you with the right project, could you please tell us:
- which tasks you are most comfortable with (for example screening, data extraction, statistical analysis, writing or visuals)
- any databases or software you have used, such as TriNetX, NIS, NRD, R or Stata
- the number of hours you can commit each week, and for how long

Once we have this, we will look for a suitable project.

{{notes}}`),
  t('Joining a topic', 'No suitable topic right now',
    'Explain there is no matching topic at present.',
    'Your request to join a research topic', `
Dear {{recipient}},

Thank you for your interest in joining a research topic in {{topic}}.

At present, we do not have an open topic that matches your interests and availability. We have kept your details and will contact you if a suitable topic becomes available. You are also welcome to propose your own idea through our research idea form:

{{ideaLink}}

{{notes}}`),

  // ---------------------------------------------------------------- observership
  t('Observership', 'Request received and under review',
    'Acknowledge the request and the dates they asked for.',
    'Your observership request', `
Dear {{recipient}},

Thank you for your interest in an observership with Dr. Alraies. We have received your request for {{start}} to {{end}}.

Observership places are limited and depend on availability and hospital approval. We will review your request and come back to you with the next steps. In the meantime, please make sure your CV is up to date in case we ask for it.

{{notes}}`),
  t('Observership', 'Documents needed',
    'Ask for the documents needed to process the observership.',
    'Documents needed for your observership request', `
Dear {{recipient}},

Thank you for your observership request for {{start}} to {{end}}. To move forward, could you please send us:
- your current CV
- your USMLE score reports, if available
- a copy of your passport and, if applicable, your visa
- proof of immunizations and any other documents the hospital requires

Once we have these, we will submit your request for hospital approval.

{{notes}}`),
  t('Observership', 'Dates available: next steps',
    'Confirm the dates can be offered and explain what happens next.',
    'Your observership with Dr. Alraies', `
Dear {{recipient}},

We are pleased to let you know that an observership with Dr. Alraies is available for {{start}} to {{end}}, subject to final hospital approval.

We will send you the onboarding steps and the list of required documents shortly. Please reply to confirm that you would like to take this place.

{{notes}}`),
  t('Observership', 'Dates unavailable: other dates',
    'Explain the dates are taken and ask for alternatives.',
    'Your observership request', `
Dear {{recipient}},

Thank you for your observership request. Unfortunately, the dates you asked for, {{start}} to {{end}}, are no longer available.

If your plans are flexible, please reply with two or three alternative periods and we will check availability for you.

{{notes}}`),
  t('Observership', 'Unable to offer an observership',
    'Decline formally.',
    'Your observership request', `
Dear {{recipient}},

Thank you for your interest in an observership with Dr. Alraies.

We receive many more requests than we are able to host, and unfortunately we are unable to offer you an observership at this time. This decision reflects our limited capacity rather than your qualifications.

We wish you every success in your training and future applications.

{{notes}}`),

  // ---------------------------------------------------------------- heart trending
  t('Heart Trending', 'Welcome to Heart Trending',
    'Welcome them and explain the next steps.',
    'Joining Heart Trending', `
Dear {{recipient}},

Thank you for your interest in joining Heart Trending. We would be glad to have you contribute.

A member of the Heart Trending team will contact you shortly with the format, the topics currently planned and how to submit your first piece. If you already have a topic in mind, please reply with a short outline.

{{notes}}`),
  t('Heart Trending', 'More information needed',
    'Ask for a sample or outline before going further.',
    'Your interest in Heart Trending', `
Dear {{recipient}},

Thank you for your interest in Heart Trending. To help us take this forward, could you please send:
- a short outline of the topic you would like to cover
- any previous writing, posts or videos you have produced
- how often you would be able to contribute

{{notes}}`),
  t('Heart Trending', 'Not able at this time',
    'Decline politely for now.',
    'Your interest in Heart Trending', `
Dear {{recipient}},

Thank you for your interest in contributing to Heart Trending. At present, our contributor places are full, so we are unable to take on new contributors.

We have kept your details and will contact you if a place becomes available.

{{notes}}`),

  // ---------------------------------------------------------------- general
  t('General', 'Acknowledge and follow up',
    'Confirm the message was received and someone will follow up.',
    'Your message to MCA Heart Research Lab', `
Dear {{recipient}},

Thank you for contacting MCA Heart Research Lab. We have received your message and a member of our team will get back to you shortly.

{{notes}}`),
  t('General', 'Ask for more information',
    'Ask for the details needed to answer properly.',
    'Your message to MCA Heart Research Lab', `
Dear {{recipient}},

Thank you for your message. So that we can help, could you please share a few more details about your request?

{{notes}}`),
  t('General', 'Join the lab: apply online',
    'Point them to the Join the Lab application.',
    'Joining MCA Heart Research Lab', `
Dear {{recipient}},

Thank you for your interest in MCA Heart Research Lab. New collaborators join through our online application, which the Research Fellows review on a rolling basis:

{{joinLink}}

Once you have applied, you will hear from us with the outcome.

{{notes}}`),
  t('General', 'Custom reply',
    'A flexible starting point for anything else.',
    'Your message to MCA Heart Research Lab', `
Dear {{recipient}},

Thank you for contacting MCA Heart Research Lab.

{{notes}}`),
];
