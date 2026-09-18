/**
 * DEMO store for contact-form submissions ("Requests" in the admin nav) -
 * in-memory only, no database. Same trade-off as applications.ts: the CV
 * bytes for an observership request live on the record in memory so the
 * admin can download them during the session, and are wiped on restart.
 * Production must stream uploads to object storage and keep only a key here.
 */
import { randomBytes } from 'node:crypto';
import { audit } from './auth';
import type { ContactPayload, Intent } from './contact-schema';

export interface StoredFile {
  filename: string;
  mime: string;
  size: number;
  bytes: Buffer;
}

export interface RequestRecord extends ContactPayload {
  id: string;
  submittedAt: number;
  cv: StoredFile | null;
  /** Flips to true the first time an admin opens /admin/requests after this arrived. */
  read: boolean;
}

const requests = new Map<string, RequestRecord>();
const DAY = 86_400_000;

function seed() {
  if (requests.size) return;
  const now = Date.now();
  requests.set('r_01', {
    id: 'r_01',
    submittedAt: now - 1 * DAY,
    fullName: 'Daniyar Zhaksybek',
    email: 'daniyar.z@example.com',
    phone: '',
    location: 'Almaty, Kazakhstan',
    designation: 'IM residency applicant',
    intent: 'observership',
    message: '',
    recName: '',
    obsName: 'Daniyar Zhaksybek',
    obsApplyDate: 'Sept 2027',
    obsNeedsLetter: 'yes',
    obsStatus: 'Graduate from Al-Farabi Kazakh National Medical University, planning to apply for IM residency.',
    obsUsmle: 'Step 1 (Pass), Step 2 CK (242)',
    obsVisa: 'I need a visa and would need to apply for visa',
    obsGradYear: '2025',
    obsStart: '2026-11-02',
    obsEnd: '2026-11-30',
    company: undefined,
    cv: null,
    read: true,
  });
  audit('system', 'seeded demo request', undefined, '1 request');
}
seed();

/* -------------------------------------------------------------------------- */

export function addRequest(data: ContactPayload, cv: StoredFile | null): RequestRecord {
  const id = `r_${randomBytes(5).toString('hex')}`;
  const rec: RequestRecord = { ...data, id, submittedAt: Date.now(), cv, read: false };
  requests.set(id, rec);
  audit(data.email, 'submitted contact request', data.fullName);
  return rec;
}

export function listRequests(intent?: Intent): RequestRecord[] {
  const all = [...requests.values()].sort((a, b) => b.submittedAt - a.submittedAt);
  return intent ? all.filter((r) => r.intent === intent) : all;
}

export function getRequest(id: string): RequestRecord | undefined {
  return requests.get(id);
}

export function unreadRequestCount(): number {
  let n = 0;
  for (const r of requests.values()) if (!r.read) n++;
  return n;
}

/** Called when the admin opens the requests list - marks everything currently there as read. */
export function markAllRequestsRead(): void {
  for (const r of requests.values()) r.read = true;
}
