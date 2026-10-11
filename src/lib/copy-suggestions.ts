/**
 * People offered as quick "+ add" buttons in the CC / BCC boxes of decision
 * and paper emails. Nothing is copied by default on decision emails; these
 * are only one-click suggestions.
 */
export const COPY_SUGGESTIONS: { email: string; label: string }[] = [
  { email: 'jawad.basit@mcaheart.com', label: 'Jawad Basit' },
  { email: 'muhammad.burhan@mcaheart.com', label: 'Muhammad Burhan' },
];

const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;

/** Valid, de-duplicated, lower-cased addresses submitted under `key` (one hidden input per address). */
export function emailsFrom(form: FormData, key: string): string[] {
  return [...new Set(form.getAll(key).map((v) => String(v).trim().toLowerCase()).filter((e) => EMAIL_RE.test(e)))];
}
