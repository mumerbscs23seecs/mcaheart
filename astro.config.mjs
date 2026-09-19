// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import node from '@astrojs/node';

import react from '@astrojs/react';

export default defineConfig({
  site: 'https://www.mcaheart.com',
  // Every page prerenders to static HTML; only routes that opt out with
  // `export const prerender = false` (the contact API) run on demand.
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  security: {
    // Astro's built-in CSRF check compares the browser's Origin header
    // against the URL it thinks the request arrived on - and @astrojs/node
    // always assumes plain http:// for that, since it has no idea a proxy
    // (Render, Railway, any host that terminates TLS in front of the app)
    // is the one doing https. That protocol mismatch makes every POST
    // (login, contact form, pipeline actions) get rejected as "cross-site"
    // once deployed behind such a proxy, even though it's the real site
    // making the request. Login/session auth is still enforced separately
    // in each route - this only turns off the extra Origin-header check.
    checkOrigin: false,
  },
  integrations: [sitemap(), react()],
  // Prefetches a linked page's HTML as soon as its link scrolls into view,
  // so by the time someone actually clicks it the navigation is close to
  // instant. Astro dedupes/cancels automatically - no extra requests for
  // links never seen.
  prefetch: { defaultStrategy: 'viewport' },
  image: {
    // Assets are pre-optimised in /public, so skip the sharp pipeline.
    service: { entrypoint: 'astro/assets/services/noop' },
  },
  build: { inlineStylesheets: 'auto' },
});