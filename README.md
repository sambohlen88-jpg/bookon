# BookOn

Find a tee time at Perth public golf courses, then book with the club. See [`SPEC.md`](./SPEC.md) for the full product spec.

**Status:** Milestone 8 done (admin area and club logins), covering 26 WA courses. See [`docs/m8-review.md`](./docs/m8-review.md) and [`docs/courses.md`](./docs/courses.md).

## Layout

```
apps/web          Next.js site (App Router, Tailwind)
apps/worker       Background jobs: availability checks and alert matching
packages/adapters MiClub and Quick18 readers, polite HTTP client
packages/core     Shared types, adapter interface, Perth time helpers
packages/db       Drizzle schema, migrations, seed data, queries
packages/email    Email and push: templates, the development outbox, Postmark and Web Push
docs/             Research and milestone write-ups
```

## Getting started

Needs Node 22.21 or later and pnpm 10 (`corepack enable` sets up pnpm). No Postgres install is needed: local development uses PGlite, served on port 5433 so the website and worker can share it.

```sh
pnpm install
pnpm db:dev                                # 1st terminal: local database, keep it running
pnpm db:seed                               # once: tables and courses
pnpm dev:worker                            # 2nd terminal: checks every club every 30 minutes, keep it running
pnpm dev                                   # 3rd terminal: website on http://localhost:3000
pnpm alerts                                # send alert emails from stored times, without polling
pnpm stats                                 # searches, impressions and clicks per course
pnpm clubs                                 # club listings waiting for review (or use /admin)
```

Search only shows times checked in the last 90 minutes, so they're never out of date. If the worker isn't running, the site says it can't show times. `pnpm --filter @bookon/worker poll` checks every club once, if you don't want to leave the worker running.

**Admin area:** add your email to `apps/web/.env.local` as `BOOKON_ADMIN_EMAILS=you@example.com` (comma separate several), restart `pnpm dev`, sign in, and open http://localhost:3000/admin.

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
