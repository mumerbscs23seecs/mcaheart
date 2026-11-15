import type { APIRoute } from 'astro';
import { STUDY_TYPES } from '../../../../lib/lifecycle.mjs';

export const prerender = false;

/**
 * "Edit details" on a paper: titles (admin or the paper's lead), type of
 * research and research fellow (admins). The SQL functions re-check who may
 * change what, so this only reads the form and reports back.
 */
export const POST: APIRoute = async ({ params, request, locals, redirect }) => {
  const { supabase, person } = locals as any;
  const id = params.id!;
  const back = `/pipeline/projects/${id}`;
  const missingSql = (m: string) => /could not find the function|does not exist/i.test(m)
    ? 'Editing papers needs mca-pipeline/add-paper-editing.sql to be run first.' : m;
  const to = (kind: 'ok' | 'err', msg: string) => redirect(`${back}?${kind}=${encodeURIComponent(kind === 'err' ? missingSql(msg) : msg)}`, 303);
  const form = await request.formData();
  const isAdmin = person?.role === 'admin';

  const { data: p } = await supabase.from('projects').select('title,full_title,study_type,research_fellow').eq('id', id).maybeSingle();
  if (!p) return to('err', 'That paper could not be found.');

  const title = String(form.get('title') ?? '').trim();
  const fullTitle = String(form.get('full_title') ?? '').trim();
  const changed: string[] = [];

  if (title !== p.title || (fullTitle || null) !== (p.full_title || null)) {
    const { error } = await supabase.rpc('set_project_titles', { p_project: id, p_title: title, p_full_title: fullTitle });
    if (error) return to('err', error.message);
    changed.push('title');
  }

  if (isAdmin) {
    const studyType = String(form.get('study_type') ?? '');
    if (studyType && studyType !== p.study_type) {
      if (!STUDY_TYPES.includes(studyType)) return to('err', 'Choose a type of research from the list.');
      const { error } = await supabase.rpc('set_study_type', { p_project: id, p_study_type: studyType });
      if (error) return to('err', error.message);
      changed.push('type of research');
    }
    const fellow = String(form.get('research_fellow') ?? '');
    if (fellow && fellow !== (p.research_fellow ?? 'burhan')) {
      const { error } = await supabase.rpc('set_research_fellow', { p_project: id, p_fellow: fellow });
      if (error) return to('err', error.message);
      changed.push('research fellow');
    }
  }

  return to('ok', changed.length ? `Saved: ${changed.join(', ')}.` : 'Nothing was changed.');
};
