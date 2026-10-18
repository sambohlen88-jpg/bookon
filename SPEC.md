# BookOn: Build Spec for Claude Code

Product name: **BookOn** (previously the working title "Perth Tee Time Finder"). Version 0.1, 17 October 2026. Owner: Perth-based web designer and golfer.

## 1. How to use this document

Save this as `SPEC.md` in the root of a new repository and give it to Claude Code. Ask Claude Code to read it fully, then produce a written plan for Milestone 0 before writing any code. Build one milestone at a time. After each milestone, review the code, run it, and only then move on. Do not let it build everything in one go.

The owner reviews every milestone. Claude Code should explain what it did, list anything it was unsure about, and never silently change scope.

## 2. Product summary

Perth public golfers waste time checking each club's booking page one by one. This product lets a golfer enter when they want to play, then shows which Perth public courses have tee times that fit. Tapping a result takes them to that club's own booking page. If nothing fits, they set an alert and are notified when a matching slot opens.

The product must be fast, mobile-first and clearly better designed than existing free tee time finders. Phase 1 is a free affiliate-style product. It does not take payments and does not book on behalf of the user.

### Goals for Phase 1

- Prove golfers use it: searches, click-throughs to clubs, alerts created, alerts that led to a click.
- Produce a simple report for clubs showing how many golfers the product sent them, to support a free 3 to 6 month trial pitch.
- Be reliable and honest about data freshness.

### Non-goals for Phase 1

- No payments, no commission collection, no card handling.
- No automated booking, no storing club logins or passwords.
- No native iOS or Android apps (a installable web app only).
- No coverage outside Perth.

## 3. Users and core journeys

Primary user: a casual public-course golfer in Perth who plays with 1 to 3 others and books within a week of playing.

Journey A, find a time: open site, choose date, time window and group size, see matching tee times across courses, tap one, land on the club's booking page.

Journey B, get notified: no good times, tap Set alert, enter email (or allow push), get notified when a matching slot appears, tap through to book.

Journey C, club admin (owner only in Phase 1): open the admin dashboard, pick a club and date range, export the club report.

## 4. Features

### Must have

1. **Search.** Inputs: date (or date range up to 14 days), earliest and latest time, number of players (1 to 4), optional distance from the user, optional course filter. Output: list of matching tee times grouped by course, sorted by time, each showing course name, time, available spots, price if known, and when the data was last checked.
2. **Results to club handoff.** Each result opens the club's booking page in the same tab or a new tab. Pre-fill date, course or time through the URL only where the club's platform supports it (verified in Milestone 0).
3. **Click tracking.** Every outbound click goes through our own redirect route first, which logs the click and then forwards the user.
4. **Alerts.** A user saves a search as an alert. The system checks regularly and notifies once per matching slot. Easy to pause or delete without an account, via a link in every message.
5. **Course directory.** A page per Perth public course with location, holes, booking platform, link to the club, and typical fees where verified.
6. **Club report.** Per club and date range: searches that included the club, result impressions, outbound clicks, alerts that included the club, clicks that came from alerts. Exportable as CSV and a simple printable page.
7. **Admin dashboard (owner only).** Course list with data source health (last successful fetch, error counts), manual enable and disable per course, report generator.

### Should have

- Installable web app (PWA) with web push notifications.
- Map or list-by-distance view.
- Saved defaults (last used group size and time window) stored on the device.

### Later (not Phase 1)

- Payments and commission, partner API bookings, native apps, user reviews, other cities.

## 5. Recommended stack

These are recommendations. Claude Code may suggest alternatives but must explain why.

- **Language and framework:** TypeScript, Next.js (App Router), Tailwind CSS.
- **Database:** PostgreSQL (Supabase or Neon), accessed via Drizzle or Prisma.
- **Background work:** a scheduled worker for availability checks and alert matching (a cron-triggered job runner or a small queue). Keep it separate from the web app so slow fetches never slow the site.
- **Notifications:** email via Resend or Postmark; web push via the standard Web Push API; SMS optional later.
- **Hosting:** Vercel for the web app, a small container host such as Railway or Fly for the worker.
- **Monitoring:** Sentry for errors, simple uptime checks, and a health page for each course data source.
- **Time zone:** all user-facing times in Australia/Perth (AWST, no daylight saving). Store timestamps in UTC.

## 6. Architecture

### Course adapter pattern

Each booking platform gets an adapter that implements one interface. Example shape (Claude Code to finalise):

- `fetchAvailability(course, dateRange)` returns a list of tee times with course id, start time, spots available, price if known, and the source URL.
- `buildBookingUrl(course, teeTime)` returns the best deep link to the club's booking page.

Planned adapters: `miclub`, `quick18` (the two most common platforms in Australia, per the owner's research), and a `manual` adapter for clubs that only have a phone or walk-up booking (listed in the directory but not searchable).

### Fetching rules

- Poll politely: cache results, stagger requests, cap request rate per host, identify the product in the user agent, back off on errors.
- Use short refresh intervals only for dates with active alerts. Otherwise refresh less often.
- Every tee time shown must display a last checked time. If a course's data is stale or failing, show a clear notice rather than old results.
- Each course has a feature flag so it can be switched off instantly.

### Gate before building scrapers

Before writing any adapter, Milestone 0 must document how each platform exposes public availability and whether the clubs' terms permit automated reading. If a source is not clearly permitted, stop and ask the owner. Prefer official feeds or a written permission from the club or vendor. The owner intends to approach clubs and vendors for data access.

## 7. Data model (first draft)

- **courses:** id, name, slug, suburb, latitude, longitude, holes, platform (miclub, quick18, manual), platform\_config (json), website\_url, booking\_url, enabled, notes.
- **availability\_snapshots:** id, course\_id, start\_time, spots\_available, price\_cents (nullable), fetched\_at. Keep recent snapshots only (for example 48 hours), plus a compact history table for reporting if needed.
- **searches:** id, created\_at, anonymous\_session\_id, date\_from, date\_to, time\_from, time\_to, players, course\_ids, result\_count.
- **alerts:** id, created\_at, contact\_type (email or push), contact\_value, filters (json), status (active, paused, deleted), manage\_token, last\_notified\_at.
- **notifications:** id, alert\_id, course\_id, start\_time, sent\_at, channel, click\_token.
- **click\_events:** id, created\_at, anonymous\_session\_id, course\_id, start\_time, source (search or alert), notification\_id (nullable).
- **clubs and club\_reports:** club\_id linked to courses, saved report configs and generated report runs.

Privacy: collect only what is needed. Store no passwords, no payment data. Anonymous sessions use a random id, not personal identifiers.

## 8. Click tracking and club reporting

- Outbound links use a route like `/go/<click_token>` that logs a click event then redirects.
- Reports count: searches including the club, impressions, clicks, alerts, alert-driven clicks, and estimated value (clicks multiplied by the typical green fee for the course, clearly labelled as an estimate).
- Do not claim confirmed bookings in Phase 1. Real conversions need club cooperation (for example a promo code or a booking-source field). Design the report so a real bookings column can be added later.

## 9. UX and design direction

The owner is a web designer and will supply brand, colours and visual direction. Until then, build a clean, minimal, mobile-first design with real components that are easy to restyle.

- Three taps or fewer from landing to the club's booking page.
- Search form is the whole first screen on mobile. No sign-up wall.
- Results load quickly and show skeletons while loading.
- Clear empty state that leads straight to Set alert.
- Accessible by default: good contrast, keyboard use, screen reader labels, large touch targets.
- Friendly, short copy written in plain Australian English.

## 10. Non-functional requirements

- Fast: results visible within about 2 seconds for a typical search on a mobile connection (served from cached data).
- Reliable: course failures must not break the whole site.
- Secure: environment secrets only, no secrets in the repo, rate limit public endpoints, protect the admin area.
- Legal basics: privacy policy and terms pages, clear consent when collecting email or push permission, unsubscribe in every message. Australian rules on commercial email and SMS and on privacy apply, so the owner should get proper legal advice before launch.
- Tested: unit tests for adapters and alert matching, a few end-to-end tests for the main journeys, and sample fixtures for each platform's responses so tests do not hit live club sites.

## 11. Build plan

Each milestone ends with a short written summary, a list of open issues, and a demo the owner can run.

- **M0, research spike and setup.** Create the repo, project structure and CI. Document how MiClub and Quick18 public calendars work, whether deep links can pre-fill date or time, and what the clubs' terms say about automated access. No scrapers yet. Output: `docs/platforms.md`.
- **M1, data foundation.** Database schema, seed data for the first 3 to 5 Perth courses, and the first adapter for one platform with recorded fixtures and tests.
- **M2, search.** Search form, results page, freshness labels, stale data notices.
- **M3, handoff and tracking.** Redirect route, click logging, deep links where verified.
- **M4, alerts.** Create, manage and delete alerts, matching job, email notifications with manage links.
- **M5, installable app.** PWA setup, web push, performance pass.
- **M6, club reporting and admin.** Admin login, source health view, report page and CSV export.
- **M7, hardening and launch.** Error monitoring, rate limits, privacy and terms pages, accessibility check, backups, launch checklist.

**Owner's change, 17 October 2026:** Milestone 6 is now the full website (a website design on desktop with course images and a bigger brand area, mobile unchanged), and Milestone 7 is club onboarding (clubs sign up with their details, approvals, tee time setup and full price list, ready for payments later). The original M6 (club reporting and admin) and M7 (hardening and launch) move to M8 and M9.

**Owner's change, 18 October 2026:** Milestone 9 is now sharing tee times with mates: a picture of the times for a group chat, a link that shows what was shared (with times booked since crossed out), and the times as plain text. Hardening and launch move to Milestone 10.

**Owner's change, 18 October 2026 (later):** Milestone 10 is now the rest of the site on phones: an app-style menu bar, more on the home page (recent searches, My courses, Free soon), a courses page with areas, search and Near me, richer course pages (next times, club details and prices, weather, courses nearby), My account in tabs, quick day buttons and areas on the search, Near me on the search, and weather from MET Norway. Hardening and launch move to Milestone 11.

**Owner's change, 18 October 2026 (later still):** Milestone 11 is now golf simulators and driving ranges: Perth venues whose free bays can be read live, searched by session length rather than holes, and the install prompt for phones only (not desktop). The owner approved Your Golf Booking venues only (OuttaBounds, Albatross Lounge, Elevate Golf Lounge, Lights Out Golf), with venues without live times left out and Big Swing left for later. Hardening and launch move to Milestone 12.

## 12. Phase 2 preview (do not build yet)

Stripe Connect style payments and commission, official partner API adapters that can book and cancel, support for a booking history and refunds, more cities, and native apps. Keep the adapter interface flexible enough that a `book()` and `cancel()` method can be added later.

## 13. Decisions the owner still needs to make

- ~~Product name~~ (decided: BookOn), domain and brand.
- Which first 3 to 5 courses to launch with.
- Whether to allow email only or also push at launch.
- Whether to approach clubs and platform vendors before or after the first public version.
- Budget for hosting, email sending and marketing.

## 14. Kick-off prompt to paste into Claude Code

> Read SPEC.md fully. Do not write code yet. First, write a short plan for Milestone 0 and list any questions or risks you see in the spec. In particular, tell me anything that looks wrong, missing or too ambitious. When I approve the plan, carry out Milestone 0 only, then stop and summarise what you found and what you recommend for Milestone 1.
