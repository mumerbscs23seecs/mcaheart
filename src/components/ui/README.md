# src/components/ui

Vendored UI primitives (shadcn-style copy-in components and other self-contained
React components). Kept separate from the app's `.astro` components so the
`shadcn` CLI (`npx shadcn@latest add …`, `diff`, `update`) can find and reconcile
them without touching hand-written code.

Import with the `@/` alias: `import X from '@/components/ui/x'`.

React components here render in `.astro` pages as client islands, e.g.
`<X client:only="react" />`.
