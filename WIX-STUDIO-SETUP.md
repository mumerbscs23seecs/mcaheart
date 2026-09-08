# Connecting a local repo to Wix Studio

## Read this first

The workflow you asked for was:

> code in a local folder → push to git → connect git to Wix Studio

That works, but **not in the way it sounds**, and the difference matters
before you commit to it.

Wix's GitHub integration syncs **code only**. The repo Wix creates contains
exactly this:

```
wix.config.json          managed by Wix — do not edit
src/
  backend/               Velo backend: *.web.js, data.js, events.js,
                         http-functions.js, jobs.config, permissions.json
  pages/                 one JS file per page + masterpage.js
  public/                shared JS modules
```

That is the whole repo. Note what is **not** there:

- No HTML.
- No page layout or structure.
- No CSS files.
- No images.

Wix does not render your markup. It renders its own component model, and the
layout lives in Wix's servers, edited through a GUI. So an Astro/React/HTML
site **cannot be pushed into Wix and served**. There is no import path for it.

Three more constraints worth knowing up front:

1. **Connecting puts the online editor into read-only mode** for code. After
   you connect, code is edited in your IDE, not in the browser editor.
2. **You cannot create page code files from your IDE.** You add a page in the
   Wix editor; Wix then generates its code file and syncs it down. Never
   rename those files — Wix matches them to pages by filename.
3. **Velo Packages block the connection entirely.** If the site uses them,
   remove them first. (npm packages are fine.)

So the honest summary: **git gives you version control over the site's
JavaScript. It does not give you code-authored design.**

---

## Your two real options

### Option A — Wix Studio, with git for code

You rebuild the design by hand in the Wix Studio editor (or its Local
Editor), using this repo as the visual specification. Git then version-controls
the Velo code, and `wix/styles/global.css` goes into Studio's CSS panel.

**Good if:** the client must be able to edit pages themselves, or Wix
hosting/CMS/billing is already settled and not worth unwinding.

**Costs:** the layout work happens twice — once here, once in the editor. You
inherit Wix's performance ceiling and its markup. The design system in this
repo can only be approximated through Studio's CSS panel.

### Option B — Ship this repo directly

Deploy the Astro build to Vercel, Netlify or Cloudflare Pages. Push to `main`,
it goes live. That is the workflow you described, working literally.

**Good if:** you want the design exactly as built, fast pages, real version
control over everything, and no platform ceiling.

**Costs:** the client edits content by editing `src/data/site.ts` (or you wire
up a CMS — Sanity, Contentful, or Wix Headless if you want to keep Wix's
content tools without its renderer).

### A note on the middle path

**Wix Headless** lets you keep Wix for CMS, forms, members and bookings while
serving this Astro frontend from your own host. You get Option B's design
control and Option A's content tooling. It is the option worth considering if
the client's attachment is to Wix's *admin*, not Wix's *editor*.

---

## Setting up Option A

### Prerequisites

- Git, and Node 20.11 or later (you have Node 24 — fine).
- An SSH key on your GitHub account.
- A Wix **Studio** site. CSS editing and the Local Editor are Studio-only.

### 1. Connect the site to GitHub

1. Open the site in the Wix Studio editor.
2. Click the **Code** icon `{}` in the left sidebar, then **Start Coding**.
3. In the Code sidebar, click **GitHub** → **Connect to GitHub** → **Continue**
   → **Sign In**, and authorise Wix's Velo app.
4. Choose an owner and a repo name, then click **Create**.
5. Click **Install**, select **Only select repositories**, pick the new repo,
   and **Approve and Install**.
6. Wix shows you a block of terminal commands. **Copy them** — you need them
   next. (You can see them again later under **Local Dev Setup**.)

The editor now shows the repo name and default branch, and code goes
read-only in the browser.

### 2. Clone and install

Run the commands Wix gave you. They clone the repo, install dependencies, and
install the CLI. They look like this:

```bash
git clone git@github.com:<owner>/<repo>.git && cd <repo> && npm install && npm install -g @wix/cli && wix dev
```

If the global install needs elevation, install the CLI on its own:

```bash
npm install -g @wix/cli
```

### 3. Work locally

```bash
wix dev
```

This opens the **Local Editor** in your browser. It is a local instance of the
Wix editor, and it is where the design work happens:

- Edit **layout and design** in the Local Editor GUI → it writes to your repo.
- Edit **code** in your IDE → the Local Editor picks it up live.

This is the part that surprises people: design changes flow *through* the
Local Editor, not through files you write by hand.

### 4. Port this project into it

| From this repo | Goes to |
| --- | --- |
| `wix/src/backend/contact.web.js` | `src/backend/contact.web.js` |
| `wix/src/pages/masterpage.js` | `src/pages/masterpage.js` |
| `wix/src/pages/contact.js` | paste into the Contact page's generated file |
| `wix/styles/global.css` | Studio editor → Code panel → **global.css** |
| `src/pages/*.astro` | rebuild as layout in the Local Editor |
| `public/assets/**` | upload through the Wix Media Manager |

`global.css` is **not** a repo file — Wix does not sync CSS through GitHub.
Paste it into the editor's global.css panel, then assign the custom classes
(`.mca-display`, `.mca-card`, `.mca-eyebrow`, …) to elements via each
element's **CSS Classes** panel.

The contact form needs a collection. In the Content Manager create one called
**Enquiries** with fields: `fullName`, `email`, `phone`, `location`,
`designation`, `intent`, `intentLabel`, `message` (all text) and
`submittedAt` (date & time). To get email notifications, add a Wix Automation
triggered on new items in that collection — that is more reliable than
sending mail from Velo.

### 5. Publish

```bash
wix publish
```

You will be asked whether to publish the latest commit from `origin/main` or
your local code. **Prefer `origin/main`.** Publishing local code leaves the
live site and the repo out of sync, and a later publish from the repo will
overwrite your local work.

Other commands:

```bash
wix preview
```

```bash
wix install <package-name>
```

`wix login`, `wix whoami`, `wix logout` manage the account. `wix dev --tunnel`
is for cloud IDEs.

### 6. Optional — CI

You can drive `wix publish` from GitHub Actions so a merge to `main` deploys.
Wix documents this under "Set Up GitHub Actions to Work with the Wix CLI".

---

## Setting up Option B

```bash
npm run build
```

Then connect the repo to your host:

- **Vercel / Netlify** — import the repo, set build command `npm run build`.
  Swap the adapter in `astro.config.mjs` to `@astrojs/vercel` or
  `@astrojs/netlify`.
- Add `RESEND_API_KEY`, `CONTACT_TO` and `CONTACT_FROM` as environment
  variables in the host's dashboard.
- Point `mcaheart.com` at the host and let it issue the certificate.

Push to `main` and it deploys. That is the whole loop.

---

## Recommendation

If the deciding factor is **who edits the site afterwards**, take Option A and
accept that the design gets rebuilt in the editor.

If the deciding factor is **how the site looks and performs**, take Option B —
this repo is ready to deploy today, and content edits are a small file.

If it is genuinely both, look at Wix Headless before doing the layout twice.

---

## Sources

- [About Git Integration & Wix CLI for Sites](https://dev.wix.com/docs/develop-websites/articles/workspace-tools/developer-tools/git-integration-wix-cli-for-sites/about-git-integration-wix-cli-for-sites)
- [Setting Up Git Integration & Wix CLI for Sites](https://dev.wix.com/docs/develop-websites/articles/workspace-tools/developer-tools/git-integration-wix-cli-for-sites/setting-up-git-integration-wix-cli-for-sites)
- [GitHub Repository File Structure](https://dev.wix.com/docs/develop-websites/articles/workspace-tools/developer-tools/git-integration-wix-cli-for-sites/git-hub-repository-file-structure)
- [Wix CLI for Sites Commands](https://dev.wix.com/docs/develop-websites/articles/workspace-tools/developer-tools/git-integration-wix-cli-for-sites/wix-cli-for-sites-commands)
- [Studio Editor: About CSS Editing](https://support.wix.com/en/article/studio-editor-about-css-editing)
- [How to Connect Wix Studio to GitHub](https://www.wix.com/studio/academy/tutorials/connect-wix-studio-to-github)
