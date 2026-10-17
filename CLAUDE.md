# BookOn: notes for Claude Code

Read `SPEC.md` before starting work. The product is BookOn (the spec's working title was "Perth Tee Time Finder").

## Working rules

- Build one milestone at a time (SPEC section 11). Plan first, wait for owner approval, then build. Never change scope silently.
- End each milestone with a write-up in `docs/` covering what was done, what was uncertain, open issues, and how to demo it.
- Only fetch platforms the owner has approved in `docs/platforms.md` (MiClub and Quick18 so far), and only through `PoliteHttpClient`. Tests use saved fixtures only, never the live sites.
- A page that does not look like the expected platform page is an error, never "no tee times".
- Copy is plain Australian English, short and friendly.

## Code

- pnpm workspaces: `apps/web` (Next.js), `apps/worker`, `packages/core`, `packages/adapters`, `packages/db`.
- Shared types and the `CourseAdapter` interface live in `packages/core`. Platform-specific code stays inside its adapter in `packages/adapters`.
- Schema changes: edit `packages/db/src/schema.ts`, then `pnpm --filter @bookon/db generate --name <what_changed>` and commit the migration.
- Times: store UTC, display Perth time via helpers in `packages/core/src/time.ts`. Do not hand-roll offsets elsewhere.
- Colours come from CSS tokens in `apps/web/src/app/globals.css`, not hard-coded values in components.
- Before finishing: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
