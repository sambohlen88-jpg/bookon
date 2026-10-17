# Milestone 3 review: handoff and tracking

17 October 2026. Plan approved by the owner the same day, with one addition: a refresh prompt for results left open too long.

## What was done

- **Tracked Book links.** Every Book button goes to `/go/<token>`. The route records the click, then sends the golfer (302) to the club's page for that day or slot.
  - **Signed tokens.** The token carries the course, the slot and the club's URL, signed with `CLICK_SIGNING_SECRET`, so it can't be edited to point elsewhere.
  - **Booking-site check.** `/go` also checks the destination is that course's own booking site. Anything else goes to the BookOn home page.
- **Anonymous visitor ID.** The `bookon_sid` cookie holds a random UUID, is hidden from page scripts (`httpOnly`), and lasts a year. It's never linked to a name or email, and lets reports count golfers rather than clicks.
- **Search logging.** Each search's dates, times, players, holes, course filter and result count go in `searches`. The same search by the same visitor within a minute (a refresh) counts once.
- **Impressions.** Each course shown with at least one tee time adds one to its daily count in `daily_impressions`.
- **Click logging.** Clicks go in `click_events`. The same visitor clicking the same slot within 10 minutes counts once.
- **Bots don't count.** Crawlers, link previews, scripts and headless browsers are filtered by user agent. `robots.txt` asks crawlers to keep out of `/search`, `/go/` and `/api/`. Link prefetches are not logged.
- **`pnpm stats`.** Prints searches, times shown, clicks, golfers and alert clicks per course for the last 30 days (or `-- --from YYYY-MM-DD --to YYYY-MM-DD`). This stands in until the admin dashboard in Milestone 6, and uses the same query the club report will.
- **Refresh bar** (owner's addition). If results have been on screen for 10 minutes, or the golfer comes back to the tab or presses Back, a bar says how old the times are, with a **Refresh** button. It never reloads by itself. [Screenshot](./m3/m3-refresh-bar.png).

## Checked

| Check                                       | Result                                                                                                                                                                                                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tests                                       | 115 passing, including token signing and tampering, redirects to foreign sites, bot filtering, search and click de-duplication, and the activity report                                                                                                      |
| Live run (production build, real tee times) | Search logged once across a refresh; Book redirected to Kennedy Bay's timesheet; a second click on the same slot not counted; a tampered token sent home; Googlebot's search not counted; refresh bar shown after 11 minutes; `pnpm stats` shows the numbers |
| Logging failures                            | Never block a search or a golfer reaching the club; errors go to the server log                                                                                                                                                                              |

## Decisions I made

1. **Signed tokens rather than stored slot IDs.** Tee time rows are replaced on every poll, so a stored ID would break. A signed token works however old the page is.
2. **No secret in production means no tracking, not a broken site.** Book buttons fall back to direct club links and an error is logged. Added to `.env.example` and the launch checklist.
3. **"Searches that included a course"** counts all-course searches plus searches filtered to it.
4. **Click de-duplication** is 10 minutes per visitor per slot; search de-duplication is 1 minute.
5. **The refresh bar asks rather than reloading,** to avoid losing a golfer's scroll position or open "Show more".

## Not done (as planned)

- Club report page, CSV export and admin login: Milestone 6.
- Rate limiting: Milestone 7.
- Region filter and the two Quick18 courses: waiting on the owner (see below).

## Open issues

1. **MiClub links land on the club's timesheet,** where first-time golfers must register before booking. That's the club's flow and can't be skipped.
2. **Counts are per browser.** The same golfer on phone and laptop counts as two golfers. A cleared cookie counts as a new golfer.
3. **The privacy policy** (Milestone 7) must mention the anonymous cookie and search logging.

## How to demo

```sh
pnpm db:dev                                # keep running
pnpm --filter @bookon/worker poll
pnpm dev                                   # search, click Book a few times
pnpm stats                                 # see the counts
```

To see the refresh bar without waiting 10 minutes, leave a results page open, switch tabs, and come back after 10 minutes. Or press Back after a while.
