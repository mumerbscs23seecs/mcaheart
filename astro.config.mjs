// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import node from '@astrojs/node';

export default defineConfig({
  site: 'https://www.mcaheart.com',
  // Every page prerenders to static HTML; only routes that opt out with
  // `export const prerender = false` (the contact API) run on demand.
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  integrations: [sitemap()],
  image: {
    // Assets are pre-optimised in /public, so skip the sharp pipeline.
    service: { entrypoint: 'astro/assets/services/noop' },
  },
  build: { inlineStylesheets: 'auto' },
});
