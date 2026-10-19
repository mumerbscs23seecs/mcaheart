/**
 * Admin accounts that stay admins but never get the coordinator emails
 * (status-change requests, stalled-paper escalations). Lower-case.
 * Jawad has two admin logins; his mcaheart.com one gets these instead.
 */
export const NO_COORDINATOR_EMAIL = new Set(['jawadbasit1@gmail.com']);

export const wantsCoordinatorEmail = (email: string | null | undefined) =>
  !!email && !NO_COORDINATOR_EMAIL.has(email.trim().toLowerCase());
