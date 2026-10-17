# Milestone 1 review: data foundation

17 October 2026.

## What was done

- **Owner decisions recorded:** read MiClub and Quick18 public pages now. Launch courses are Wembley, Collier Park, Hamersley, Marangaroo and The Cut.
- **`packages/db`**: Drizzle schema for the whole SPEC section 7 data model, a first migration, and seed data for the five launch courses. It runs against Postgres (Supabase or Neon) in production, and PGlite (Postgres in-process) for tests and local development, so no database account is needed yet.
- **`packages/adapters`**:
  - MiClub adapter: reads the public calendar, then one timesheet per bookable day and fee type.
  - Quick18 adapter: reads one search page per date.
  - A polite HTTP client: one request at a time per site with a 3 second gap, a user agent naming BookOn with a contact email, robots.txt respected, retries with back-off, and a timeout.
- **`apps/worker`**: `poll`, `start` (repeat every 30 minutes) and `record` (save raw pages for fixtures). A failing course is logged and does not stop the others.
- **Tests:** 58 in total, covering adapters against real saved club pages, HTTP rules, database queries, and a full poll into the database. All pass, along with lint, typecheck and build.

## Schema changes from the spec

| Change                                                          | Why                                                                                                                                        |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `holes`, `layout`, `min_players` and `booking_url` on tee times | 9 vs 18 holes matters for search and price. Some Quick18 slots need at least 2 players. The booking link goes straight to the slot or day. |
| `clubs` and `courses` split                                     | One club can have several bookable courses, as the spec's report section implies.                                                          |
| `availability_checks` (per course and date)                     | Drives "last checked" labels and lets the site say "couldn't check" instead of showing stale times.                                        |
| `fetch_runs`                                                    | Source health for the admin view.                                                                                                          |
| `daily_impressions` instead of an impression row each time      | Keeps the table small.                                                                                                                     |
| `alerts.status` adds `pending`                                  | For double opt-in before an alert goes live.                                                                                               |
| Unique index on notifications per alert and slot                | Enforces "notify once per matching slot" in the database.                                                                                  |
| Snapshots replace each day's rows on every successful check     | The table only ever holds the current state. If history is needed for reports later, add a compact history table.                          |

## Things I was unsure about, or decided myself

1. **Which fee types count.** Search only uses plain 9 and 18 hole adult rates. Twilight, concession, public holiday packages and cart deals are skipped, because their conditions do not fit a results list. Public holiday rates are included, as they replace the normal rate on those days. A course can override this with `feeGroupPattern`.
2. **Price shown** is the adult rate. Concession prices are not stored.
3. **MiClub spots** are counted from free player cells in a row. A row with 2 free cells means up to 2 players can join.
4. **"Not yet released" and "fully booked"** look the same on MiClub calendars. The worker never polls past each course's booking window, which avoids most of the confusion.
5. **Coordinates are empty** in the seed data rather than guessed.
6. **The Cut is about 80 km from Perth**, outside the spec's "Perth only" scope. Seeded as asked.

## Open issues

1. **Not yet run against the live sites.** This build environment blocks club websites, so everything is tested against pages saved in September and October 2025 by the TeeTimeFinder project. Those were saved from a browser after scripts ran, so the raw HTML could differ. **The first live run is the real test.** Run `record` for each course and check the output.
2. **Marangaroo and The Cut are on Chronogolf (Lightspeed Golf)**, not MiClub. They are seeded but switched off. Lightspeed has an official partner API. I recommend applying for access rather than reading Chronogolf pages.
3. **Wembley's `bookingResourceId`** is the MiClub default (`3000000`) and unconfirmed. If it is wrong, the first poll will show an error or no fee groups.
4. **Hamersley's booking window** is a guess (7 days).
5. **Request volume.** MiClub needs about 2 calendar pages and up to 2 timesheets per day, so about 20 requests per course per pass. Polling every 30 minutes, that is about 1,000 requests a day per MiClub course, spaced at least 3 seconds apart. Milestone 4 should poll more often only for dates with active alerts, and less often otherwise.
6. **No hosted database yet.** Production needs `DATABASE_URL` set to Supabase or Neon, and somewhere to run the worker (Railway or Fly).

## How to demo

```sh
pnpm install
pnpm test                                             # all tests, no network needed
pnpm --filter @bookon/db seed                         # local database with the launch courses
BOOKON_CONTACT_EMAIL=you@example.com pnpm --filter @bookon/worker poll -- --course hamersley --days 2
```

On a machine with internet access, the last command fetches Hamersley's live tee times into the local database. In this build environment, it records a clean "robots.txt could not be read" error for each course instead, which shows the failure path working.

## Recommendation for Milestone 2 (search)

- Run the worker against the live sites first (one `record` per course) and fix anything the raw pages reveal.
- Then build the search page on top of `availability_snapshots` and `availability_checks`, with holes as a filter and the "last checked" label from day one.
