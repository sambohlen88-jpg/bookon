# BookOn: notes for Claude Code

Read `SPEC.md` before starting work. The product is BookOn (the spec's working title was "Perth Tee Time Finder").

## Working rules

- Build one milestone at a time (SPEC section 11). Plan first, wait for owner approval, then build. Never change scope silently.
- End each milestone with a write-up in `docs/` covering what was done, what was uncertain, open issues, and how to demo it.
- Only fetch platforms the owner has approved in `docs/platforms.md` (MiClub, Quick18, Chronogolf and Your Golf Booking so far), and only through `PoliteHttpClient`. The other outside services (MET Norway weather, OpenStreetMap locations, Stripe, and coaches' own calendar links) are listed there too, with their terms. Tests use saved fixtures only, never the live sites.
- A page that does not look like the expected platform page is an error, never "no tee times".
- Never get past a CAPTCHA, login wall or other block a club puts up. Record it and tell the owner.
- When Claude runs the worker or fetches pages, obey robots.txt rules for `Claude-User` as well as BookOnBot (the worker does this when `CLAUDECODE` is set). Quick18 blocks `Claude-User`, so Claude must not fetch Quick18 pages; the owner runs Quick18 checks.
- Before any launch work (Milestone 19, a public link, or telling golfers about the site), remind the owner of the open items in `docs/launch-checklist.md`, starting with verified platform access.
- Copy is plain Australian English, short and friendly.

## Code

- pnpm workspaces: `apps/web` (Next.js), `apps/worker`, `packages/core`, `packages/adapters`, `packages/db`, `packages/email`, `packages/payments`.
- Shared types and the `CourseAdapter` interface live in `packages/core`. Platform-specific code stays inside its adapter in `packages/adapters`.
- Schema changes: edit `packages/db/src/schema.ts`, then `pnpm --filter @bookon/db generate --name <what_changed>` and commit the migration.
- In the Claude Code cloud environment, run live worker commands with `NODE_USE_ENV_PROXY=1`.
- Local database: `pnpm db:dev` (PGlite on port 5433, served by `packages/db/src/scripts/dev-server.ts`). PGlite is a single database session, so the server runs one connection's query (or open transaction) at a time and keeps its messages together; the stock pglite-server mixed up the web app's and worker's queries ("Failed query"). `createDb` still uses one connection for it, so keep a request's queries one after another, not `Promise.all`.
- Times: store UTC, display Perth time via helpers in `packages/core/src/time.ts`. Do not hand-roll offsets elsewhere.
- Admin and club pages check access in every page, action and download (`requireAdmin`, `requireClub`, `clubAccess`, `isAdminRequest` in `apps/web/src/lib/access.ts`), never only in a layout. Give each form button that makes a different decision its own server action.
- Lesson payments go through `packages/payments` (Stripe, or practice payments on a local database). Money moves first, then the booking, and every step only moves a booking from the state it expects. Tests use the saved Stripe responses, never the live API.
- Emails go through `createMailer` in `packages/email`. Locally they land in the outbox (`/dev/outbox`); never send real email to anyone but the owner without their say-so.
- Colours come from CSS tokens in `apps/web/src/app/globals.css`, not hard-coded values in components. The exceptions are the course illustrations (`apps/web/src/lib/course-art.ts`) and the share pictures (`apps/web/src/lib/share-picture.tsx`), which are served as images and can't see page CSS, so they carry their own palette.
- Never copy photos or logos from club websites. Course pictures are drawn, or supplied by the club with permission.
- Before finishing: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
