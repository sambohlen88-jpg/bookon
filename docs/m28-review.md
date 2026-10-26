# Milestone 28 review: adding and editing alerts

26 October 2026. You asked for:

- an **Add an alert** button in My account, asking for the day, time range, players and holes, plus courses near me or picked courses
- near me at **30 km to start, but able to open up**, so The Links Kennedy Bay can be an option from Claremont while Albany and Broome never come up
- a **bell** beside a course's share and star
- **editing** alerts

You approved my plan. Launch is now Milestone 29.

**About the screenshots:** they're from my local database, on a phone-sized screen, as a made-up golfer whose phone says they're in Claremont.

## What was done

### Add an alert (My account → Alerts)

[The form](./m28/m28-add-form-phone.png), [near me at 50 km](./m28/m28-near-me-50km-phone.png), [the alerts list](./m28/m28-alerts-list-phone.png)

- **"+ Add an alert"** at the top of Alerts.
- **The form:**
  - **Day**, and **Flexible?**: just that day, 3 days, a week or 2 weeks
  - **Earliest** and **Latest** times
  - **Players** 1 to 4
  - **Holes**: Either, 9 or 18
  - **Where:**
    - **Courses near me:** tap **Use my location**, then **How far will you travel?** 10, 20, **30** (the start), 50, 75 or 100 km. A live line shows which courses are in reach, closest first.
    - **Pick courses:** tick courses from the list, closest first when your location is known.
- **From Claremont:**

  | Distance | Courses                                                                                          |
  | -------- | ------------------------------------------------------------------------------------------------ |
  | 30 km    | 10 courses: Point Walter to Kwinana                                                              |
  | 50 km    | 13, adding Rockingham, **Links Kennedy Bay** (about 43 km in a straight line) and Secret Harbour |
  | 100 km   | Never Albany or Broome                                                                           |

- **Near me alerts check whichever courses are in reach at the time,** so courses that join BookOn later are included by themselves.
- **Golf courses only.** Simulators and ranges stay out of alerts, as before.

### Editing

[Editing, switched to picking courses](./m28/m28-edit-pick-courses-phone.png)

- **Edit** on each alert opens the same form, filled in. Ended alerts say **Set up again** instead.
- **Saving keeps the alert's history,** so nobody is sent a time they've already been told about. Times showing right now count as seen, as for a new alert.
- **An ended alert given new dates starts again.**
- Pause, Delete, and email or phone notifications work as before.

### The bell

[On a course page](./m28/m28-course-bell-phone.png), [the form it opens](./m28/m28-bell-form-phone.png)

- **A bell beside Share and the star** on every golf course page.
- **It opens "Alert me at Links Kennedy Bay"** with that course ticked, so the golfer only picks the day, time, players and holes.
- **Signed out,** it goes through sign-in and comes back to the form.

### Also

- **The search's Near me** uses the same distances (10 to 100 km). It was 10, 20 or 40.
- **The alert line** in My account and in alert emails ends **"within 50 km of you"** for near me alerts.
- **The "See all" link in alert emails** opens a near me search at the same distance.
- **Privacy policy:** location is still never saved for searches. For a near me alert, the rounded location is kept with the alert and deleted with it.
- Your idea of an email when an alert ends ("set up another?") is recorded in the SPEC as planned. Alerts already keep everything it'll need.

## Checked

| Check               | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser walkthrough | <ul><li>On a phone in Claremont, Add an alert without a location said "Tap Use my location, or pick courses instead".</li><li>Use my location showed 10 courses at 30 km and 13 at 50 km, including Links Kennedy Bay. 100 km didn't include Albany.</li><li>A 50 km alert for 3 players, 18 holes, 6 to 10 am was set up, and the list said "within 50 km of you".</li><li>Edit showed 50 km, 18 holes and 3 players. Switching to Pick courses (Point Walter) and saving worked.</li><li>The Kennedy Bay bell opened "Alert me at Links Kennedy Bay" with it ticked, and saved.</li><li>Signed out, the bell went to sign-in and back to the form.</li><li>No page errors.</li></ul> |
| Tests               | 536 passing (8 new). They cover:<ul><li>what's in reach from Claremont at 30, 50 and 100 km, using the real course locations</li><li>near me searches only including courses in reach</li><li>editing: keeping history, refusing someone else's alert, restarting an ended one</li><li>reading the form, with location rounding, golf courses only, and what's missing</li><li>new and saved alerts back into the form</li></ul>                                                                                                                                                                                                                                                       |
| All checks          | `format:check`, `lint`, `typecheck`, `test` and `build` pass.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

## Decisions I made

1. **Distances of 10, 20, 30, 50, 75 and 100 km,** with 30 to start. Kennedy Bay from Claremont needs 50.
2. **Near me means the phone's location**, not a typed suburb, as agreed.
3. **Alerts set up from a search before this** that cover "any course" need **Courses near me** or some courses ticked when they're edited, since the form doesn't offer "every course in WA".
4. **The Add an alert form starts on Courses near me.** From the bell, it starts on Pick courses, with that course ticked.

## Open issues

1. **Use my location needs https and permission**, so try it on your phone on bookon.au, not on your Mac's local copy. It's on the launch checklist.
2. **If a golfer moves house,** their near me alert keeps the old location until they tap **Update my location** in Edit.

## How to see it

On your phone, once Vercel shows this version as Ready:

1. Sign in on **bookon.au** and open **My account → Alerts → + Add an alert**.
2. Tap **Use my location** and change **How far will you travel?** to watch the list of courses change.
3. Open any course page and tap the **bell** beside the star.
