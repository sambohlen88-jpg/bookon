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

These were saved from a browser after scripts ran, so the raw server HTML could differ. The first live run should use `pnpm --filter @bookon/worker record --course <slug>` to save raw pages, and the fixtures should be replaced with those.

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

## Perth public courses found

| Course                | Suburb             | Platform                   | Public calendar URL                                                                            | Notes                                                                               |
| --------------------- | ------------------ | -------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Wembley (Old, Tuart)  | Wembley Downs      | MiClub                     | `www.wembleygolf.com.au/guests/bookings/ViewPublicCalendar.msp` (also `wembley.miclub.com.au`) | 36 holes over two courses. No bookings during school holidays. Registration needed. |
| Collier Park          | Como               | MiClub (club domain)       | `bookings.collierparkgolf.com.au/guests/bookings/ViewPublicCalendar.msp`                       | 27 holes. Demand-based pricing. Prepaid. Has its own app.                           |
| Whaleback             | Parkwood           | MiClub                     | `www.whalebackgolfcourse.com.au/guests/bookings/ViewPublicCalendar.msp`                        | Weekday 18 holes $39 adult (2026/27). Prepaid.                                      |
| Carramar              | Carramar           | MiClub                     | `www.carramargolf.com.au/guests/bookings/ViewPublicCalendar.msp?booking_resource_id=3000000`   | "Strictly no walk-ins."                                                             |
| Maylands and Embleton | Maylands, Embleton | MiClub                     | `maylandsembleton.miclub.com.au`                                                               | Shared booking site. Embleton is 9 holes.                                           |
| Marangaroo            | Marangaroo         | **Chronogolf** (see above) | `www.chronogolf.com/club/marangaroo-golf-course`                                               | Earlier TeeNet listing appears out of date.                                         |
| Hamersley             | Karrinyup          | Quick18                    | `hamersley.quick18.com/teetimes/searchmatrix`                                                  |                                                                                     |
| Point Walter          | Bicton             | Quick18                    | `pointwaltergoannagolf.quick18.com/teetimes/searchmatrix`                                      |                                                                                     |
| The Springs           | Forrestdale        | Quick18                    | `springs.quick18.com/teetimes/searchmatrix`                                                    |                                                                                     |
| Lake Claremont        | Claremont          | Quick18                    | `lakeclaremont.quick18.com`                                                                    | 9 holes.                                                                            |

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
- [ ] Confirm Wembley's `bookingResourceId` and Hamersley's booking window.
- [ ] Add coordinates for the five launch courses (left empty in the seed data).
