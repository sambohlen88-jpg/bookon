# Milestone 17 review: tee sheets on course pages

20 October 2026. You asked for a full tee sheet on each course page, like MiClub's but easier to use, and for the desktop search panel's button to stay in view. You then asked that **only times with room show**, to cut down scrolling.

- Weekend, public holiday and school holiday rates, and group sessions, move to **Milestone 18**.
- Launch moves to **Milestone 19** (recorded in SPEC.md, CLAUDE.md and the launch checklist).

**About the screenshots:** they're **live data**, from checks of Collier Park, Whaleback and Lights Out Golf on Tuesday 20 October.

## What was done

### Tee sheet on every course page

[Collier Park on desktop](./m17/m17-collier-desk.png), [filtered](./m17/m17-collier-filtered-desk.png), [Whaleback on a phone](./m17/m17-whaleback-phone.png)

- **Day strip:** today and the next 13 days. Each day shows how many times are free, "Not out yet" for days the club hasn't released, or "Not checked". The sheet opens on today, or the first day with free times.
- **Filters**, each one tap:
  - **Players:** 1 to 4 (only times with room for your group show)
  - **Holes:** any, 18 or 9
  - **Course:** when a club runs more than one layout (Collier Park shows Island, Lake, Pines and its combinations)
  - **When:** before 7 am, 7 to 10 am, 10 am to 1 pm, 1 to 4 pm, 4 pm on
- On a phone, each row of filters scrolls sideways rather than wrapping.
- **Times grouped by hour.** Each hour's heading stays at the top while you scroll its times, and shows that hour's weather (temperature, wind, rain).
- **Each time shows:**
  - its four player spots (filled for taken, open for free) and how many are free
  - holes and layout
  - the green fee
  - **Book**, which opens the club's page at that day, tracked like other Book taps
- **Only times with room show**, as you asked. Full times, and the members' and competition rows on the club's sheet, are left out.
- "Checked 2 min ago" shows how fresh it is, as on search.
- It replaces the old "Next free times" and "This week" sections, which the day strip now covers.

### Free bays at sims and ranges

[Desktop](./m17/m17-lights-out-desk.png), [phone](./m17/m17-lights-out-phone.png)

- Instead of a tee sheet, a grid: **start times down, bays across.** Each free bay is a **Free** button, and booked bays show a dot.
- Filters for players, how long (30 minutes to 2 hours) and time of day.
- Only start times with a free bay show.

### Search panel on desktop

[Screenshot](./m17/m17-search-panel.png)

When the search panel is taller than the window, it scrolls inside itself, with **Find tee times / Find a bay** pinned at its bottom. This went out earlier today.

## Checked

| Check             | Result                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Live data         | <ul><li>Collier Park, Wednesday: 124 free times, narrowed to 14 for 3 players between 7 and 10 am.</li><li>Its course tabs came straight from the club's sheet.</li><li>Book on 7:12 am carried that exact time.</li><li>Days from 28 October showed "Not out yet", as Collier Park releases about a week ahead.</li><li>Lights Out's grid matched the free bays that search shows.</li></ul> |
| Phone and desktop | No page errors. The day strip and filter rows scroll sideways on a phone.                                                                                                                                                                                                                                                                                                                     |
| Tests             | 380 passing (9 new). They cover reading and keeping the filters, the day strip (counts, not released, not checked), which day opens first, grouping by hour, the course and time-of-day filters, the player spots, the weather for each hour, and bay order.                                                                                                                                  |
| All checks        | `format:check`, `lint`, `typecheck`, `test` and `build` pass.                                                                                                                                                                                                                                                                                                                                 |

### Fixed while checking

- **The search panel button** first sat below the window at the top of the page. The panel's height now allows for the site header.
- **Results showed through under the pinned button**, because of the panel's padding. The button strip now covers it.
- **On phones, the filter rows wrapped untidily**, with the "6" player button and "2 hr" dropping to a second line. They now stay on one line and scroll sideways.

## Decisions I made

1. **No change to what BookOn reads from clubs.** Since only times with room show, the tee sheet uses the free times BookOn already stores. Clubs see no extra requests.
2. **Players starts at 1** on the tee sheet, so it shows every time with any room. Pick 2 to 4 to narrow it to your group. Sims start at 2, as on search.
3. **A course filter that doesn't exist that day** (say, a layout not running) shows all times rather than none.
4. **The time-of-day bands are the same as Reports.** They double as a quick way to jump down a long day.

## Open issues

1. **Hamersley (Quick18)** only fills in when you run the worker, as I can't read Quick18.
2. **Clubs that don't show prices** say "Price at club", as on search.
3. **A tee sheet is only as fresh as the last check** (every 30 minutes while the worker runs). If a time has just gone, the club's page will say so when the golfer taps Book.

## How to demo (on your Mac)

```bash
cd ~/bookon
git pull
pnpm install
pnpm db:dev                                      # window 1, keep running
caffeinate -i pnpm dev:worker                    # window 2, keep running
BOOKON_ADMIN_EMAIL=<your email> pnpm dev         # window 3
```

Once the worker has done a pass (a few minutes), open:

- http://localhost:3000/courses/collier-park. Try tomorrow, 3 players, "7 to 10 am", and a course tab.
- http://localhost:3000/courses/lights-out-golf for the bay grid.
- Any course on a phone-sized window.
