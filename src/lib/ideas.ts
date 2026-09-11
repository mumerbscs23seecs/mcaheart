/**
 * DEMO store for research-idea submissions - in-memory only, no database.
 * Same pattern as auth.ts / submissions.ts.
 *
 * The public /submit-idea form writes here; /admin/ideas reads, and an admin
 * accepts (→ creates a pipeline submission) or declines. Both decisions email
 * the submitter.
 */
import { randomBytes } from 'node:crypto';
import { audit } from './auth';
import type { IdeaPayload, Database } from './idea-schema';

export type IdeaStatus = 'pending' | 'accepted' | 'declined';

export interface IdeaRecord extends IdeaPayload {
  id: string;
  submittedAt: number;
  status: IdeaStatus;
  attachmentName: string | null;
  reviewedAt: number | null;
  reviewedBy: string | null;
  decisionNote: string | null;
}

const ideas = new Map<string, IdeaRecord>();
const DAY = 86_400_000;

function seed() {
  if (ideas.size) return;
  const now = Date.now();
  const base = (): Omit<IdeaRecord, keyof IdeaPayload | 'id' | 'submittedAt'> => ({
    status: 'pending',
    attachmentName: null,
    reviewedAt: null,
    reviewedBy: null,
    decisionNote: null,
  });

  const blank = {
    databases: [] as Database[],
    studyDesign: '',
    priorStudies: '',
    latestStudy: '',
    previousMetaDate: '',
    newStudies: '',
    sampleSizeIncrease: '',
    company: undefined as string | undefined,
  };

  ideas.set('i_01', {
    id: 'i_01',
    submittedAt: now - 3 * DAY,
    leadName: 'Priya Nair',
    leadEmail: 'priya.nair@example.com',
    contactNumber: '+1 216 555 0142',
    title: 'Sex differences in outcomes after Impella-supported high-risk PCI',
    researchType: 'Database',
    population: 'Adults undergoing high-risk PCI with Impella support, 2016–2021, stratified by sex.',
    intervention: 'Impella-supported high-risk PCI',
    comparison: 'Male vs female recipients',
    outcomes: 'In-hospital mortality, vascular complications, acute kidney injury, length of stay.',
    rationale: 'Women are under-represented in MCS trials; a real-world disparities signal would inform enrolment and device selection.',
    conference: 'SCAI',
    commitment: 'agree',
    ...blank,
    databases: ['National Inpatient Sample (NIS)'],
    studyDesign: 'Retrospective cohort with propensity matching',
    priorStudies: 'Prior NIS work on MCS trends exists but none focused on sex-based disparities in the Impella HR-PCI cohort.',
    latestStudy: 'Patel N et al., 2024, JACC Cardiovasc Interv, doi:10.1016/j.jcin.2024.03.010',
    ...base(),
  });

  ideas.set('i_02', {
    id: 'i_02',
    submittedAt: now - 26 * 60 * 60 * 1000,
    leadName: 'Daniel Okafor',
    leadEmail: 'daniel.okafor@example.com',
    contactNumber: '+1 313 555 0188',
    title: 'DOAC vs warfarin after bioprosthetic mitral valve replacement',
    researchType: 'Meta-analysis',
    population: 'Adults within 3 months of bioprosthetic mitral valve replacement.',
    intervention: 'Direct oral anticoagulant',
    comparison: 'Warfarin',
    outcomes: 'Thromboembolism, major bleeding, valve thrombosis at 90 days and 1 year.',
    rationale: 'Guidelines are cautious about DOACs in the mitral position; a focused pooled estimate would help.',
    conference: 'flexible',
    commitment: 'agree',
    ...blank,
    previousMetaDate: '2021',
    newStudies: '3 new cohort studies: doi:10.1002/ehf2.14210, doi:10.1016/j.ijcard.2023.09.021, doi:10.1093/ehjcvp/pvad044',
    sampleSizeIncrease: '≈ 55%',
    ...base(),
  });

  audit('system', 'seeded demo ideas', undefined, '2 pending');
}
seed();

/* -------------------------------------------------------------------------- */

export function addIdea(data: IdeaPayload, attachmentName: string | null): IdeaRecord {
  const id = `i_${randomBytes(5).toString('hex')}`;
  const rec: IdeaRecord = {
    ...data,
    id,
    submittedAt: Date.now(),
    status: 'pending',
    attachmentName,
    reviewedAt: null,
    reviewedBy: null,
    decisionNote: null,
  };
  ideas.set(id, rec);
  audit(data.leadEmail, 'submitted research idea', data.title);
  return rec;
}

export function listIdeas(): IdeaRecord[] {
  return [...ideas.values()].sort((a, b) => {
    // pending first, then newest
    if ((a.status === 'pending') !== (b.status === 'pending')) return a.status === 'pending' ? -1 : 1;
    return b.submittedAt - a.submittedAt;
  });
}

export function getIdea(id: string): IdeaRecord | undefined {
  return ideas.get(id);
}

export function pendingIdeaCount(): number {
  let n = 0;
  for (const i of ideas.values()) if (i.status === 'pending') n++;
  return n;
}

export interface DecisionResult {
  ok: boolean;
  error?: string;
  idea?: IdeaRecord;
}

/** Record an accept/decline. Does NOT send email or create a submission -
 *  the page orchestrates those so failures surface cleanly. */
export function decideIdea(
  id: string,
  decision: 'accepted' | 'declined',
  reviewer: string,
  note: string,
): DecisionResult {
  const idea = ideas.get(id);
  if (!idea) return { ok: false, error: 'Idea not found.' };
  if (idea.status !== 'pending') return { ok: false, error: `That idea was already ${idea.status}.` };
  idea.status = decision;
  idea.reviewedAt = Date.now();
  idea.reviewedBy = reviewer;
  idea.decisionNote = note.trim() || null;
  audit(reviewer, `${decision} idea`, idea.title, note.trim() || undefined);
  return { ok: true, idea };
}
