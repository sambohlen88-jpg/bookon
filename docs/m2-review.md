# Milestone 2 review: search

17 October 2026.

## What was done

- **Three more courses checked**, at the owner's request:
  - **Fremantle Public** works and is switched on.
  - **Point Walter** has moved to Chronogolf, so it is switched off.
  - **Whaleback** has not been checked: its domain is not on the build environment's allowed list.
- **Search page.** The search form is the whole first screen. It asks for:
  - day, and how flexible (just that day, 3 days, a week or 2 weeks)
  - earliest and latest time
  - players (1 to 4)
  - holes (9, 18 or either)
  - optionally, which courses
- **Results page.** Tee times are grouped by course, the course with the earliest time first, sorted by time. Each shows the time, holes, layout, free spots, adult price and a **Book** button that opens the club's page for that day or slot.
- **Freshness.** Each course says when it was last checked ("Checked 6 min ago").
- **Stale and failing data.** A day's times show only if that day was checked successfully in the last 90 minutes. Otherwise the course shows a notice ("We couldn't check Sun 18 Oct just now, so we're not showing old times") instead of the old times.
- **Days not released yet.** Days beyond a club's booking window say so, and say when times should appear.
- **Empty state.** "No tee times match" offers one-tap wider searches (any time, the next 7 days, either holes, all courses) and a placeholder for alerts (Milestone 4).
- **Loading skeleton** while results load, and a friendly error page if search fails.
- **Local development database.** `pnpm db:dev` runs PGlite as a small Postgres server, so the website and worker share one database with no Postgres install.

Screenshots at phone width (390 px), using live data from 17 October 2026: [home](./m2/m2-home.png), [results](./m2/m2-results.png), [two weeks](./m2/m2-two-weeks.png), [no matches](./m2/m2-empty.png).

## Checked

| Check                                                   | Result                                                                                                             |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Unit and integration tests                              | 89 passing. They cover search filters, freshness and booking windows, form parsing, and the new live page formats. |
| Accessibility (axe-core, WCAG 2.1 AA and best practice) | No violations on any page, in light or dark mode. That includes colour contrast.                                   |
| Speed (production build, local)                         | One day: about 0.05 to 0.25 s, 20 to 42 KB compressed. Two weeks, any time: about 0.14 s, 37 KB compressed.        |
| Works without JavaScript                                | Yes. The form is a plain GET form, so every search also has a shareable URL.                                       |
| Touch targets                                           | 44 to 48 px tall.                                                                                                  |

## Decisions I made

1. **Holes filter added** (9, 18 or either), as recommended in the M0 review. Most courses sell both at different prices.
2. **Date range is a "how flexible?" choice** (1, 3, 7 or 14 days) rather than a second date picker. That is easier on a phone. Ranges never go past 14 days from today.
3. **Default time window is 5 am to 8 pm** (any time), default group size is 2, and after 4 pm the default day is tomorrow.
4. **Long result lists are capped** to keep pages light on mobile data. A two week search first produced 3.5 MB of HTML. Now:
   - one day shows 6 times per course, with up to 40 more folded away
   - longer searches show 4 per course per day
   - "See all" opens one course on one day, where every time is listed
5. **A row with one price uses it,** even when its label says "concession". Fremantle lists only "Cored and Sanded Greens Concession Rate Applies" ($20.50), which is the rate for everyone while its greens recover.
6. **Layout names are tidied.** Collier Park staff type them several ways ("Island (9) Island & Pines (18)", "Pines 9 Holes ONLY"). BookOn shows "Island & Pines" or "Pines".
7. **Courses with nothing matching still appear,** at the bottom, so golfers know they were checked.

## Left for later milestones

| Item                                                           | Why it waits                                                                        |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Logging searches and impressions; Book links through `/go/...` | Milestone 3 (handoff and tracking). Book buttons link straight to the club for now. |
| Set alert                                                      | Milestone 4. The empty state shows a "coming soon" card.                            |
| Distance filter and map                                        | Course coordinates are not entered yet.                                             |
| Remembering the last group size and times on the device        | A "should have"; small to add with Milestone 5 (installable app).                   |
| A course directory page per course                             | Not in the M2 scope.                                                                |

## Open issues

1. **Only three courses are searchable:** Collier Park, Fremantle Public and Hamersley.
   - **Whaleback:** add `www.whalebackgolfcourse.com.au` to the environment's allowed domains, then I can check it.
   - **Wembley:** blocked by a CAPTCHA. Needs the club's permission.
   - **Marangaroo, The Cut and Point Walter:** all on Chronogolf. Lightspeed partner API access would unlock all three.
2. **The local PGlite server mixes up overlapping queries** on one connection. Search runs its queries one after another to avoid this. Real Postgres in production does not have the problem.
3. **The worker is not running on a schedule anywhere yet,** so data goes stale 90 minutes after the last manual poll, and search then shows notices. Hosting is needed for real use.
4. **Prices and layout names are as the clubs type them,** for example "Pines 9 ONLY" before tidying, or "1st Tee" at Fremantle. Odd new spellings may appear.
5. **Brand.** Colours and type are placeholders. Swap the tokens in `apps/web/src/app/globals.css` when the brand is ready.

## How to demo

```sh
pnpm install
pnpm db:dev                                                   # keep running
pnpm db:seed
NODE_USE_ENV_PROXY=1 pnpm --filter @bookon/worker poll        # NODE_USE_ENV_PROXY only behind a proxy
pnpm dev                                                      # open http://localhost:3000
```

Results show for 90 minutes after a poll. Run the poll again, or `pnpm dev:worker` to keep polling every 30 minutes.

## Recommendation for Milestone 3 (handoff and tracking)

- `/go/<token>` redirect that logs the click, then forwards to the club.
- An anonymous session cookie, so the club report can count searches and clicks without personal data.
- Log each search and add to `daily_impressions` per course shown.
- Plan first, as usual.
