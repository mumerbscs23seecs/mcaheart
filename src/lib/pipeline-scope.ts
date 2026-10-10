import type { Person } from './pipeline-auth';

/** The five people columns on a project that make it "yours". */
export const ROLE_COLS = [
  'lead_id',
  'colead_id',
  'analyst_id',
  'presenter_id',
  'corresponding_id',
] as const;

/**
 * Restrict a project_list / projects query to the signed-in person's own
 * papers. Admins see everything, so the query is returned untouched.
 *
 * `team_member_ids` (add-team-members-and-trash.sql) extends this past the
 * five fixed roles - anyone added there gets the same portal visibility.
 */
export function scopeProjects<T>(query: T, person: Person): T {
  if (person.role === 'admin') return query;
  const filter = [...ROLE_COLS.map((c) => `${c}.eq.${person.id}`), `team_member_ids.cs.{${person.id}}`].join(',');
  // PostgREST filter builder - `.or()` exists at runtime on every stage of the chain.
  return (query as { or: (f: string) => T }).or(filter);
}

/** Is this person attached to this project row (one of the five roles, or a team member)? Admins: always. */
export function personOnProject(row: Record<string, unknown>, person: Person): boolean {
  if (person.role === 'admin') return true;
  if (ROLE_COLS.some((c) => row[c] != null && row[c] === person.id)) return true;
  const team = row.team_member_ids as string[] | null | undefined;
  return Array.isArray(team) && team.includes(person.id);
}
