# Milestone 10 review: the rest of the site on phones

18 October 2026. The owner approved the plan, and asked for these on top:

- Course areas, as categories on the Courses page and the search.
- Near me on the search.
- Weather, definitely.

The tee time search itself works as before. Hardening and launch move to Milestone 11 (recorded in SPEC.md).

**Update, later on 18 October:** once you opened up network access, I looked up every course's location on OpenStreetMap and fetched live forecasts from MET Norway. See "Locations and live weather" below.

**About the screenshots:**

- The Near me results, Courses with Near me and course page screenshots use **real locations, real weather and real tee times**.
- The "with club details" course page uses a **sample club profile and price list**, added to my local test database and removed afterwards.

## What was done

### Menu bar on phones

- A bar along the bottom with **Find**, **Courses**, **Alerts** and **Account**, like an app. [Screenshot](./m10/m10-near-me-results.png).
- It sits above the iPhone home bar, and the stale-results bar moves up to clear it.
- Desktop keeps its header. Admin and club pages keep their own menus.

### The search

- **Quick days:** Today, Tomorrow and the coming Sat and Sun, one tap each, above the date picker.
- **Where:** a row of areas (Anywhere, North, West & Fremantle, East & Hills, South, Rockingham, Mandurah & Peel, South West, Regional WA).
  - Picking one searches that area's courses.
  - Ticking courses one by one still works, and wins over the area.
  - Alerts and shares keep the area.
- **Near me:** tap it and the phone asks once for its location.
  - Results go closest first, with "3.2 km away" on each course.
  - "Within 10 / 20 / 40 km" leaves out courses further away.
  - The location is rounded to about a kilometre and used for that search only. It isn't part of alerts, shares, search logs or reports.
- **Weather** on each course, for the search's time window: "🌦️ 26° · 56% rain · 22 km/h wind". Longer searches show it beside each day.

### Home page (phones)

Below the search, in this order. [Screenshot](./m10/m10-home-phone.png).

- **Recent searches:** the last five on this phone, one tap to run again. They're kept on the phone only, and past days drop off.
- **My courses:** if you're signed in, your starred courses with their next free time.
- **Free soon:** the next free time at each course today and tomorrow, with Book buttons. Desktop shows it under the banner too.
- **How BookOn works:** three short steps.

### Courses page

[Screenshot](./m10/m10-courses-phone.png), [with Near me](./m10/m10-courses-near-me.png).

- On phones: a compact list with a small picture, suburb, holes and the **next free time**.
- A **search box**, **area buttons** and **Near me**, which sorts by distance. Your location stays in the browser.
- Grouped by area unless you're searching or using Near me.
- Desktop keeps the picture grid.

### Course pages

[Screenshot](./m10/m10-course-phone.png), [with club details](./m10/m10-course-with-club-details.png), [desktop](./m10/m10-course-desktop.png).

- **Share** and **star** beside the name.
- **Next free times** today and tomorrow, with Book buttons.
- **This week** with each day's count of free times and the daytime weather.
- From the club's own details, once they've filled them in through club sign-up or their login:
  - description;
  - **price list** (green fees, carts, club hire, deals), grouped, with GST noted;
  - facilities;
  - dress code and cancellations;
  - **Call** (tap to ring) and the address.
- **Directions** opens Maps.
- **Tell me when a time opens up** sets a week-long alert for this course.
- **Courses nearby:** the three closest, or others in the same area until locations are in.

### My account

- Tabs for **My courses**, **Alerts**, **Looked at** and **Settings**, instead of one long page. [Screenshot](./m10/m10-account-phone.png).
- The Alerts tab in the menu bar opens Alerts straight away.
- Alerts can be paused or deleted there, as before.

### Areas, locations and weather behind the scenes

- **Areas** are stored on each course, starting with the areas you approved. Admins can change them on the course's admin page. New courses from club sign-up show under "Other" until given one.
- **Locations:**
  - `pnpm courses:locate` looks each course up on OpenStreetMap, one a second, and prints what it found with a map link.
  - `-- --save` saves them and writes `packages/db/src/course-locations.ts`, so new databases get them too.
  - Admins can correct any course (Latitude and Longitude on its admin page).
- **Weather:**
  - The worker asks MET Norway for each located course's forecast, no sooner than MET Norway says it changes (about hourly).
  - It sends "has it changed?" headers and keeps going if one fails.
  - `pnpm weather` does it once.
  - Golfers' pages only read what's saved, so they never wait on it. "Weather from MET Norway" is credited wherever it shows.
- **Loading placeholders** on the courses, course and account pages.

## Locations and live weather

**Locations:** all 29 courses, including the three switched off, are in `packages/db/src/course-locations.ts`. New databases get them from the seed.

- 21 courses were found by `pnpm courses:locate` under their own names.
- 8 are mapped under different names, so I found and checked those by hand: Busselton, Dunsborough Lakes, Lake Claremont ("Claremont Golf Course", beside the lake), Secret Harbour, Capel (Stratham), Hamersley (Marmion Avenue, Trigg), Hartfield ("Hartfield Country Club") and Rockingham (Cooloongup).
- Every match is an OpenStreetMap golf course with the right name and street. The file links each one.
- The lookup used to fall back to "any golf course in that suburb". That matched three test clubs to Royal Perth Golf Club, so I removed it. A course it can't find is now reported for a person to set.

**Weather:**

- All 26 live courses got a forecast: hourly for about 2½ days, then 6-hourly out to 9 days.
- A second run straight after asked for nothing, because it waits for MET Norway's "expires" time.
- **MET Norway doesn't give a chance of rain for Australia**, only expected millimetres. So the site shows "dry" or "2 mm rain" rather than a percentage.
- On a Near me search from the Perth CBD for Monday morning, Maylands (3.9 km) showed "☁️ 18° · dry · 6 km/h wind".

## Checked

| Check                      | Result                                                                                                                                                                                                                            |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser, on a phone screen | Every step listed below passed, with no console errors and nothing wider than the screen.                                                                                                                                         |
| Desktop                    | The menu bar is hidden; the home page and course pages work.                                                                                                                                                                      |
| Tests                      | 232 passing. New tests cover areas, distances, Near me, quick days, area searches, forecast reading and summaries, the worker's weather refresh, the location lookup helpers, next free times, and admin area and location edits. |
| All checks                 | `format:check`, `lint`, `typecheck`, `test` and `build` pass.                                                                                                                                                                     |

The phone run went through:

1. Tapped **Tomorrow**, **Near me** and **Within 20 km**, and searched. The results were 378 times at 7 courses, closest first: Maylands 3.2 km, Collier Park 6.4 km, Point Walter 9.7 km, Whaleback 12 km. Each showed its weather.
2. Searched the **South**: Whaleback, Kwinana and Collier Park.
3. Back home, **Recent searches** listed both, and **Free soon** listed the next times.
4. Courses tab: "park" found 2 courses and **North** 4. **Near me** put Maylands first.
5. Opened Collier Park's page: next times, week, courses nearby.
6. Signed in, starred Collier Park, and saw it under **My courses** on the home page with its next time. The **Alerts** tab opened the account's Alerts.
7. The phone page stayed 390 px wide (no sideways scrolling).

### Fixed while checking

- The area row stretched the page sideways on phones, because hidden radio buttons escaped the scrolling row. They now stay inside it.
- Times from clubs that start groups off two tees at once gave duplicate list keys on the course page. Fixed.
- Searches for an area and alerts made from them now keep the area. Before, an alert from an area search would have covered every course.
- `pnpm --filter @bookon/worker record` saved to the wrong folder on Windows. Fixed while in that file.

## Decisions I made

1. **Weather shows the worst sky in your window** (rain beats sunshine), the warmest temperature, and the highest chance of rain and wind. That way nobody is caught out.
2. **Rain in millimetres.** MET Norway only gives a chance of rain for some countries, not Australia, so it reads "dry" or "4 mm rain". If it ever sends a chance, that shows instead.
3. **Free soon** uses 2 players and leaves out times starting within 15 minutes.
4. **Near me only appears once courses have locations,** so it's never a button that does nothing.
5. **Courses without an area** show under "Other", so a newly approved club is never hidden.

## Open issues

1. **Share pictures don't include the weather.** I left that out to keep the picture simple; say if you'd like it.
2. **The seeded clubs have no details or prices yet.** Their pages fill in once each club adds them, or an admin adds a club contact who does.

## How to demo (on your PC)

```powershell
git pull
pnpm install
pnpm db:dev                    # window 1, keep running
pnpm dev:worker                # window 2, keep running
pnpm dev                       # window 3
```

Locations come with the update, and the worker fetches the weather when it starts (or run `pnpm weather`).

Then open http://localhost:3000 on a narrow window or your phone (`http://<your PC's name>:3000`, same wifi). Try the menu bar, quick days, the Where row and Near me, the Courses tab, a course page and My account. On a phone, Near me needs the site on https (or localhost) to ask for your location, so it fully works once hosted.
