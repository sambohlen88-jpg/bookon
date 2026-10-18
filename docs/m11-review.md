# Milestone 11 review: golf sims and driving ranges

18 October 2026. You asked for two things:

- No "add to home screen" prompt on desktop.
- Perth's golf sims and driving ranges.

After the research you said: "Yes read your golf bookings. Ignore any without live times. Ignore big swing for now". So BookOn now reads the four Your Golf Booking venues, and hardening and launch move to Milestone 12 (recorded in SPEC.md, CLAUDE.md and the launch checklist).

**About the screenshots:** they use **real, live free bays** read from Your Golf Booking on the evening of Sunday 18 October, for Monday 19 October. The golf course times on my test database were older than 90 minutes, so golf searches there showed "We can't show times right now", which is correct.

## What was done

### Add to home screen on phones only

The install prompt now only shows on touch screens. Desktop never sees it.

### Five new venues

| Venue                     | Suburb         | Area             | What BookOn reads                         |
| ------------------------- | -------------- | ---------------- | ----------------------------------------- |
| OuttaBounds Simulators    | North Lake     | South            | 9 sim bays, up to 6 players               |
| OuttaBounds Driving Range | North Lake     | South            | 18 range bays, up to 6 players            |
| Albatross Lounge          | Mount Pleasant | South            | 2 sim bays (not their darts or pool)      |
| Elevate Golf Lounge       | Leederville    | West & Fremantle | 4 TrackMan bays                           |
| Lights Out Golf           | Wangara        | North            | 4 sim bays, up to 4 players, 7 am to 9 pm |

- Locations are from OpenStreetMap, so Near me and "nearby" work for them. The venues' own addresses are on their Your Golf Booking pages.
- The driving range gets the weather. Simulators are indoors, so they don't.
- Existing databases get the venues when the worker starts (a migration adds them). Nothing you've changed in admin is touched.

### Searching for a bay

[Phone](./m11/m11-home-sims-phone.png), [results](./m11/m11-bays-results-phone.png), [desktop](./m11/m11-bays-desktop.png).

- The search has a **Golf courses | Sims & ranges** switch at the top.
- Sims & ranges swaps **Holes** for **How long**: 30 min, 1 hr, 1½ hr or 2 hr.
- Players go up to 6.
- Latest goes to 10 pm.
- The button reads **Find a bay**.
- It works without JavaScript too.
- Results list each start time once: "4 bays free · Up to 4 players · $65 an hour", with a Book button that opens the venue's booking page.
- A bay only counts if it's free for the whole session you picked.
- Areas, Near me, quick days and "My courses only" work as for golf.

### Pages

- **Venue pages** ([sim](./m11/m11-venue-page-phone.png), [range](./m11/m11-range-page-phone.png)):
  - Next free bays and the week ahead.
  - "Sims & ranges nearby".
  - See free bays, the venue's booking page, directions and website.
  - "Golf simulator" or "Driving range" instead of holes.
- **Courses page** ([screenshot](./m11/m11-courses-sims-phone.png)): a "Golf sims & driving ranges" group after the areas. Each shows "Golf sim" or "Driving range" and its next free time.
- **Home page:**
  - Free soon and the course counts stay golf only.
  - The desktop banner adds "plus 5 golf sims and ranges".
  - A starred venue shows under My courses with its next free bay.
- **Drawings:** sims get a drawing of a golf scene on a simulator screen, with a hitting mat. The range gets distance boards and a row of covered bays.

### Kept to golf, on purpose

- **Alerts and sharing** are for tee times only. The buttons don't show on bay searches.
- **Golf searches never list sims or ranges**, so alerts you already have can't start sending simulator times.

## Checked

| Check                      | Result                                                                                                                                                                                                                                                          |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Live read                  | All five venues read cleanly for 3 days: 329 sim and 728 range bay starts at OuttaBounds, 20 at Albatross, 117 at Elevate and 101 at Lights Out.                                                                                                                |
| Against the booking page   | Lights Out on Monday 19 October matched its own booking page exactly. All four bays agreed on every taken half hour ([the booking page](./m11/m11-lights-out-live-booking-page.png)). OuttaBounds' sims matched at 9 am Monday (SIM 1 and SIM 9 taken).         |
| Browser, phone and desktop | The switch, a bay search, venue pages and the courses page all worked. There were no console errors, and the page stayed 390 px wide on phones. A golf search showed no venues.                                                                                 |
| Database upgrade           | My test database from Milestone 10 upgraded cleanly and picked up the venues.                                                                                                                                                                                   |
| Tests                      | 271 passing. New tests cover: <ul><li>reading the saved Your Golf Booking pages: hours, rules, bays, prices, and refusing pages that aren't right</li><li>bay searches</li><li>the search form switch</li><li>the venue seed</li><li>the new drawings</li></ul> |
| All checks                 | `format:check`, `lint`, `typecheck`, `test` and `build` pass.                                                                                                                                                                                                   |

### Fixed while checking

- **Lights Out's bay 2 showed as taken all day when it wasn't.** The venue gives bay 2 "open 5 pm to 9 pm" settings on weekdays. I'd read those as "only open then", but the booking page offers it from 7 am. BookOn now follows the booking page.
- **Prices quoted the single-player deal.** OuttaBounds read "$25 an hour", which is for 1 player only. It now shows the group price ($40 an hour this month, 2 to 6 players), and only falls back to a one-player price when there's nothing else.
- **Options that aren't public bay hire are now ignored:** member vouchers, coaching, and darts and pool. Before, they could have made a bay look bookable when the public can't book it.

## Decisions I made

1. **One row per start time, not per bay.** A golfer picks a time, then any bay, so "4 bays free at 7 pm" is easier to read than four identical rows.
2. **Price for an hour, when it's fixed.**
   - Lights Out and OuttaBounds' sims show "$65 an hour" and "$40 an hour".
   - Elevate, Albatross and the OuttaBounds range charge per player, so they show "Price at venue" rather than a guess.
3. **We read 14 days ahead,** the longest search, though venues open 2 to 6 weeks ahead.
4. **Elevate (Leederville) is in West & Fremantle.** It's between Wembley (North) and Lake Claremont (West). Change it in admin if you'd rather it sat under North.
5. **The search defaults to Golf courses,** so nothing changes for golfers who never tap the switch.

## Open issues

1. **Purchase-option rules aren't applied.** Some venues limit who can book at certain times. For example, OuttaBounds' range may not take single players on weekend evenings. BookOn shows the bay as free, and the venue's page has the final say.
2. **Group packages count as bookable.** A free bay that's only bookable as a package would still show. In practice the bay really is free.
3. **Each check reads about a 1 MB page per venue,** as the venue details come with the page. It's one page per check, plus a small bookings list per day, so it's gentle, but it could be cached for the day later.
4. **The Hamersley range** (Quick18, 30 bays) isn't added. Quick18 blocks me, so it needs you to run it. Say if you want it.
5. **Big Swing, X-Golf, Pin High, Always Golf and Perth Golf Centre** aren't included, as you asked. X-Golf's robots.txt blocks its booking pages, so it's on the launch checklist as a "ask for a feed" item.
6. **Alerts and sharing for bays** could come later if golfers ask.

## How to demo (on your PC)

```powershell
git pull
pnpm install
pnpm db:dev                    # window 1, keep running
pnpm dev:worker                # window 2, keep running
pnpm dev                       # window 3
```

When the worker starts, it adds the five venues and then checks them with everything else. Look for lines like `[worker] lights-out-golf: ok` in its window.

Then open http://localhost:3000 and:

1. Tap **Sims & ranges** on the search.
2. Pick Tomorrow, 1 hr, then **Find a bay**.
3. Tap Book on a time. It opens the venue's Your Golf Booking page, where you pick the bay.
4. Try the **Courses** tab, and scroll to "Golf sims & driving ranges".
5. Open a venue page.
6. On desktop, check there's no "add to home screen" prompt.
