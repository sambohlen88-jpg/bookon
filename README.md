# BookOn

Find a tee time at Perth public golf courses, then book with the club. See [`SPEC.md`](./SPEC.md) for the full product spec.

**Status:** Milestone 4 done (accounts, favourites and email alerts), covering 26 WA courses. See [`docs/m4-review.md`](./docs/m4-review.md) and [`docs/courses.md`](./docs/courses.md).

## Layout

```
apps/web          Next.js site (App Router, Tailwind)
apps/worker       Background jobs: availability checks and alert matching
packages/adapters MiClub and Quick18 readers, polite HTTP client
packages/core     Shared types, adapter interface, Perth time helpers
packages/db       Drizzle schema, migrations, seed data, queries
packages/email    Email templates, the development outbox and Postmark sending
docs/             Research and milestone write-ups
```

## Getting started

Needs Node 22.21 or later and pnpm 10 (`corepack enable` sets up pnpm). No Postgres install is needed: local development uses PGlite, served on port 5433 so the website and worker can share it.

```sh
pnpm install
pnpm db:dev                                # 1st terminal: local database, keep it running
pnpm db:seed                               # once: tables and courses
pnpm --filter @bookon/worker poll          # fetch live tee times, then send alert emails (or `pnpm dev:worker` to keep polling)
pnpm dev                                   # website on http://localhost:3000
pnpm alerts                                # send alert emails from stored times, without polling
pnpm stats                                 # searches, impressions and clicks per course
```

Locally, emails (sign-in links and alerts) are not sent. Open http://localhost:3000/dev/outbox to read them.

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
