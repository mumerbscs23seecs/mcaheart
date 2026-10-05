/**
 * Creates/links a password login (Supabase Auth) for every active person with
 * a real email. Passwords come from the environment at run time - never from
 * this file (the repo is public):
 *
 *   DEFAULT_MEMBER_PASSWORD=...  starting password for members (must change at first sign-in)
 *   ADMIN_PASSWORD=...           password for admin@mcaheart.com (optional; skipped if unset)
 *
 *   node scripts/setup-logins.mjs            # dry run
 *   node scripts/setup-logins.mjs --apply
 *   node scripts/setup-logins.mjs --apply --force   # also reset members who already chose their own
 *
 * Also retires the two demo-era logins: the duplicate "Site Admin"
 * (mcaheart.noreply@gmail.com) and member@mcaheart.com.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');
const FORCE = process.argv.includes('--force');
const ADMIN_EMAIL = 'admin@mcaheart.com';
const RETIRE = ['mcaheart.noreply@gmail.com', 'member@mcaheart.com'];
const DEFAULT = process.env.DEFAULT_MEMBER_PASSWORD;
const ADMIN_PW = process.env.ADMIN_PASSWORD;
if (!DEFAULT) { console.error('Set DEFAULT_MEMBER_PASSWORD for this run.'); process.exit(1); }

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const must = ({ data, error }) => { if (error) throw error; return data; };
const real = (e) => !!e && !e.endsWith('@import.invalid');

const authUsers = new Map();
for (let page = 1; ; page++) {
  const { users } = must(await sb.auth.admin.listUsers({ page, perPage: 1000 }));
  users.forEach((u) => authUsers.set(u.id, u));
  if (users.length < 1000) break;
}
const authByEmail = new Map([...authUsers.values()].map((u) => [(u.email ?? '').toLowerCase(), u]));

const people = must(await sb.from('people').select('id,full_name,email,role,active,auth_id'));
const log = { retire: [], admin: [], member: [], kept: [], skipped: [] };

for (const p of people.filter((x) => x.active && RETIRE.includes(x.email.toLowerCase()))) {
  log.retire.push(`${p.full_name} <${p.email}>`);
  if (APPLY) must(await sb.from('people').update({ active: false }).eq('id', p.id));
}

for (const p of people) {
  const email = p.email.toLowerCase();
  if (!p.active || !real(email) || RETIRE.includes(email)) continue;
  const isAdmin = p.role === 'admin';
  if (isAdmin && email !== ADMIN_EMAIL) { log.skipped.push(`${p.full_name} <${email}> - admin other than ${ADMIN_EMAIL}`); continue; }
  if (isAdmin && !ADMIN_PW) { log.skipped.push(`${p.full_name} <${email}> - ADMIN_PASSWORD not given`); continue; }

  let auth = (p.auth_id && authUsers.get(p.auth_id)) || authByEmail.get(email);
  if (!isAdmin && auth && auth.app_metadata?.must_change_password === false && !FORCE) {
    log.kept.push(`${p.full_name} <${email}> - already chose their own password`);
    continue;
  }
  (isAdmin ? log.admin : log.member).push(`${p.full_name} <${email}>${auth ? '' : ' (new login)'}`);
  if (!APPLY) continue;

  const attrs = isAdmin
    ? { password: ADMIN_PW, email_confirm: true, app_metadata: { must_change_password: false } }
    : { password: DEFAULT, email_confirm: true, app_metadata: { must_change_password: true } };
  if (auth) {
    if ((auth.email ?? '').toLowerCase() !== email) attrs.email = email;
    must(await sb.auth.admin.updateUserById(auth.id, attrs));
  } else {
    auth = must(await sb.auth.admin.createUser({ email, ...attrs })).user;
  }
  if (p.auth_id !== auth.id) must(await sb.from('people').update({ auth_id: auth.id }).eq('id', p.id));
}

const show = (title, list) => { console.log(`\n=== ${title} (${list.length}) ===`); list.forEach((l) => console.log(' ' + l)); };
show('Retire (deactivate) demo logins', log.retire);
show('Admin password set', log.admin);
show('Members on the starting password (must change at first sign-in)', log.member);
show('Left alone', log.kept);
show('Skipped', log.skipped);
console.log(APPLY ? '\nApplied.' : '\n(dry run - nothing written; re-run with --apply)');
