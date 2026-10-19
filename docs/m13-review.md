# Milestone 13 review: unbooked tee times in Reports

19 October 2026. You asked for the number of tee times that didn't get booked, for every course, to help with pitches. You chose golf courses only (not sims or ranges) and admins only. Hardening and launch move to Milestone 14 (recorded in SPEC.md, CLAUDE.md and the launch checklist).

**About the screenshots:** they show **real numbers** from two checks of every MiClub course on Monday 19 October, at 3:02 pm and 3:33 pm Perth time. That's only half an hour of recording, so treat them as a demo of the report, not as figures to quote yet.

## What was done

### How a tee time counts as unbooked

- BookOn can't see bookings, only which tee times are free.
- A tee time counts as **unbooked** when it was **still free in a check within the hour before it started**.
- If the last check was longer ago than that (for example, the worker was off), the tee time isn't counted. Nothing is guessed, so the real numbers are only ever higher.
- For each one, BookOn keeps:
  - the course, start time, holes and layout
  - **how many player spots were still empty**
  - the price, where the club shows one
- They're kept just before a day's times are replaced by a newer check, or when past days are cleared.
- **Golf courses only.** Simulators and ranges aren't counted.

### Admin → Reports

[Close-up](./m13/m13-unbooked-report.png), [whole page](./m13/m13-reports-page.png). A new **Unbooked tee times** section under the activity table, for the same dates:

- **Headline for the pitch:** "Sun 20 Sept to Mon 19 Oct: 83 tee times (274 player spots, about $11,228 in green fees) went unbooked across 15 courses."
- **How much was checked**, shown with the headline and for each course: the share of the golfing day (6 am to 6:30 pm) that had a check within the hour, counted from when recording began. Coverage was 48% in the screenshot because recording had only just started.
- **For each course:**
  - unbooked tee times
  - empty player spots
  - green fees not earned (price × empty spots, for tee times with a price)
  - when they mostly go unbooked (for example "1 to 4 pm (100%)")
  - how much was checked
- **By day of the week** and **by time of day** (before 7 am, 7 to 10 am, 10 am to 1 pm, 1 to 4 pm, 4 pm on), across all courses.
- **Download CSV** with every column and both breakdowns per course, for slides or a spreadsheet. Only admins can download it; signed out, it's "not found".

### Also in this milestone, at your request

**Simpler areas:** North, East, South, West and Regional WA.

- Rockingham, Secret Harbour, Kennedy Bay, Mandurah, The Cut and Pinjarra moved to South.
- Bunbury, Busselton, Dunsborough, Margaret River and Capel moved to Regional WA.
- A migration moved existing courses and coaches. Old area links now search everywhere.

## Checked

| Check                             | Result                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Live, two checks 30 minutes apart | All 25 MiClub courses read cleanly both times. Tee times that started between the checks while still free were recorded, and the report showed them.                                                                                                                                                                                                                                                                                          |
| Tests                             | 297 passing. New tests cover: <ul><li>a tee time free within the hour, then started, counts</li><li>one booked before it started doesn't</li><li>one last seen too long before doesn't</li><li>yesterday's leftovers count when cleared</li><li>sims and ranges don't count</li><li>totals, green fees, weekday and time-of-day splits</li><li>coverage</li><li>the CSV</li><li>the same steps through the worker's database driver</li></ul> |
| All checks                        | `format:check`, `lint`, `typecheck`, `test` and `build` pass.                                                                                                                                                                                                                                                                                                                                                                                 |

### Fixed while checking

- **Nothing was being recorded when the worker ran.**
  - The cause: the local test database accepted a date in the new query, but the worker's database driver doesn't, so every save failed.
  - The fix: the time is now passed as text, and a new test runs the query through the worker's driver.
- **My first live run checked 25 courses at once**, and some clubs' servers dropped the connection. The normal worker checks courses more gently, and so did the second run.
- **Tee times from before recording began** (from my earlier test checks) were in the first draft of the totals. The report now only counts tee times that started after recording began, so the headline and the "checked" figure cover the same period.

- **Rockingham Golf Club's page address briefly changed.** My area edit renamed it from "rockingham" to "south" for about half an hour. A test caught it and it's back. It only affected a database if `pnpm db:seed` ran in that time, and none did here.

## Decisions I made

1. **Within the hour before it started** is the rule. With checks every 30 minutes, the last check before a tee time is normally 0 to 30 minutes ahead of it. Allowing an hour copes with a slow or missed check without counting stale information.
2. **Green fees use the price per player times the empty spots,** and only for tee times showing a price. The headline says how many had one.
3. **Coverage is measured over 6 am to 6:30 pm,** when most tee times are. Very early or late tee times still count as unbooked.

## Open issues

1. **The numbers only build up while the worker runs.** On your Mac that's only while it's awake. A few weeks on the hosted test site (Stage 1, about A$8 a month) would give pitch-ready figures.
2. **Hamersley shows 0% checked,** because it's on Quick18, which I can't read. Your own worker runs will fill it in.
3. **A tee time booked in the last few minutes before it starts** can't be told apart from an unbooked one. That's why the rule uses a short window.
4. **Clubs can't see their own numbers yet,** by your choice.

## How to demo (on your Mac)

```bash
cd ~/bookon
git pull
pnpm install
pnpm db:dev                                      # window 1, keep running
caffeinate -i pnpm dev:worker                    # window 2, keep running (stops the Mac sleeping)
BOOKON_ADMIN_EMAILS=<your email> pnpm dev        # window 3
```

Sign in with your email (the link is in http://localhost:3000/dev/outbox), then open **Admin → Reports** and scroll to **Unbooked tee times**. Recording starts when the worker starts. Leave it running through a day and the numbers fill in. **Download CSV** gives the same figures for slides.
