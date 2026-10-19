# Milestone 16 review: coach calendars

20 October 2026. You asked for coach calendars, special rates and group sessions, and approved splitting them:

- **Milestone 16 (this one):** calendars
- **Milestone 17:** weekend, public holiday and school holiday rates, and group sessions
- **Launch** moves to Milestone 18 (recorded in SPEC.md, CLAUDE.md and the launch checklist)

**About the screenshots:** they're from a local database in practice mode, with the made-up sample coach Grace Okafor. This computer can't reach Google, iCloud or Outlook. For the screenshots of busy times read from a calendar, I loaded the Google-style test calendar file into Grace's account directly; see "Open issues".

## What was done

### My calendar (My coaching → My calendar)

[Desktop](./m16/m16-calendar-desktop.png), [phone](./m16/m16-calendar-phone.png)

- **The month at a glance:**
  - booked lessons (green)
  - requests waiting for an answer (yellow)
  - busy times and days away
  - usual teaching days, lightly shaded
- On a phone, each day shows dots instead of words.
- Arrows move between months, and **Today** jumps back.
- **Tap a day for its schedule** ([a booked day](./m16/m16-day-booked-blocked.png), [a day with a request](./m16/m16-day-request-busy.png)):
  - the coach's usual hours that day
  - each lesson, with the golfer's phone, email and note
  - blocked-out times and busy times from their calendar
  - requests can be **accepted or declined right there**, and the coach comes back to the same day
  - booked lessons have **Add to my calendar**
- **Block out time:**
  - from and to, or the whole day, with a private note (for example a lesson booked elsewhere, or physio)
  - golfers can't book over it
  - **Remove** opens the time up again
  - limited to a month at a time; longer breaks go in days away on the listing
- My coaching links to the calendar from "Live on BookOn" and from the lessons list.

### BookOn lessons in their calendar app

[Screenshot](./m16/m16-sync.png)

- **A private subscription link** with buttons for **Apple Calendar**, **Google Calendar** and **Outlook**, and the link itself for other apps.
- **Requests** show as "Request (not confirmed)". Once accepted they show as the lesson. When a lesson is cancelled or declined, it drops off.
- **Each event** has the golfer's name, mobile, email, note and place.
- **Make a new link** stops the old one working, in case it's shared by mistake.
- **"Add to calendar" for golfers** ([screenshot](./m16/m16-golfer-add-to-calendar.png)):
  - on the booking page, once the coach accepts
  - in the "Booked" email
  - Apple and Outlook get a calendar file; Google opens with the lesson filled in

### Their own calendar blocks times on BookOn

[Reading OK](./m16/m16-busy-read.png), [when a link fails](./m16/m16-busy-error.png)

- The coach pastes their calendar's private link. "Where do I find my calendar's link?" explains it for Google, Outlook and iCloud.
- **When it's read:**
  - straight away when saved
  - then by the worker every half hour
  - or on **Check now**
- **Busy times in the next five weeks can't be booked.** This fixes "bookings outside BookOn" from Milestone 15.
- **Only start and end times are kept.** Event names and details are never stored.
- **What doesn't count as busy:**
  - events marked "free"
  - cancelled events
  - BookOn's own lessons, if the coach added them to the same calendar
- **What's understood:**
  - repeating events, including a skipped or moved week
  - all-day events
  - events in other time zones (for example a 9 am London call shows at 4 pm Perth)
- **Only Google, iCloud and Outlook links are accepted**, including where they redirect, so a pasted link can't point BookOn's server anywhere else. Other calendars can be added on request.
- **If a read fails**, the coach sees why ("Your calendar link doesn't work any more…"). The last good busy times are kept, so nothing opens up by mistake.
- **Stop reading my calendar** removes the link and its busy times.

### Behind the scenes

- `coach_busy` table for blocks and calendar busy times. Coaches get a private calendar token and their calendar link.
- `packages/core/src/ics.ts` writes calendar files and add-to-calendar links.
- `packages/adapters/src/calendar` reads coaches' calendars, using `ical.js` (pinned).
- The worker step `calendars` runs every pass. `pnpm --filter @bookon/worker calendars` runs it once.
- `/calendar/<link>.ics` stays reachable when the site password is on, because calendar apps can't type it.

## Checked

| Check               | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser walkthrough | <ul><li>Two golfers booked Grace.</li><li>Grace accepted one from the calendar's day view and came back to that day.</li><li>She blocked 12 to 2 pm. That day's free times for golfers dropped to 10:00 to 11:30 am: 9 to 10 was the lesson, and the rest of her hours were blocked.</li><li>A non-Google link was refused with a clear message.</li><li>A Google link showed "didn't answer", as this computer can't reach Google.</li><li>No page errors, phone and desktop.</li></ul> |
| Calendar files      | <ul><li>Grace's feed had the booked lesson as confirmed and the request as tentative, with escaped text and lines folded the way the standard requires.</li><li>Read back with BookOn's own reader, its events were skipped as BookOn's own.</li><li>The golfer's file and Google link carried the right time.</li></ul>                                                                                                                                                                 |
| Tests               | 371 passing (21 new). They cover:<ul><li>writing calendar files</li><li>Google and Outlook calendars, repeats, exceptions, all-day, free, cancelled and BookOn's own events</li><li>time zones</li><li>refusing other servers and redirects</li><li>broken links</li><li>blocks stopping bookings</li><li>busy times replaced on each read and kept when a read fails</li><li>the private link</li><li>the worker step</li><li>calendar links in emails</li></ul>                        |
| All checks          | `format:check`, `lint`, `typecheck`, `test` and `build` pass.                                                                                                                                                                                                                                                                                                                                                                                                                            |

### Fixed while checking

- **A time zone the calendar names but doesn't define** (like "Europe/London") was read as Perth time. It's now converted properly.
- **The busy-times count** said "to the end of next month" but only counted the month on screen. It now counts the next five weeks.

## Decisions I made

1. **Read their calendar by link, not by signing in to Google.** It works the same for Google, iCloud and Outlook, with no approval from Google needed. A Google sign-in could come later if coaches find the links fiddly.
2. **Waiting requests go in the coach's calendar**, marked "not confirmed", so they can see what's pending at a glance.
3. **Five weeks of busy times** covers the four-week booking window plus a little.
4. **A failed read keeps the last good busy times** rather than clearing them, so a calendar that's briefly down doesn't open up times the coach is busy.

## Open issues

1. **Not tried against real calendars yet.** My environment can't reach Google, iCloud or Outlook, so I tested with calendar files written in their formats. The first real check is on the hosted site (it's on the launch checklist).
2. **Calendar apps can't subscribe to a site on your Mac.** The subscription link only works once BookOn is hosted. Locally you can open it in a browser to download the file.
3. **Google refreshes subscribed calendars slowly** (often several hours). The page says so, and points coaches to "Add to calendar" for same-day lessons.
4. **iCloud public links show event details** to anyone who has the link. The page warns coaches to keep it private. Outlook's "Can view when I'm busy" option is the most private.

## How to demo (on your Mac)

```bash
cd ~/bookon
git pull
pnpm install
pnpm db:dev                                      # window 1, keep running
caffeinate -i pnpm dev:worker                    # window 2, keep running
BOOKON_ADMIN_EMAIL=<your email> pnpm dev         # window 3
```

1. Book a lesson with http://localhost:3000/coaches/grace-okafor (practice payment).
2. Sign in as `grace.okafor@example.com` (the link is in http://localhost:3000/dev/outbox), then open **My coaching → My calendar**.
3. Tap the day of the lesson to accept it, then block out a time and check the booking page no longer offers it.
4. Open the calendar link in a browser to download the file. Opening it on your Mac adds the lessons to Apple Calendar.
