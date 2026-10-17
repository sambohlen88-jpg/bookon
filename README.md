# BookOn

Find a tee time at Perth public golf courses, then book with the club. See [`SPEC.md`](./SPEC.md) for the full product spec.

**Status:** Milestone 0 done (setup and research). See [`docs/m0-review.md`](./docs/m0-review.md).

## Layout

```
apps/web        Next.js site (App Router, Tailwind)
apps/worker     Background jobs: availability checks and alert matching
packages/core   Shared types, adapter interface, Perth time helpers
docs/           Research and milestone write-ups
```

## Getting started

Needs Node 22 and pnpm 10 (`corepack enable` sets up pnpm).

```sh
pnpm install
pnpm dev          # web app on http://localhost:3000
pnpm dev:worker   # worker
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
- No adapter reads a live club site without documented permission. See [`docs/platforms.md`](./docs/platforms.md).
