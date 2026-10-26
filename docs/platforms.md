# Booking platforms research

Status: **Milestone 0 research, updated in Milestone 1 (17 October 2026).** Covers MiClub and Quick18, the Perth public courses found on each, deep-link support, and what is known about permission for automated reading.

## How this research was done, and its limits

The build environment's network policy blocked direct access to club and platform websites, so **no page was opened, no `robots.txt` was read and no terms document was read in full.** Everything below comes from web search results: indexed URLs, page titles and snippets. Each claim links to its source. Where a fact is inferred from a URL pattern rather than read from a page, it says so.

Before Milestone 1, the owner (or a session with those hosts allowed) should check the items marked **Unverified** by opening the pages in a normal browser.

## Summary

|                                      | MiClub                                                                                                                                                            | Quick18 (now Sagacity Golf)                                                                 |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Who                                  | Perth-based golf software company, owned by Northstar Technologies since October 2021. Used by 400 to 500+ venues.                                                | US tee sheet vendor, rebranded as Sagacity Golf. Used by a handful of Perth public courses. |
| Perth public courses found           | Wembley, Collier Park, Whaleback, Carramar, Maylands and Embleton, Marangaroo                                                                                     | Hamersley, Point Walter, The Springs, Lake Claremont                                        |
| Public availability page             | Yes, no login needed to view: `/guests/bookings/ViewPublicCalendar.msp`                                                                                           | Yes, no login needed to view: `/teetimes/searchmatrix?teedate=YYYYMMDD`                     |
| Booking needs an account at the club | Yes, at least at Wembley and Perth Golf Network                                                                                                                   | Unverified                                                                                  |
| Date deep link                       | Likely (`selectedDate` parameter seen in indexed URLs). **Unverified.**                                                                                           | Yes, strong evidence (`teedate=YYYYMMDD` in many indexed URLs)                              |
| Time or group size deep link         | No evidence found                                                                                                                                                 | No evidence found                                                                           |
| Official feed                        | **TeeNet**, MiClub's own free tee time search, takes a "live feed" from every club on MiClub's public timesheet module. No public API or partner programme found. | No public API found. Sagacity runs an integrations programme (e.g. Toast POS).              |
| Terms on automated access            | No clause found either way. MiClub is actively fighting booking bots.                                                                                             | No clause on scraping found in snippets. Full Terms of Service not read.                    |
| **Verdict**                          | **Not clearly permitted. Ask before building.**                                                                                                                   | **Not clearly permitted. Ask before building.**                                             |

**Update, 17 October 2026: the owner decided to go ahead and read MiClub and Quick18 public pages** (see "Owner decision" below). The verdict row above records the position before that decision.

## Owner decision (17 October 2026)

The owner decided to start reading MiClub and Quick18 public availability, ahead of approaching the platforms for permission. The worker reads only public pages that need no login, identifies itself in its user agent with a contact email, honours robots.txt, waits at least 3 seconds between requests to the same site, backs off on errors, and never books. Approaching MiClub (TeeNet feed) and Sagacity for written permission is still recommended.

**Update, 17 October 2026:** the owner also approved reading Chronogolf (Lightspeed Golf) public availability on the same terms, for Marangaroo, The Cut and Point Walter. **Before full launch, get verified access or written permission from all three platforms: MiClub, Sagacity (Quick18) and Lightspeed (Chronogolf).** This is tracked in [`launch-checklist.md`](./launch-checklist.md).

## What the saved pages confirmed (Milestone 1)

This session still could not reach the club sites. But the open-source [TeeTimeFinder](https://github.com/Ay1tsMe/TeeTimeFinder) (MIT licence) includes browser-saved pages from Collier Park, Fremantle Public, Hamersley and The Springs (September and October 2025). They confirm the structure below, and the adapters are tested against them.

### MiClub

- Calendar: `/guests/bookings/ViewPublicCalendar.msp?bookingResourceId=3000000&selectedDate=YYYY-MM-DD&weekends=false`. Shows 6 days per page. One row per fee group ("18 Holes", "9 Holes", "18 Holes - Public Holiday", "Twilight", packages). Bookable cells link to a timesheet, others say "No Bookings Available" or "Not Available".
- Timesheet: `/guests/bookings/ViewPublicTimesheet.msp?bookingResourceId=3000000&selectedDate=YYYY-MM-DD&feeGroupId=<id>`. One row per tee time with the time, a layout ("Pine Lake 18 Holes", "1st Tee"), adult and concession prices, and four player cells marked `cell-available` or `cell-taken`.
- **Date deep link: confirmed.** The timesheet URL opens a given day and fee group directly. BookOn links golfers there.
- Collier Park's `bookingResourceId` is `3000000` (from the saved page URL). Wembley's is still assumed.
- A public timesheet page carries a "No Login? Sign Up" button, confirming golfers must register to book.

### Quick18

- Search matrix: `/teetimes/searchmatrix?teedate=YYYYMMDD`. One page per date. Columns are rates ("9 Holes", "9 Holes Concession", "Twilight Unlimited Golf", "18 holes"). Rows give the time, layout ("Back 9 Morning", "Hamersley") and group size ("1 player", "1 or 2 players", "1 to 4 players").
- **Slot deep link: confirmed.** Each bookable cell has a Select link like `/teetimes/course/1161/teetime/202510180607?psid=6547&p=0`, which opens that exact slot. BookOn links golfers there.
- The search form has players and time-of-day fields (`SearchForm_Players`, `SearchForm_TimeOfDay`), so pre-filling those by URL may be possible. Not tested.

### Caveat

These were saved from a browser after scripts ran, so the raw server HTML could differ. The live check below confirmed it does not, for Collier Park and Hamersley.

## Live check (17 October 2026)

With the club sites allowed in the build environment, the worker read the live pages through `PoliteHttpClient`. Raw pages from this run are now test fixtures (`packages/adapters/fixtures/*/live-*`).

| Course       | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Collier Park | **Works.** 308 tee times over 5 days. Raw server HTML matches the saved pages. Found a real-world variant: while greens are cored, the normal rates are named "18 Holes - Maintenance (Greens Coring)", so the adapter now accepts any " - note" after the hole count. Layouts read "Lake (9) or Lake & Island (18)"; BookOn shows the part that matches the holes booked.                                                                                                                                                                                |
| Hamersley    | **Works.** 927 tee times over 16 days, with 9 hole ($28) and 18 hole ($37) adult rates. Times were listed at least 16 days ahead, so the window is longer than the 7 days first assumed. BookOn reads 14 days, the spec's longest search range.                                                                                                                                                                                                                                                                                                           |
| Wembley      | **Blocked by a CAPTCHA. Switched off.** The calendar loads (and `bookingResourceId` 3000000 is right), but the calendar sets `publicCaptchaEnabled = true` and timesheets sit behind Google reCAPTCHA. A direct timesheet request returns the calendar instead. A CAPTCHA is a clear sign the club does not want automated reading, so **BookOn does not try to get past it.** The adapter now detects the flag on the calendar and stops before requesting any timesheet. Wembley needs the club's permission or a feed (the Town of Cambridge runs it). |

Three more courses were checked the same day, at the owner's request:

| Course           | Result                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fremantle Public | **Works. Switched on.** MiClub, no CAPTCHA. 670 tee times over 9 days; times are listed 9 days ahead (today plus 8).                                                                                                                                                                                                                                                        |
| Whaleback        | **Not checked yet. Switched off.** The build environment's network policy blocks `www.whalebackgolfcourse.com.au`. Add it to the environment's allowed domains and run `record -- --course whaleback`.                                                                                                                                                                      |
| Point Walter     | **Moved to Chronogolf. Switched off.** The old Quick18 site (`pointwaltergoannagolf.quick18.com`) now says "Website coming Soon...". Bookings are on [Chronogolf](https://www.chronogolf.com/club/point-walter-public-golf-course) and open 11 days ahead ([Point Walter bookings](https://www.pointwaltergolf.com.au/play-golf/golf-bookings/)). Run by Belgravia Leisure. |

Chronogolf now covers three of the owner's courses (Marangaroo, The Cut, Point Walter), which strengthens the case for Lightspeed partner API access.

Note for anyone running the worker behind an HTTP proxy: Node's built-in `fetch` ignores `HTTPS_PROXY` unless `NODE_USE_ENV_PROXY=1` is set (Node 22.21 or later).

## robots.txt check (17 October 2026)

| Platform   | What robots.txt blocks                                                                                                                | BookOnBot (the product)              | Claude fetching for the owner                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| MiClub     | AI training and large-scale crawlers (ClaudeBot, anthropic-ai, GPTBot and others); `/members/`, `/security/` and similar for everyone | Allowed on `/guests/` booking pages  | Allowed (`Claude-User` is not listed)                                                                  |
| Quick18    | AI agents including `Claude-User`, SEO bots, and generic scraper tools (curl, python-requests, Scrapy)                                | Allowed by the letter (no `*` group) | **Blocked.** Claude no longer fetches Quick18 pages; the worker enforces this when Claude Code runs it |
| Chronogolf | `/private_api/`, `/reservations/`, user and password pages                                                                            | Allowed on public pages              | Allowed                                                                                                |

Quick18's list of blocked scraper tools shows it does not welcome automated reading in general, even though BookOnBot is not named. That makes written permission from Sagacity more important before launch. Claude fetched Hamersley pages earlier on 17 October 2026, before reading this file closely; it will not again.

## Chronogolf turned out to be a dead end (17 October 2026, later)

After the owner approved Chronogolf, the live check found:

- **All three Chronogolf club pages now return 404:** `chronogolf.com/club/marangaroo-golf-course`, `.../point-walter-public-golf-course` and `.../the-cut-golf-course`. The Chronogolf homepage and other clubs' pages still load. The listings found in search results appear to be out of date.
- **Marangaroo looks like MiClub on its own domain.** Search results show `marangaroogolf.com.au/?bookingResourceId=` and `?doAction=displayHomePage`, which are MiClub patterns, and TeeNet (MiClub's own search) listed Marangaroo in Milestone 0. Point Walter's site is built the same way by the same operator (Belgravia Leisure), so it probably is too.
- **The Cut's own site is `thecutgolf.com.au`** (not `the-cut.com.au`). Its booking system is not confirmed; Future Golf and GolfNow both list it.
- The build environment blocks `www.marangaroogolf.com.au`, `www.pointwaltergolf.com.au` and `www.thecutgolf.com.au`, so none of this could be confirmed yet.

No Chronogolf adapter has been built. If these courses are on MiClub, the existing adapter covers them.

Also checked:

- **Whaleback works. Switched on.** MiClub, no CAPTCHA, rates named "18 Hole" ($39 weekday) and "9 Hole" ($26).
- **Carramar's site answers HTTP 403 to BookOnBot,** even for robots.txt. The network policy did not block it; the club's site did. That is a block, so Carramar stays out.

## WA expansion (17 October 2026, later)

At the owner's request ("as many courses in Perth or WA as possible"), about 60 likely `<club>.miclub.com.au` addresses were probed. **22 more MiClub courses read cleanly and are switched on, for 26 searchable in all.** A full poll of all 26 then took about 2 minutes: 557 requests, about 19,700 tee times, every MiClub course ok. The full list, and the courses left out with reasons, is in [`courses.md`](./courses.md).

Changes to the MiClub reader that this needed:

- **Rate names.** Any rate naming 9 or 18 holes counts unless it mentions a package, deal, cart, meal, twilight, junior or member rate. This covers "18 Hole Green Fees", "18 Holes Weekday", "18 Holes Online Booking", "Maylands 9 Holes (carts can be added)" and "18 Holes - WALKING". A course can still override this (Joondalup does, as its 18 hole rate always includes a cart).
- **Other booking calendars.** Rockingham and Joondalup keep public bookings on resource 3900000.
- **Fees in a pop-up.** Rockingham lists fees in a popover, not a list.
- **Tee names.** Clubs type rows like "1st TEE 18 HOLE SOCIAL PLAY", "Monday 10th tee" or "No 1 Tee". BookOn shows "1st Tee" or "10th Tee".
- **Competition rows.** Rows labelled for a competition or members (for example "9 Hole Ladies Comp" at Pinjarra) are skipped.
- **Twilight rows** are priced at the twilight fee they list (Dunsborough Lakes), as that is what an adult pays then.
- **Days not released yet.** Past a club's window the calendar comes back with no rates. BookOn now reads that as "nothing released" and stops paging, instead of failing the course.

## Chronogolf (Lightspeed Golf)

Two of the owner's launch courses are on neither MiClub nor Quick18:

| Course               | Evidence                                                                                                                                                                                                                                                                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Marangaroo           | [Chronogolf club page](https://www.chronogolf.com/club/marangaroo-golf-course), "powered by Lightspeed". Own site says online bookings open 11 days ahead from 9 am ([Marangaroo bookings](https://www.marangaroogolf.com.au/play-golf/golf-bookings/)). The earlier note that Marangaroo is on TeeNet/MiClub appears to be out of date. |
| The Cut (Dawesville) | [Chronogolf club page](https://www.chronogolf.com/club/the-cut-golf-course). Also listed on GolfNow and Golfscape. About 80 km south of the Perth CBD, outside the spec's "Perth only" scope.                                                                                                                                            |

Lightspeed publishes a [Partner API](https://partner-api.docs.chronogolf.com/) that lets approved partners read a club's tee sheet and pricing. That is an official, permitted feed, the route SPEC section 6 prefers. **Recommendation: apply for partner access rather than reading Chronogolf pages.** Both courses are seeded but switched off until then.

## MiClub

### What it is

MiClub is a Perth-based company providing management software to 500+ golf venues in five countries, acquired by Northstar Technologies in October 2021 ([Golf Industry Central](https://www.golfindustrycentral.com.au/?p=47510)). Being local is useful: the owner can approach it in person.

### Public calendar

Clubs expose a public calendar at a common path, on either a `<club>.miclub.com.au` subdomain or the club's own domain:

```
https://<host>/guests/bookings/ViewPublicCalendar.msp?booking_resource_id=3000000
```

- `booking_resource_id=3000000` is the default at most clubs, but it varies (Moore Park uses `3050007`, Woolooware has a cart resource `3357726`). Multi-course venues probably have one resource per course. ([search results listing many clubs](https://sandhurst.miclub.com.au/guests/bookings/ViewPublicCalendar.msp?booking_resource_id=3000000), [Moore Park](https://moorepark.miclub.com.au/guests/bookings/ViewPublicCalendar.msp?booking_resource_id=3050007&mobile=true), [Woolooware](https://woolooware.miclub.com.au/guests/bookings/ViewPublicCalendar.msp?bookingResourceId=3357726))
- Both spellings `booking_resource_id` and `bookingResourceId` appear in indexed URLs. **Unverified** which the current version uses.
- A `mobile=true` view exists.
- Indexed URLs contain `selectedDate=${altDateTimeStr}`, an unrendered template variable. This suggests the calendar accepts a `selectedDate` parameter, which would allow a date deep link. **Unverified**, including the date format. ([Collier Park](https://bookings.collierparkgolf.com.au/guests/bookings/ViewPublicCalendar.msp?mobile=true&selectedDate=%24%7BaltDateTimeStr%7D), [Wembley](https://www.wembleygolf.com.au/guests/bookings/ViewPublicCalendar.msp?mobile=true&selectedDate=%24%7BaltDateTimeStr%7D))
- No evidence of a time-of-day or group-size parameter.

### Booking flow (affects the "3 taps" goal)

- Wembley: "To book golf online, you must first register your details with Wembley Golf Course." ([Wembley online bookings](https://www.wembleygolf.com.au/cms/golf/online-bookings/))
- Perth Golf Network: public golfers register as a public member first, then book. ([PGN public bookings](https://perthgolfnetwork.miclub.com.au/cms/public-bookings/))
- Collier Park and Whaleback require full payment when booking. ([Collier Park booking terms PDF](https://collierparkgolf.com.au/wp-content/uploads/2025/06/Golf-Terms-Conditions-Feb-25-1.pdf), [Whaleback](https://www.whalebackgolfcourse.com.au/cms/bookings/book-a-tee-time/))

So a first-time BookOn user lands on a club registration form, not a booking screen. BookOn's three taps can get them to the club; the club's own flow then adds steps we cannot remove.

### Timesheet release times

Each club releases times on its own schedule. This matters for alerts and polling.

| Course       | Release rule                        | Source                                                                                                                                                  |
| ------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wembley      | 10 days ahead, from 6 am            | [Wembley calendar](https://www.wembleygolf.com.au/guests/bookings/ViewPublicCalendar.msp)                                                               |
| Whaleback    | Up to 10 days ahead, refreshed 6 am | [Whaleback](https://www.whalebackgolfcourse.com.au/cms/bookings/book-a-tee-time/)                                                                       |
| Collier Park | 8 days ahead, from 12 pm            | [Collier Park booking](https://bookings.collierparkgolf.com.au/guests/bookings/ViewPublicCalendar.msp?mobile=true&selectedDate=%24%7BaltDateTimeStr%7D) |

The spec's 14-day search range is longer than any window found. Searching beyond a club's window should say "Times open on <date>" rather than "No times".

### Attitude to automation

- MiClub introduced **Lottery Booking** in response to "a significant increase in automated booking systems ('bots') attempting to secure tee times the instant timesheets open." Golfers are randomly queued when a sheet opens. ([MiClub Help: Lottery Bookings FAQ](https://help.miclub.com.au/support/solutions/articles/14000131068-lottery-bookings-frequently-asked-questions))
- No MiClub website terms of use with a robots or scraping clause were found. The MiClub terms page that was found covers the MiScore app. ([MiClub terms](https://www.miclub.com.au/cms/terms-and-conditions-miscore-app-club/))
- Each club also has its own site terms and booking terms. Not read.

BookOn reads availability and does not book, so it is not a booking bot. But to MiClub, polling traffic from a third party looks much like the bots it is fighting, and alerts timed to sheet release are close to what they are trying to stop. **Treat this as the biggest risk in the spec.**

### TeeNet: MiClub's own aggregator

[TeeNet](https://www.teenet.com.au/teenet) is MiClub's free tee time search engine:

- "Displays the availability and pricing of public tee times from participating MiClub client clubs."
- Golfers are redirected to the club's site to book, which is the same model as BookOn.
- Clubs on MiClub's public timesheet module are "automatically promoted on TeeNet through a live feed", with "no charge or commission". ([MiClub: promote tee times on two channels](https://www.miclub.com.au/cms/promote-tee-times-two-channels/))
- Its WA list includes Carramar, Collier Park, Marangaroo and Whaleback. ([TeeNet club page](https://teenet.com.au/teenet?clubId=20809))

Two consequences:

1. **TeeNet is a direct, free competitor** for every MiClub course. BookOn must beat it on design, alerts and covering Quick18 courses too.
2. **The live feed already exists.** Asking MiClub for read access to the same feed is the cleanest path to permitted data.

## Quick18 (Sagacity Golf)

### What it is

Quick18 is a tee sheet product now branded as Sagacity Golf ([Sagacity: Quick 18 integration](https://www.sagacitygolf.com/resources/integrations/quick-18/)). Sagacity sells an integrations programme, but no public tee time API was found.

### Public tee time page

```
https://<sub>.quick18.com/teetimes/searchmatrix?teedate=YYYYMMDD
```

Many indexed URLs use this exact form, for example [Hamersley](https://hamersley.quick18.com/teetimes/searchmatrix?teedate=20240426), [Point Walter](https://pointwaltergoannagolf.quick18.com/teetimes/searchmatrix?teedate=20230226) and [The Springs](https://springs.quick18.com/teetimes/searchmatrix?teedate=20251123). Snippets say the page lists times, player counts and prices per person, with 9 and 18-hole options.

- **Date deep link: likely supported** via `teedate=YYYYMMDD`. Not documented by Sagacity, inferred from URLs.
- No evidence of a time or group-size parameter.
- Whether booking needs an account: **Unverified.**

### Terms

- Sagacity's [General Terms and Conditions](https://www.sagacitygolf.com/general-terms-and-conditions/) restrict automated extraction of _Sagacity AI outputs_ for training models or building a competing service. That clause is about their AI product, not the tee sheet, but it shows the direction of their thinking.
- The [Terms of Service](https://www.sagacitygolf.com/terms-of-service/) cover the "whole suite of software products including... electronic tee sheet". The section on automated access, if any, was not visible. **Must be read in full.**

## Perth public courses found (Milestone 0)

Kept for the record. **The current list is [`courses.md`](./courses.md).**

| Course                | Suburb             | Platform                                          | Public calendar URL                                                                            | Notes                                                                               |
| --------------------- | ------------------ | ------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Wembley (Old, Tuart)  | Wembley Downs      | MiClub                                            | `www.wembleygolf.com.au/guests/bookings/ViewPublicCalendar.msp` (also `wembley.miclub.com.au`) | 36 holes over two courses. No bookings during school holidays. Registration needed. |
| Collier Park          | Como               | MiClub (club domain)                              | `bookings.collierparkgolf.com.au/guests/bookings/ViewPublicCalendar.msp`                       | 27 holes. Demand-based pricing. Prepaid. Has its own app.                           |
| Whaleback             | Parkwood           | MiClub                                            | `www.whalebackgolfcourse.com.au/guests/bookings/ViewPublicCalendar.msp`                        | Weekday 18 holes $39 adult (2026/27). Prepaid.                                      |
| Carramar              | Carramar           | MiClub                                            | `www.carramargolf.com.au/guests/bookings/ViewPublicCalendar.msp?booking_resource_id=3000000`   | "Strictly no walk-ins."                                                             |
| Maylands and Embleton | Maylands, Embleton | MiClub                                            | `maylandsembleton.miclub.com.au`                                                               | Shared booking site. Embleton is 9 holes.                                           |
| Marangaroo            | Marangaroo         | **Chronogolf** (see above)                        | `www.chronogolf.com/club/marangaroo-golf-course`                                               | Earlier TeeNet listing appears out of date.                                         |
| Hamersley             | Karrinyup          | Quick18                                           | `hamersley.quick18.com/teetimes/searchmatrix`                                                  |                                                                                     |
| Point Walter          | Bicton             | **Chronogolf** (moved from Quick18, October 2026) | `www.chronogolf.com/club/point-walter-public-golf-course`                                      | Run by Belgravia Leisure.                                                           |
| The Springs           | Forrestdale        | Quick18                                           | `springs.quick18.com/teetimes/searchmatrix`                                                    |                                                                                     |
| Lake Claremont        | Claremont          | Quick18                                           | `lakeclaremont.quick18.com`                                                                    | 9 holes.                                                                            |

Not yet checked: Altone Park, Fremantle Public, Kwinana, Araluen, Hillview, The Vines, Secret Harbour. Some may use other platforms (for example GolfNow lists some WA courses), which would need a third adapter or the `manual` adapter.

## Other competitors

- **[TeeNet](https://www.teenet.com.au/teenet)**: free, MiClub courses only. See above.
- **[TeeTimeWizard](https://teetimewizard.com/)**: searches tee times across Australia, including [Collier Park](https://teetimewizard.com/golf-courses/western-australia/como/collier-park-golf-course) and [Wembley](https://teetimewizard.com/golf-courses/western-australia/perth/wembley-golf-course). Results need a paid membership.
- **[GolfNow Australia](https://www.golfnow.com.au/tee-times/public-golf-courses-in-perth-western-australia/search)**: lists some Perth courses.
- **[TeeTimeFinder on GitHub](https://github.com/Ay1tsMe/TeeTimeFinder)**: an open-source command-line tool that reads MiClub and Quick18 pages. It shows the data is technically readable. It says nothing about permission.

## Recommendation

1. **Do not build live-fetching adapters yet.** Neither platform is clearly permitted, and MiClub is actively hostile to bot traffic.
2. **Approach MiClub first.** It is Perth-based, covers most of the target courses, and already runs a live feed for TeeNet. Ask for read-only access to public availability for the clubs BookOn lists, under a written agreement.
3. **Approach Sagacity (Quick18)** for API or feed access for Hamersley, Point Walter, The Springs and Lake Claremont.
4. **Approach 3 to 5 launch clubs** for written permission in parallel. A club's permission may not override the platform's terms, so platform permission matters more.
5. **Meanwhile, Milestone 1 can go ahead without touching live sites**: schema, seed data and an adapter that parses fixtures saved by hand from a normal browser, with live fetching switched off until permission arrives. This needs the owner's approval because it builds a parser before permission.

## Open checks for the owner (in a normal browser)

- [ ] Open a MiClub public calendar and a single day's timesheet. Note the exact URL and whether `selectedDate` works, and in what format.
- [ ] Open a Quick18 `searchmatrix` page. Check whether booking needs an account.
- [ ] Read `/robots.txt` on `wembleygolf.com.au`, `bookings.collierparkgolf.com.au`, `hamersley.quick18.com`, `www.teenet.com.au`.
- [ ] Read the [Sagacity Terms of Service](https://www.sagacitygolf.com/terms-of-service/) for any clause on bots or automated access.
- [ ] Read the terms linked from each launch club's booking pages, including the [Collier Park booking terms](https://collierparkgolf.com.au/wp-content/uploads/2025/06/Golf-Terms-Conditions-Feb-25-1.pdf).
- [x] Find Marangaroo's booking page (Chronogolf).
- [ ] Check the unlisted courses above.
- [x] Confirm Wembley's `bookingResourceId` (3000000) and Hamersley's booking window (at least 16 days).
- [ ] Ask Wembley (Town of Cambridge) for permission or a feed, given the CAPTCHA.
- [ ] Add coordinates for the five launch courses (left empty in the seed data).

## Other outside services (Milestone 10, 18 October 2026)

The owner approved weather and Near me on 18 October 2026. Neither is a booking platform; they're read by the worker or a one-off script, never by golfers' searches.

### MET Norway weather (api.met.no)

- **What:** Locationforecast 2.0 (`/weatherapi/locationforecast/2.0/complete`), about 9 days ahead, hourly for the first few days, then 6-hourly.
- **Terms:** free, including commercial use, under CC BY 4.0. Credit them where the weather shows ("Weather from MET Norway", linked). Identify ourselves in the user agent with a contact, don't ask again before the `Expires` time, send `If-Modified-Since`, use at most 4 decimals for locations, keep traffic gentle. See https://api.met.no/doc/TermsOfService.
- **How we use it:** `apps/worker/src/weather.ts`, once per course per forecast update (about hourly), one request a second. Stored in `weather_forecasts`.
- **Why not others:** Open-Meteo's free service is for non-commercial use only. The Bureau of Meteorology has no public feed for businesses without a paid agreement.
- **Checked live 18 October 2026:** all 26 live courses fetched. For Australia MET Norway gives rain amounts but no chance of rain, so the site shows millimetres.

### OpenStreetMap course locations (nominatim.openstreetmap.org)

- **What:** Nominatim search, to find each course's latitude and longitude once.
- **Terms:** light use is allowed (at most one request a second, a user agent that names us, no bulk or repeated geocoding). Data © OpenStreetMap contributors, ODbL. See https://operations.osmfoundation.org/policies/nominatim/.
- **How we use it:** `pnpm courses:locate` (`apps/worker/src/locate.ts`) prints what it finds for a person to check, and saves only with `--save`. Results go in `packages/db/src/course-locations.ts` and the database. Admins can correct any course.
- **Run 18 October 2026:** 21 courses found by name. 8 that the map names differently were found and checked by hand. All 29 are in `course-locations.ts`.

### Coaches' own calendar links (Milestone 16, 20 October 2026)

The owner approved reading calendar links coaches give BookOn on 20 October 2026 ("approve", to "OK to read the calendar links coaches give us"). These aren't booking platforms: each is one coach's own private calendar address, read the way a calendar app reads it.

- **What:** Google Calendar's "secret address in iCal format", iCloud public calendar links and Outlook published calendars (iCalendar files). Only those three services are accepted (`normaliseCalendarUrl` in `packages/adapters/src/calendar`), including after redirects, so a pasted link can never point the worker at another server.
- **How we use it:** the worker reads each link at most every 25 minutes (once a pass) with the BookOnBot user agent, and when the coach saves it or taps Check now. Files over 5 MB are refused. Only start and end times of busy events in the next five weeks are kept; events marked free, cancelled events and BookOn's own lessons are skipped. Parsing uses `ical.js` (Mozilla, MPL 2.0, pinned).
- **Not robots.txt-checked:** like a calendar app, BookOn reads a private address its owner gave it; it doesn't crawl. Tests use hand-written calendar files (`packages/adapters/fixtures/calendar/`).
- **Not checked live yet:** this cloud environment can't reach Google, iCloud or Outlook.

### Stripe (lesson payments, Milestone 15, 19 October 2026)

The owner approved taking lesson payments through Stripe Connect on 19 October 2026 ("Go with your suggestions"). Stripe isn't a booking platform BookOn reads: it's the payment service BookOn calls, with BookOn's own keys.

- **What:** Stripe Connect with Express accounts for coaches (Stripe collects their ID, ABN and bank details; BookOn never sees them), and Stripe Checkout for golfers (card, Apple Pay, Google Pay on Stripe's page; BookOn never sees card numbers). Payments are destination charges: the golfer pays the lesson price plus BookOn's booking fee, the coach's account gets the lesson price, and BookOn keeps the fee. Cards are held at checkout (manual capture) and charged when the coach accepts.
- **Terms:** Stripe's Services Agreement and Connected Account Agreement (coaches accept Stripe's terms during setup). Card fees come out of BookOn's share with destination charges. See https://stripe.com/au/legal and https://stripe.com/au/pricing.
- **How we use it:** `packages/payments` (the official `stripe` library, pinned). Keys: `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`. Webhook at `/api/stripe/webhook`.
- **Not checked live yet:** this cloud environment can't reach api.stripe.com, so tests use hand-written Stripe responses (`packages/payments/fixtures/stripe/`). The owner's Stripe test mode is the first live check.

### Mailchimp (the newsletter, Milestone 27, 26 October 2026)

The owner approved email marketing on 26 October 2026 ("approve the rest"), with newsletters sent from a marketing tool; I suggested Mailchimp. Like Stripe, it's a service BookOn calls with its own key, not a site BookOn reads.

- **What:** BookOn keeps the newsletter list and the proof of each person's consent (`newsletter_subscribers`). The worker copies each sign-up and unsubscribe to one Mailchimp audience. Newsletters are written and sent in Mailchimp. Mailchimp's webhook tells BookOn about unsubscribes, bounces ("cleaned"), sign-ups on Mailchimp's own forms and changed addresses.
- **Terms:** Mailchimp's Standard Terms of Use and Acceptable Use Policy (https://www.intuit.com/legal/terms/en-us/mailchimp/) allow only people who've asked to hear from you, and every campaign needs a physical postal address (a PO box is fine) and Mailchimp's unsubscribe link. The Spam Act 2003 also asks for the sender's details and an unsubscribe that works within 5 working days.
- **How we use it:** `packages/email/src/mailchimp.ts` (Mailchimp Marketing API 3.0, `PUT /lists/{audience}/members/{md5 of email}`). Settings: `MAILCHIMP_API_KEY`, `MAILCHIMP_AUDIENCE_ID`, `MAILCHIMP_WEBHOOK_SECRET`. Webhook at `/api/mailchimp/webhook?key=…`.
- **Not checked live yet:** tests use responses written from Mailchimp's documentation. The owner's Mailchimp account is the first live check.

## Golf simulators and driving ranges (Milestone 11 research, 18 October 2026)

The owner asked for Perth's golf simulators and bookable driving ranges. Venues come from Golf WA's simulator list, news and the venues' own sites. Each venue's booking system was checked for robots.txt rules, terms, and whether free times can be seen without logging in. Nothing below is read by BookOn until the owner approves it.

### Your Golf Booking (yourgolfbooking.com): recommended

- **Venues:** OuttaBounds (North Lake: Simulators, Driving Range, Darts), Albatross Lounge (893 Canning Hwy, Mount Pleasant: Book a Bay), Elevate Golf Lounge (249 Oxford St, Leederville: TrackMan bays), Lights Out Golf (Wangara: golf sessions). Its images are hosted by TrackMan, so other TrackMan venues may join it.
- **robots.txt:** `User-agent: * / Disallow:` (everything allowed) on yourgolfbooking.com. The API host has no robots.txt (404).
- **Terms:** the customer terms (`/legal/terms/current`) say nothing about automated access.
- **What's public without logging in:**
  - Each bookable group's page (`/venues/<venue>/booking/<group>`, e.g. OuttaBounds `/booking/simulators`) carries the venue's details, bays, slot length (30 minutes), maximum players (6), how far ahead you can book (4 weeks), opening rules and prices ($15 per adult per 30 minutes at OuttaBounds).
  - `api.yourgolfbooking.com/venue/<venue>/bookings/public?start_gte=…&start_lte=…` lists the day's bookings as bay, start and end only, with no customer details. The booking page itself uses this to show free bays.
  - Other addresses (bay groups, ranges, bay options) need a login, and aren't used.
- **How BookOn would read it:** each venue's group page about once a day (bays, hours, prices), and the public bookings once per check per day. Free bays for each start time come from the bookable bays, minus those booked, inside opening hours. The first live checks are compared with what the booking page shows.

- **Owner approval (18 October 2026):** "Yes read your golf bookings. Ignore any without live times. Ignore big swing for now." BookOn reads OuttaBounds (Simulators, and Driving Range bays), Albatross Lounge (sim bays 1 and 2 only, not darts or pool), Elevate Golf Lounge and Lights Out Golf, through `PoliteHttpClient`, as `BookOnBot` (and obeying `Claude-User` rules when Claude runs it). Each check reads the group page once and the public bookings once per open day, up to 14 days ahead.
- **First live check (18 October 2026):** Lights Out Golf for Monday 19 October matched its booking page exactly, bay by bay (every taken half hour on all four bays). An earlier check of OuttaBounds' simulators at 9 am Monday also matched (SIM 1 and SIM 9 taken).
- **How it's read, in detail:** see `packages/adapters/src/ygb/index.ts`. Only options a member of the public can book count (not admin-only, hidden, perk or member options, coaching, darts or pool). Prices are shown only when the price for the bay doesn't depend on the number of players.

### Big Swing Golf (bigswinggolf.com.au): recommended, not approved yet

- **Venues:** Booragoon (Unit 2/80 Norma Rd) and Mandurah. Both booking pages exist (`/booking/booragoon`, `/booking/mandurah`).
- **robots.txt:** `User-agent: *` with nothing disallowed.
- **Terms:** `/terms-and-conditions` loads its text some other way, so it couldn't be read; the privacy policy is a PDF. To check again before switching on.
- **What's public:** the booking page includes 7 days of availability for every simulator, every 15 minutes (open, busy, and how long it stays free), plus the slot length, maximum players (4) and peak times. **One page load per venue covers the week.**

### X-Golf (xgolf.com.au): listing only

- **Venues (WA):** Balcatta, Joondalup, Morley, Nedlands, Rockingham, Bunbury.
- **robots.txt disallows every venue's "book now" page** (`/locations/<venue>/<venue>-book-now/`) for all robots. BookOn won't read them. Venues are listed with their details and a link to book.

### Pin High (Osborne Park): listing only for now

- Books through GymMaster (`pinhigh.gymmasteronline.com`), a gym membership system that usually needs a login. Not checked further.

### Hamersley Driving Range (Karrinyup): Quick18, already approved

- 30 Inrange bays, booked by 30, 60 or 90 minutes on hamersley.quick18.com. Quick18 blocks `Claude-User`, so the owner runs its first check.

### Checked after the owner allowed more sites (18 October 2026, later)

- **Golf WA's simulator list** (golfwa.org.au/get-into-golf/golf-simulators) matches the venues above. It adds three outside Perth: Bunbury SWISH (TrackMan and an indoor range), Hole 19 Dunsborough and Karratha Indoor Golf.
- **Always Golf** (East Perth, Fremantle): books through its own Wix site (`/book-online`). Listing only for now.
- **Perth Golf Centre** (WA Golf Club, Yokine): simulator hire is booked through Timely (`bookings.gettimely.com`), an appointment system. Listing only.
- **Albatross Lounge**'s own site is on Square Online and links to Your Golf Booking for bays, as above.
- **Not reached:** Sim Golf Club (site doesn't answer) and Anytime Fairway (Jandakot). Golf WA links to Anytime Fairway through bit.ly, which the cloud environment can't open.
