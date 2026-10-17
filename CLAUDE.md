# BookOn: notes for Claude Code

Read `SPEC.md` before starting work. The product is BookOn (the spec's working title was "Perth Tee Time Finder").

## Working rules

- Build one milestone at a time (SPEC section 11). Plan first, wait for owner approval, then build. Never change scope silently.
- End each milestone with a write-up in `docs/` covering what was done, what was uncertain, open issues, and how to demo it.
- No adapter may fetch a live club or platform site until `docs/platforms.md` records permission for that source. Tests use saved fixtures only.
- Copy is plain Australian English, short and friendly.

## Code

- pnpm workspaces: `apps/web` (Next.js), `apps/worker`, `packages/core`.
- Shared types and the `CourseAdapter` interface live in `packages/core`. Keep platform-specific code inside its adapter.
- Times: store UTC, display Perth time via helpers in `packages/core/src/time.ts`. Do not hand-roll offsets elsewhere.
- Colours come from CSS tokens in `apps/web/src/app/globals.css`, not hard-coded values in components.
- Before finishing: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
