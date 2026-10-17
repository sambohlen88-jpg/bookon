# BookOn

Find a tee time at Perth public golf courses, then book with the club. See [`SPEC.md`](./SPEC.md) for the full product spec.

**Status:** Milestone 2 done (search), covering 26 WA courses. See [`docs/m2-review.md`](./docs/m2-review.md) and [`docs/courses.md`](./docs/courses.md).

## Layout

```
apps/web          Next.js site (App Router, Tailwind)
apps/worker       Background jobs: availability checks and alert matching
packages/adapters MiClub and Quick18 readers, polite HTTP client
packages/core     Shared types, adapter interface, Perth time helpers
packages/db       Drizzle schema, migrations, seed data, queries
docs/             Research and milestone write-ups
```

## Getting started

Needs Node 22.21 or later and pnpm 10 (`corepack enable` sets up pnpm). No Postgres install is needed: local development uses PGlite, served on port 5433 so the website and worker can share it.

```sh
pnpm install
pnpm db:dev                                # 1st terminal: local database, keep it running
pnpm db:seed                               # once: tables and courses
pnpm --filter @bookon/worker poll          # fetch live tee times (or `pnpm dev:worker` to keep polling)
pnpm dev                                   # website on http://localhost:3000
```

Checks (the same ones CI runs):

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Configuration

Copy `.env.example` to `apps/web/.env.local` or `apps/worker/.env` and fill in values. Never commit secrets.

## Ground rules

- All times shown to users are Perth time (AWST, UTC+8, no daylight saving). Store UTC.
- Only approved platforms are read, politely. See [`docs/platforms.md`](./docs/platforms.md).
