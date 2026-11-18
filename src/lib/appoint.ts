/**
 * After someone is put on a paper (appoint() or the board), email them and the
 * paper's first author. The database has already sent the in-app notifications.
 */
import { supabaseAdmin } from './supabase';
import { ASSIGNMENT_COLS, deliverAppointed, deliverHelperAdded, type Assignment } from './help';

const REAL = (e: string | null | undefined): e is string => !!e && !e.endsWith('@import.invalid');

export type MailResult = 'sent' | 'logged-only' | 'failed' | 'none';

/** Emails for the newest appointment of this person on this paper. */
export async function emailAppointment(origin: string, projectId: string, personId: string, fallbackRole?: string): Promise<MailResult> {
  const db = supabaseAdmin();
  const [{ data: a }, { data: pr }] = await Promise.all([
    db.from('assignments').select(ASSIGNMENT_COLS).eq('project_id', projectId).eq('person_id', personId)
      .order('assigned_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('projects').select('id,ref,title,full_title,lead_id,colead_id').eq('id', projectId).maybeSingle(),
  ]);
  if (!pr) return 'none';
  // No assignment row (the help tables aren't set up yet): an analyst change
  // still gets its emails, due in 10 days.
  if (!a && !fallbackRole) return 'none';
  const asg = (a as Assignment | null) ?? ({
    role: fallbackRole, due_on: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10),
  } as Assignment);
  const ids = [personId, pr.lead_id, pr.colead_id].filter(Boolean) as string[];
  const { data: ppl } = await db.from('people').select('id,full_name,email').in('id', ids);
  const who = new Map((ppl ?? []).map((r: any) => [r.id, r]));
  const person = who.get(personId);
  const lead = pr.lead_id ? who.get(pr.lead_id) : null;
  const title = pr.full_title || pr.title;
  const link = `${origin}/pipeline/projects/${pr.id}`;

  const results: { ok: boolean; id?: string }[] = [];
  try {
    if (person && REAL(person.email)) {
      results.push(await deliverAppointed({
        to: person.email, name: person.full_name, projectTitle: title, role: asg.role, due: asg.due_on,
        lead: lead?.full_name ?? null, link,
      }));
    }
    const leads = [lead, pr.colead_id ? who.get(pr.colead_id) : null]
      .filter((x: any) => x && x.id !== personId && REAL(x.email)) as { full_name: string; email: string }[];
    if (leads.length) {
      results.push(await deliverHelperAdded({
        to: leads.map((l) => l.email), leadName: leads.length === 1 ? leads[0].full_name : 'authors',
        helper: person?.full_name ?? 'A member', helperEmail: person?.email ?? '', projectTitle: title,
        role: asg.role, due: asg.due_on, link,
      }));
    }
  } catch (err) {
    console.error('[appoint] email failed:', err);
    return 'failed';
  }
  if (!results.length) return 'none';
  if (results.some((r) => !r.ok)) return 'failed';
  return results.every((r) => r.id === 'logged-only') ? 'logged-only' : 'sent';
}

export const MAIL_NOTE: Record<MailResult, string> = {
  sent: ' They and the first author have been emailed.',
  'logged-only': ' No email went out: email sending is not set up on this server.',
  failed: ' The email could not be sent, but they were notified in the workflow.',
  none: '',
};

/** Which analysis a paper needs, by its database. */
export const ANALYSIS_TYPES = ['TriNetX', 'NIS', 'NRD', 'DMC PCI'] as const;
export const analysisSkillFor = (studyType: string | null | undefined): string | null =>
  studyType === 'TriNetX' ? 'Analysis for TriNetX' : studyType === 'NIS' || studyType === 'NRD' ? 'Analysis for NIS/NRD' : null;
/** True for the database papers that need an analyst. */
export const needsAnalyst = (studyType: string | null | undefined) => (ANALYSIS_TYPES as readonly string[]).includes(studyType ?? '');

/** Open help requests, for the Manage menu badge. */
export async function openHelpCount(): Promise<number> {
  const { count, error } = await supabaseAdmin().from('help_requests').select('id', { count: 'exact', head: true }).is('closed_at', null);
  return error ? 0 : count ?? 0;
}
