# Milestone 0 review

17 October 2026. Scope: repo, project structure, CI, platform research. No scrapers, no product features.

## What was done

- **Monorepo** (pnpm workspaces):
  - `apps/web`: Next.js 15 (App Router), TypeScript, Tailwind 4. A placeholder home page and `/api/health`. Brand colours are CSS tokens in `globals.css` so the real brand can drop in.
  - `apps/worker`: a separate background process, as the spec asks, so slow fetches never touch the site. Registers no adapters yet.
  - `packages/core`: shared domain types, the draft `CourseAdapter` interface, and Perth time helpers with unit tests.
- **CI** (`.github/workflows/ci.yml`): format check, lint, typecheck, tests, build on every push to `main` and every pull request.
- **Research**: [`docs/platforms.md`](./platforms.md).
- `SPEC.md` copied into the repo and renamed to BookOn.

## Choices made that differ from, or go beyond, the spec

| Choice                                     | Why                                                                                                                                             |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| pnpm monorepo with `web`, `worker`, `core` | The spec wants the worker separate from the web app. Both need the same types and adapter code, so a shared package avoids copying.             |
| Next.js 15, not the newest major           | Chose the mature, widely used line for stability. Upgrading is a small job if wanted.                                                           |
| System font stack, no Google Fonts         | The owner will supply brand fonts. Avoids a network fetch at build time.                                                                        |
| No database or ORM yet                     | Belongs to Milestone 1. Recommendation: **Drizzle** over Prisma. It is lighter, SQL-first, and runs the same way in the web app and the worker. |

## Problems found in the spec

Ordered by how much they matter.

1. **The data source gate is not passed.** Neither MiClub nor Quick18 clearly permits automated reading, and MiClub has built a lottery system specifically to fight bots. Per section 6, this needs an owner decision before any adapter is built. See the recommendation in `platforms.md`.
2. **TeeNet already does Journey A for free for MiClub courses**, and it is run by the platform BookOn would read from. BookOn's edge has to be alerts, design, and covering Quick18 courses too. Worth stating in the pitch to clubs.
3. **"Three taps to the club's booking page" will often land on a registration form.** MiClub clubs ask first-time public golfers to register, and some require prepayment. The goal still holds, but the club report should not imply that a click equals a booking (the spec already says this).
4. **9 or 18 holes is missing** from the search inputs and the `availability_snapshots` table. Wembley, Collier Park, Whaleback and the Quick18 courses all sell both, at different prices. Add `holes` to tee times and an optional holes filter to search.
5. **One venue can have several courses.** Wembley has two 18-hole courses, Collier Park has three nines, Maylands and Embleton share one booking site. The data model should separate _venue_ (club, location, booking site) from _course_ (bookable layout, with its own platform config such as MiClub `booking_resource_id`).
6. **The 14-day range is longer than any club's booking window** (8 to 10 days found). Results should say "Times open on <date>" for days not yet released, otherwise users see false empty states.
7. **Prices vary** by player type (adult, concession) and, at Collier Park, by demand. Store "from" price and label it as such.
8. **Alerts "once per matching slot" needs a rule for slots that vanish and come back** (cancellations). Suggest: notify again only if the slot was gone for at least a set time, and cap messages per alert per day.
9. **Alerts timed to timesheet release** look like what MiClub's lottery is designed to stop. Consider leaving release-time alerts out of Phase 1 and focusing on cancellations.
10. **Logging every result impression** grows fast. Store daily counts per course instead of one row per impression.
11. **Email alerts fall under the Spam Act 2003.** The spec covers consent and unsubscribe. Add double opt-in (confirm by email before the alert goes live) so nobody can sign someone else up.

## Questions for the owner

1. **Data access:** approach MiClub and Sagacity for permission now, before any parser exists? Or approve M1 building a parser against pages you save by hand from a browser, with live fetching switched off until permission arrives?
2. **Launch courses:** which 3 to 5? A mix that covers both platforms would be Wembley, Collier Park, Whaleback (MiClub) and Hamersley, Point Walter (Quick18).
3. **Hosting accounts:** GitHub repo, Vercel, Postgres provider (Supabase or Neon). Needed early in M1.
4. **Domain:** is `bookon.com.au` (or similar) secured? It affects the user agent string and email sending setup.

## Recommendation for Milestone 1

If the owner approves question 1 with the hand-saved-fixtures option:

- Drizzle schema with the venue and course split, `holes` on tee times, and daily impression counts.
- Seed data for the chosen launch courses (all with live fetching disabled).
- One adapter, probably Quick18 first. Its date URL format is clearer and its pages appear simpler. It would parse saved HTML fixtures only, with full tests.
- A polite HTTP client in the worker (rate cap per host, user agent with contact email, backoff), built and tested but not pointed at any real site.

## Environment note

This build environment's network policy blocked club and platform websites, so the research relies on search results. To have Claude verify pages directly in a later session, add the club and platform domains under **Allowed domains** in the environment's network settings ([docs](https://code.claude.com/docs/en/cloud-environments#network-access)).
