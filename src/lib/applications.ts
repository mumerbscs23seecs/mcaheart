/**
 * DEMO store for lab recruitment applications - in-memory only, no database.
 *
 * FILE STORAGE (answer to "where are uploads stored"):
 *   The CV and headshot bytes are held IN MEMORY on the record below, so the
 *   admin can download them from the review panel during the session. They are
 *   wiped when the Node process restarts - nothing touches disk or a bucket.
 *   Production must stream uploads to object storage (S3 / R2 / Supabase) and
 *   keep only a key here.
 */
import { randomBytes } from 'node:crypto';
import { audit } from './auth';
import type { RecruitmentPayload } from './recruitment-schema';

export type ApplicationStatus = 'pending' | 'accepted' | 'declined';

export interface StoredFile {
  filename: string;
  mime: string;
  size: number;
  bytes: Buffer;
}

export interface ApplicationRecord extends RecruitmentPayload {
  id: string;
  submittedAt: number;
  status: ApplicationStatus;
  cv: StoredFile | null;
  headshot: StoredFile | null;
  reviewedAt: number | null;
  reviewedBy: string | null;
  decisionNote: string | null;
}

const applications = new Map<string, ApplicationRecord>();
const DAY = 86_400_000;

function seed() {
  if (applications.size) return;
  const now = Date.now();
  applications.set('a_01', {
    id: 'a_01',
    submittedAt: now - 2 * DAY,
    name: 'Sara Malik',
    email: 'sara.malik@example.com',
    gradYear: '2023',
    jobStatus: 'PGY-2 IM',
    fellowshipPlan: 'ERAS 2027 cycle',
    researchExperience:
      '4 first-author case reports, 2 co-authored meta-analyses (screening + extraction). Research elective at a tertiary cardiology centre.',
    letterOfInterest:
      'I want structured mentorship in database and meta-analytic methods before applying to cardiology fellowship, and MCA’s output and collaborative model are exactly the environment I’m looking for.',
    expertise: 'Data screening / extraction for meta-analysis',
    profileLink: 'https://scholar.google.com/citations?user=example',
    currentStatus: 'IM resident at a community program; contract runs to June 2027.',
    professionalGoals: 'Interventional cardiology fellowship.',
    internalRef: 'Worked with Varun Victor on a prior abstract.',
    referralSource: 'Recommended by a co-resident who is already in the group.',
    whatsapp: '+1 216 555 0199',
    company: undefined,
    status: 'pending',
    cv: null,
    headshot: null,
    reviewedAt: null,
    reviewedBy: null,
    decisionNote: null,
  });
  audit('system', 'seeded demo application', undefined, '1 pending');
}
seed();

/* -------------------------------------------------------------------------- */

export function addApplication(
  data: RecruitmentPayload,
  files: { cv: StoredFile | null; headshot: StoredFile | null },
): ApplicationRecord {
  const id = `a_${randomBytes(5).toString('hex')}`;
  const rec: ApplicationRecord = {
    ...data,
    id,
    submittedAt: Date.now(),
    status: 'pending',
    cv: files.cv,
    headshot: files.headshot,
    reviewedAt: null,
    reviewedBy: null,
    decisionNote: null,
  };
  applications.set(id, rec);
  audit(data.email, 'submitted lab application', data.name);
  return rec;
}

export function listApplications(): ApplicationRecord[] {
  return [...applications.values()].sort((a, b) => {
    if ((a.status === 'pending') !== (b.status === 'pending')) return a.status === 'pending' ? -1 : 1;
    return b.submittedAt - a.submittedAt;
  });
}

export function getApplication(id: string): ApplicationRecord | undefined {
  return applications.get(id);
}

export function pendingApplicationCount(): number {
  let n = 0;
  for (const a of applications.values()) if (a.status === 'pending') n++;
  return n;
}

export interface DecisionResult {
  ok: boolean;
  error?: string;
  application?: ApplicationRecord;
}

export function decideApplication(
  id: string,
  decision: 'accepted' | 'declined',
  reviewer: string,
  note: string,
): DecisionResult {
  const app = applications.get(id);
  if (!app) return { ok: false, error: 'Application not found.' };
  if (app.status !== 'pending') return { ok: false, error: `That application was already ${app.status}.` };
  app.status = decision;
  app.reviewedAt = Date.now();
  app.reviewedBy = reviewer;
  app.decisionNote = note.trim() || null;
  audit(reviewer, `${decision} application`, app.name, note.trim() || undefined);
  return { ok: true, application: app };
}
