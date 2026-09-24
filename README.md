# MCAHeart Website

A coded rebuild of [mcaheart.com](https://www.mcaheart.com) — the site for
Dr Chadi Alraies' cardiovascular research collective.

Built with [Astro](https://astro.build). Static HTML for every page, one
on-demand API route for the contact form, no client framework.

> **Which project is this?** The whole mcaheart.com website — all five pages.
> "Heart Trending" is the name of *one page* on it (the video series), not the
> project. If the local folder is still called `Heart Trending`, rename it to
> `mcaheart` to match the repo.

---

## Quick start

```bash
npm install
```

```bash
npm run dev
```

The site runs at <http://localhost:4321>.

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |

### Environment

Copy `.env.example` to `.env`. Everything is optional — with no
`RESEND_API_KEY` set, contact submissions are logged to stdout instead of
emailed, so local development needs no third-party account.

| Variable | Purpose |
| --- | --- |
| `RESEND_API_KEY` | Enables email delivery via [Resend](https://resend.com) |
| `CONTACT_TO` | Destination inbox (default `studio@medishift.in`) |
| `CONTACT_FROM` | Verified sender address |

---

## Structure

```
src/
  data/site.ts          All site copy and media, typed. Edit content here.
  styles/global.css     The design system: tokens, type scale, components.
  layouts/              BaseLayout — head, SEO, JSON-LD, header/footer.
  components/           Header, Footer, PageHero, CTABanner, VideoCard,
                        VideoLightbox, ContactForm.
  lib/                  contact-schema (zod), rate-limit, mailer.
  pages/                One file per route + api/contact.ts.
public/assets/          Images, grouped by page.
wix/                    Velo code for the Wix Studio path (see below).
reference/              Scraped copies of the original Wix site. Gitignored,
                        analysis only.
```

**To change content, edit `src/data/site.ts`** — headings, video list,
testimonials, stats and footer links all read from there.

---

## Design

The original site's visual cues — parchment texture, an anatomical heart
illustration, rust and sepia tones — are pushed into a coherent system:
a Renaissance anatomical codex reworked as a modern research institute.

| Token | Value | Use |
| --- | --- | --- |
| `--parchment` | `#f7f1e3` | Page ground |
| `--vellum` | `#fffdf7` | Cards and inputs |
| `--ink` | `#1c1714` | Body text, dark sections |
| `--rust` | `#9e3b1b` | Primary accent, buttons, eyebrows |
| `--arterial` | `#c1121f` | Errors, hover states |

Type is **Fahkwang** for display and **Raleway** for body — both carried over
from the original build, both served from Google Fonts.

Everything scales fluidly with `clamp()`; there are very few breakpoints.

---

## Notable implementation details

**YouTube facade.** Video cards render a static thumbnail and only inject an
iframe when clicked, pointing at `youtube-nocookie.com`. No third-party
request, script or cookie until a visitor presses play — this keeps the page
fast and avoids setting tracking cookies on arrival.

**Contact API.** `POST /api/contact` validates against a zod schema shared
with the browser, rejects on a honeypot field, rate-limits to 5 submissions
per IP per 15 minutes, and delivers through a swappable mailer. It accepts
both JSON and a native form POST.

**Progressive enhancement.** Reveal-on-scroll, the mobile drawer and the
video lightbox all layer on top of working HTML. With JavaScript off the
content is fully readable and the contact form still submits.

**Accessibility.** Skip link, visible focus rings, `aria-current` on the
active nav item, labelled form fields with inline errors wired to
`aria-invalid`, and `prefers-reduced-motion` honoured throughout.

---

## Deploying

The build outputs static pages plus a small Node server for the API route.

```bash
npm run build
```

```bash
node ./dist/server/entry.mjs
```

For Vercel or Netlify, swap the adapter in `astro.config.mjs`
(`@astrojs/vercel` or `@astrojs/netlify`) — no other change is needed.

If you would rather ship a purely static site with no server, delete
`src/pages/api/contact.ts`, drop the adapter, and point the form at a form
service instead.

---

## The Wix Studio path

See **[WIX-STUDIO-SETUP.md](WIX-STUDIO-SETUP.md)**.

Read it before assuming this repo can be pushed into Wix — Wix's GitHub
integration syncs *code only*, not page layout, so the two paths are
genuinely different. The guide explains both and what each costs.

---

## Testing

`playwright` is a dev dependency, used to screenshot pages and check for
layout overflow across breakpoints. It is not needed to build or run the
site; remove it if you do not want the browser download.
