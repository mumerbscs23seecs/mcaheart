/**
 * The skills mentees offer and papers can ask for (mca-pipeline/add-skills.sql
 * holds the same list - keep the two in step).
 */
export const SKILLS = [
  'Analysis for NIS/NRD',
  'Analysis for TriNetX',
  'Screening/Extraction for meta-analysis',
  'Manuscript writing',
  'Visuals',
] as const;
export type Skill = (typeof SKILLS)[number];

export const isSkill = (s: string): s is Skill => (SKILLS as readonly string[]).includes(s);

/** Short labels for tight spaces (chips, filters). */
export const SKILL_SHORT: Record<Skill, string> = {
  'Analysis for NIS/NRD': 'NIS/NRD analysis',
  'Analysis for TriNetX': 'TriNetX analysis',
  'Screening/Extraction for meta-analysis': 'Screening/extraction',
  'Manuscript writing': 'Writing',
  Visuals: 'Visuals',
};

/** A sensible starting guess from what an applicant picked on the Join form. */
export function skillsFromApplication(expertise: string): Skill[] {
  const t = expertise.toLowerCase();
  const out: Skill[] = [];
  if (/nis|nrd|neds|large database/.test(t)) out.push('Analysis for NIS/NRD');
  if (/trinetx/.test(t)) out.push('Analysis for TriNetX');
  if (/screen|extract/.test(t)) out.push('Screening/Extraction for meta-analysis');
  if (/manuscript|writ/.test(t)) out.push('Manuscript writing');
  if (/visual/.test(t)) out.push('Visuals');
  return out;
}
