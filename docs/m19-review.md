# Milestone 19 review: special rates and group sessions

20 October 2026. You asked for weekend, public holiday and school holiday prices, and for coaches to run group sessions where golfers buy spots until it's full.

**About the screenshots:** they're from a local database in practice mode (no money moves), with the made-up sample coaches Grace Okafor and Mia Hartley.

## What was done

### Weekend and holiday prices

[On the coach's page](./m19/m19-rates-coach-page.png), [booking: day prices](./m19/m19-rates-book-days.png), [booking summary](./m19/m19-rates-summary.png)

- **Coaches set them per lesson.** In My coaching, each lesson has "Different price on weekends or holidays?" with boxes for **weekends**, **public holidays** and **school holidays**. Any can be left empty.
- **When more than one applies,** a public holiday wins, then a weekend, then school holidays (your rule). A price left empty falls through to the next one, then the usual price.
- **What golfers see:**
  - the coach's page and booking page list the special prices under the lesson ("Weekends $115 · Public holidays $130")
  - when picking a day, days at a different price show it
  - the summary says "Lesson (weekend rate)" with that price
- **The price charged is worked out again when they pay**, from the coach's current prices and the date. It's shown on the golfer's booking page and in the emails.
- **WA dates are built in for 2026 and 2027.** They come from the WA Government's public holiday list and the Department of Education's term dates. **Admin → Settings → WA holiday dates** ([screenshot](./m19/m19-admin-holidays.png)) has one date per line, to add later years. A line it can't read is shown back and nothing is saved, so a typo can't wipe the list.

### Group sessions

[Coach's page (phone)](./m19/m19-sessions-coach-page-phone.png), [booking (phone)](./m19/m19-session-book-phone.png), [booked (phone)](./m19/m19-session-booked-phone.png)

- **Coaches put them on in My coaching → Group sessions** ([form](./m19/m19-coach-session-form.png)):
  - name and what it covers
  - first date, start time and length
  - where
  - price a spot, number of spots, and an optional minimum
  - **repeat weekly** for up to 12 weeks
  - It's only available once bookings through BookOn are on, as golfers pay to book.
- **Clashes are refused.** A session can't overlap a lesson, a blocked-out time or another session. If any week clashes, nothing is added and the coach is told which dates.
- **Golfers book spots:**
  - from the coach's page, **Find a coach** ([screenshot](./m19/m19-coaches-sessions.png)) or the golf lessons page
  - pick 1 to 8 spots, add their details (with "Who's coming" for more than one), and pay
  - **charged straight away**, with one $2.50 booking fee per booking, not per spot
  - spots are held for 30 minutes while they pay, so two people can't buy the last spot
  - "3 spots left", or "Full", shows everywhere the session is listed
- **Minimum numbers:** if a minimum is set and it isn't reached 24 hours before, the worker calls the session off. Everyone is refunded in full and emailed, and the coach is told. If it is reached, the coach gets a "Going ahead" email and it isn't checked again.
- **Cancelling:**
  - golfers cancel from their booking link: a full refund 24 hours or more before; after that, no refund, but the spots free up for others
  - coaches can call off any session with a note, and everyone who booked is refunded in full
  - if someone finishes paying just after a session is called off, they're refunded straight away
- **For the coach** ([My coaching](./m19/m19-coach-sessions.png)):
  - each session shows "3 of 6 booked" and whether it still needs its minimum
  - who's coming, with phone, email and their note
  - sessions appear in **My calendar** ([month](./m19/m19-calendar-month.png), [day](./m19/m19-calendar-day.png)) and in the calendar link for Apple, Google and Outlook, with who's coming
- **Sessions block lesson times,** so a golfer can't book a private lesson during a clinic.
- **For golfers:** sessions show in My account → Lessons, and each booking page has Add to calendar.
- **For you:**
  - Admin → Lessons lists group bookings ([screenshot](./m19/m19-admin-groups.png))
  - Reports shows group bookings, spots, coach payouts and booking fees ([screenshot](./m19/m19-admin-report.png))
- **For golf coaches page** ([screenshot](./m19/m19-coaching-features.png)) now mentions calendar sync, weekend and holiday prices, and group sessions.

### Behind the scenes

- **Data:**
  - new tables `group_sessions` and `group_bookings` (migration `0016_group_sessions`)
  - special prices are kept on each lesson rate
  - WA dates live in `packages/core/src/wa-calendar.ts`, with admin changes stored in settings
- **Payments:**
  - `packages/payments/src/groups.ts` handles group bookings
  - group checkouts charge straight away; lessons still hold the card until the coach accepts
  - the Stripe webhook now handles both lessons and group bookings
- **The worker's lessons step now also:**
  - checks minimums
  - closes group checkouts that weren't paid
  - retries any refund that failed, for example if Stripe was briefly down
- **Sample data:** sample coaches Mia and Daniel get weekly sample sessions on a local database, so it can be tried straight away.

## Checked

| Check               | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Browser walkthrough | <ul><li>Grace's 60-minute lesson showed $115 on four Saturdays, and the summary read "Lesson (weekend rate) $115, booking fee $2.50, total $117.50".</li><li>On a phone, Alex booked 2 spots at Mia's clinic and paid ($82.50). Bo then booked 1, and the clinic showed "3 spots left". Two more bookings made it "Full", and its page said so.</li><li>The golfer's and coach's emails arrived in the outbox.</li><li>As Mia, I added 2 weekly sessions. A session overlapping an existing one was refused, naming the date. I called one off with a note.</li><li>The calendar showed sessions with who's coming.</li><li>As admin, a bad holiday line ("2028-02-30") was refused and shown, and a good one saved.</li><li>No page errors.</li></ul> |
| Tests               | 404 passing (24 new). They cover:<ul><li>holiday and weekend days, and which price wins</li><li>the price charged at checkout</li><li>reading and checking holiday lists</li><li>the session form</li><li>weekly repeats</li><li>refusing clashes</li><li>sessions blocking lesson times</li><li>one booking fee for several spots</li><li>not overselling</li><li>golfer cancels, early and late</li><li>coach calls off, with everyone refunded</li><li>a failed refund retried</li><li>paying after a call-off</li><li>minimums, called off and going ahead</li><li>the emails and calendar entries</li></ul>                                                                                                                                       |
| All checks          | `format:check`, `lint`, `typecheck`, `test` and `build` pass.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

### Fixed while checking

- **Day boxes on the booking page were uneven heights** when some showed a special price. They now line up.
- **The holiday boxes in Admin said "(optional)"**, but they shouldn't be left empty. They're now required.
- **My calendar's heading** now mentions group sessions.

## Decisions I made

1. **Up to 8 spots per booking**, 2 to 40 spots per session, and repeats up to 12 weeks, put on up to 120 days ahead.
2. **Late cancels free the spot without a refund**, the same as lessons. Someone else can then book it.
3. **A session added during a coach's busy time read from their own calendar is allowed**, as the session is often already in that calendar. Lessons, blocked-out times and other sessions still clash.
4. **The minimum is checked once, 24 hours before.** A late cancel after it's going ahead won't call it off.
5. **Group sessions only show while the coach takes bookings.** If they turn bookings off, the sessions are hidden but kept, and anyone already booked is unaffected.
6. **Special prices apply to private lessons only.** Group sessions are priced per session.
7. **The 2027-28 summer school holidays stop at 31 December 2027** until 2028 dates are added.

## Open issues

1. **The coach payment terms don't mention group sessions yet.** Coaches agreed to the lesson terms. They should say "charged on booking, refunded if called off or cancelled 24 hours before". Changing them means every coach agrees again. Would you like me to update them? (On the launch checklist.)
2. **2027 school dates are preliminary**, and 2028 isn't published. On the launch checklist to check and add.
3. **WA Government sites block my environment**, so I took the holiday dates from search summaries of the official pages (wa.gov.au and education.wa.edu.au). Worth a quick look in Admin → Settings.
4. **Not tried against real Stripe** (blocked from here). Group checkouts use Stripe's normal "charge now", and refunds use the same call as lessons. On the launch checklist to try in test mode.
5. **A coach with many weekly sessions gets a long list** in My coaching. Fine for now; it could fold into series later.

## How to demo (on your Mac)

```bash
cd ~/bookon
git pull
pnpm install
pnpm db:dev                                      # window 1, keep running
caffeinate -i pnpm dev:worker                    # window 2, keep running
BOOKON_ADMIN_EMAIL=<your email> pnpm dev         # window 3
```

Starting the site adds the new tables, and the worker adds the sample sessions.

1. **Group sessions:**
   - http://localhost:3000/coaches/mia-hartley: tap a clinic, pick 2 spots, and pay with the practice checkout.
   - Then sign in as `mia.hartley@example.com` (the link is in http://localhost:3000/dev/outbox) and open **My coaching → Group sessions** to see who's coming, put on a weekly session, or call one off.
2. **Weekend prices:**
   - In My coaching (as any coach), open "Different price on weekends or holidays?" under a lesson, add a weekend price, and send the change for approval.
   - Approve it in Admin → Coaches. The booking page then shows the price on Saturdays and Sundays.
3. **Holiday dates:** Admin → Settings → WA holiday dates.
