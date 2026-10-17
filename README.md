# BookOn

Find a tee time at Perth public golf courses, then book with the club. See [`SPEC.md`](./SPEC.md) for the full product spec.

**Status:** Milestone 1 done (data foundation). See [`docs/m1-review.md`](./docs/m1-review.md).

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

Needs Node 22 and pnpm 10 (`corepack enable` sets up pnpm).

```sh
pnpm install
pnpm --filter @bookon/db seed   # local database (PGlite in .data/) with the launch courses
pnpm dev                        # web app on http://localhost:3000
pnpm dev:worker                 # worker, needs BOOKON_CONTACT_EMAIL (see apps/worker/README.md)
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
