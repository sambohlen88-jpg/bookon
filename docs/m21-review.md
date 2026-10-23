# Milestone 21 review: club events

23 October 2026. You approved club events: entry and payment, start sheets, results, a waiting list, members' fees, and "Open competitions near you". Nothing touches handicaps: no handicap numbers are collected and no scores are worked out.

**About the screenshots:** they're from a local database in practice mode (no money moves). I used Point Walter Golf Course as the club, signed in as you (admin can open any club's portal), plus made-up golfers. Point Walter hasn't signed up; the events are made up.

## What was done

### Clubs take payments (club portal → Payments)

[Setting up](./m21/m21-club-payments-setup.png), [ready](./m21/m21-club-payments-ready.png)

- **The club's owner sets up the club's own Stripe account**, after agreeing to the event payment terms. Stripe asks for the club's ABN, a contact's ID and the bank account; BookOn never sees them. Staff can see the status but can't change it.
- Entry fees go straight to the club. Golfers pay BookOn's booking fee on top.
- "Payouts and receipts (Stripe)" opens the club's Stripe dashboard.

### Putting on an event (club portal → Events)

[The form](./m21/m21-club-event-form.png), [list](./m21/m21-club-events-list.png)

- **Name and description**
- **Course**, if the club has more than one
- **Day**, and 9 or 18 holes
- **Start:** tee times (first time, then 8, 10 or 12 minutes apart, optionally off the 1st and 10th at once), or a **shotgun**
- **Format:** individual, pairs, or teams of 3 or 4
- **Fees:** per player, plus an optional **members' fee** for players who give a member number
- **Field size**, and **when entries close**
- **Open** (listed on BookOn) or **members only** (unlisted and shared by link; every player gives a member number)

The form checks the field suits the format (a multiple of the team size) and the start (a shotgun takes two groups a hole). Entries must close before the start.

Once someone has entered, only the name, description, closing time, field size and listing can change. That keeps fees and format fair for those already in.

### Entering

[Competitions (phone)](./m21/m21-competitions-phone.png), [event page (phone)](./m21/m21-event-page-phone.png), [entered](./m21/m21-entry-paid-phone.png), [full, with waiting list](./m21/m21-event-full-waitlist-phone.png)

- **The event page** shows:
  - the day, start, format and course
  - the fee and members' fee, and places left
  - when entries close
- **One person enters for the team:** each player's name, plus a member number for the members' fee, then their email and mobile.
- **They pay straight away**, with one $2.50 booking fee per entry. Places are held for 30 minutes while they pay, so two teams can't take the last places.
- **Withdrawing:** golfers withdraw from the link in their email. Before entries close it's a full refund; after that it frees the places but isn't refunded, unless the club chooses to.
- **Waiting list:** when it's full, golfers leave their name and email. When places free up before entries close, everyone on the list who fits is emailed, and the first to pay gets the place.
- Entries show in **My account → Lessons**, next to lessons and group sessions.

### Running the event (club portal → the event)

[Entries](./m21/m21-club-event-entries.png), [start sheet](./m21/m21-club-start-sheet.png), [printed](./m21/m21-club-start-sheet-print.png)

- **Entries** list each team, member numbers, contact details and fees. Clubs can **withdraw an entry with a full refund**, or **without a refund**, each with an optional note to the golfer.
- **Start sheet:**
  - **Make start sheet** in order of entry, or shuffled. BookOn sets out groups of up to four, keeping teams together, with each group's tee time or shotgun hole (4B for a second group on a hole).
  - **Move** any team to another group, if there's room.
  - **Publish and email everyone:** each golfer gets their start, who they're playing with, and Add to calendar. After publishing, moving a team emails just that team their new start.
  - **Print** (or save as a PDF) and **download as CSV**. The entry list downloads as CSV too.
- **Results:** type placings, winners and prizes as plain text. They show on the event page.
- **Cancel the event:** everyone is refunded in full, including the booking fee, and emailed with the club's note.

### What the worker does

- Tells the club when entries close ("make the start sheet")
- Reminds every entrant the day before, with their start
- Closes unpaid checkouts, and lets the waiting list know if that frees places
- Retries any refund that failed

### "Open competitions near you"

[Competitions (desktop)](./m21/m21-competitions-desktop.png), [course page](./m21/m21-course-competitions.png), [For golf clubs](./m21/m21-clubs-events-section.png)

- **A new Competitions page** (in the header and footer) lists open events with places left. You can filter by any time, this week or the next 4 weeks, by area, and by **Near me**.
- **Each course page** lists the club's upcoming events there.
- **The home page** shows "Competitions coming up" (the next three still taking entries).
- **A Google page**, "Golf competitions in Perth", lists them too, and open events are in the sitemap.
- **The For golf clubs page** has a new "Run your events on BookOn" section.
- Only clubs that have finished setting up payments are listed. Members-only events are never listed and aren't shown to search engines.

### For you

[Admin events](./m21/m21-admin-events.png), [Reports](./m21/m21-admin-event-report.png), [Settings](./m21/m21-admin-event-settings.png)

- **Admin → Events:** every event in the last six months and ahead, and which clubs are taking payments.
- **Reports:** entries, players, paid to clubs and booking fees.
- **Settings:** the event booking fee ($2.50, separate from the lesson fee), and an on/off switch.

## Checked

| Check               | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser walkthrough | <ul><li>Set up Point Walter's payments (practice).</li><li>Put on a pairs Ambrose for 8 players ($45, members $30) and a 9-hole shotgun.</li><li>On a phone, entered as Alex (member PW1042) and Sam: charged **$77.50** ($30 + $45 + $2.50). Three more pairs filled it, and Kim joined the waiting list.</li><li>Made the start sheet in entry order, moved Di and Ed to group 3, and published: everyone got their start time; Di got "New start time" when moved after publishing.</li><li>Printed it; both CSVs downloaded, and refused when signed out.</li><li>Bo withdrew before entries closed: refunded **$92.50**, the club was emailed, and **Kim got "A place is free"**.</li><li>Saved results, cancelled the shotgun with a note.</li><li>The Competitions page, course page, home strip, Google page, admin Events, Reports and Settings all showed it.</li><li>No page errors.</li></ul> |
| Tests               | 444 passing (28 new). They cover:<ul><li>members' fees per player</li><li>tee times, two tees and shotgun holes</li><li>start sheets that keep teams together</li><li>not overselling places</li><li>closed and cancelled events</li><li>what can change once golfers have entered</li><li>moving teams only where there's room</li><li>publishing only when everyone's placed</li><li>the waiting list</li><li>refunds before and after entries close</li><li>club withdrawals</li><li>cancelling (including someone paying just after)</li><li>emails for publish and moves</li><li>the closing notice and reminder sent once each</li><li>totals</li><li>the event form</li></ul>                                                                                                                                                                                                                      |
| All checks          | `format:check`, `lint`, `typecheck`, `test` and `build` pass.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

### Fixed while checking

- **"Point Walter Golf Course, Point Walter Golf Course"** showed where the club and course share a name. It now shows once.
- **Phone numbers in the CSVs** came out as `'+61…` (the spreadsheet formula guard). They're now written as 0491 570 110.
- **A database test timed out** when every package tested at once, as it starts its own database. Tests now get the same 60 seconds the setup already had.

## Decisions I made

1. **Teams stay together** on the start sheet. Two pairs share a group; a team of 3 is joined by a single if there is one.
2. **Players' names show on the public start sheet** once published, as clubs do on their noticeboards. Contact details and member numbers stay with the club. This is on the launch checklist for the privacy policy.
3. **Members-only events need a member number for every player.** Open events only need one for the members' fee. BookOn doesn't check numbers; the club does.
4. **Remaking the start sheet after publishing doesn't email anyone** until the club presses "Send everyone their start again". That way a club can rework it and send it once.
5. **The waiting list emails everyone who fits at once**, not one at a time, so a place doesn't sit empty waiting for one person to reply.
6. **New-entry emails go to the club's contact email**, or the club's owners on BookOn if there isn't one.
7. **Events can be put on up to a year ahead**, with a field of up to 240.

## Open issues

1. **Not tried against real Stripe** (blocked from here). Club accounts and event checkouts use the same Stripe calls as coaches and group sessions. It's on the launch checklist to try in test mode.
2. **The event payment terms need a lawyer's eye**, especially who's responsible for the day itself. They're on the launch checklist.
3. **No real club has seen this yet.** It'd be worth showing a club captain before launch. Start sheets and formats vary by club, and they'll know what's missing (for example extras like a cart or meal at checkout, which aren't included).

## How to demo (on your PC, in PowerShell)

```powershell
cd ~\bookon
git pull
pnpm install
pnpm db:dev                                                      # window 1
pnpm dev:worker                                                  # window 2
$env:BOOKON_ADMIN_EMAIL="sambohlen88@gmail.com"; pnpm dev        # window 3
```

1. Sign in at http://localhost:3000/signin with your email. The link is in http://localhost:3000/dev/outbox.
2. Go to **Admin → Clubs**, open any club, then its club portal.
3. **Payments:** tick the terms, add your name and set up (practice).
4. **Events → Put on an event.**
5. Open the event's link (shown on the event page) in a private window, and enter a team or two with the practice checkout.
6. Back in the club portal, open the event and press **Make start sheet**, then **Publish**. The emails are in the outbox.
7. http://localhost:3000/competitions shows the event.
