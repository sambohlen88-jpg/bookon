# Milestone 7 review: club onboarding

18 October 2026, built overnight. The owner's brief: "An onboarding page for golf clubs to sign their clubs up. Including the prices, approvals, tee time slots, etc. … future proof so that one day when we can take payments we have everything on there so for example cart prices, deals, midweek costs, club hire."

This replaces the spec's original Milestone 7 (hardening and launch), which moves to Milestone 9. Recorded in `SPEC.md` section 11.

## What was done

### For golf clubs page (`/clubs`)

What clubs get (more golfers, cancellations filled, bookings stay theirs), how listing works, and what to have handy. It's linked from the header ("For golf clubs") and the footer. [Screenshot](./m7/m7-clubs.png).

### Signing up (`/clubs/join`)

A club starts with four things: club name, suburb, their name and email. BookOn emails a **private link** so they, or a colleague, can finish later. Answers save at every step. Then eight steps:

| Step                     | What it asks                                                                                                                                                                                                                                                                                                                           |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Your club             | Name, type (public, members' club open to the public, resort), legal or trading name, ABN (checked for 11 digits), address, website, phone and email for golfers. [Screenshot](./m7/m7-step-club.png)                                                                                                                                  |
| 2. Contacts              | Main contact (required), bookings or pro shop contact, accounts contact (for invoices and future payouts), email for monthly reports                                                                                                                                                                                                   |
| 3. Courses               | Each course or set of nines: name, holes (9, 18, 27, 36), par, the layouts golfers can book (e.g. "Lake & Pines")                                                                                                                                                                                                                      |
| 4. Tee times             | Booking system (MiClub, Quick18, Chronogolf, Golf Genius, own website, phone only, other), public booking page, minutes between times, first and last times on weekdays and weekends, days ahead the public can book, two-tee starts, group size, singles, times the public can't book (member comps), cancellation policy, dress code |
| 5. Prices                | The full price list (below). [Screenshot](./m7/m7-step-prices.png)                                                                                                                                                                                                                                                                     |
| 6. Photos and facilities | A short description, facilities (pro shop, range, carts, buggies, club hire, lessons, café, bar, function room and more), and up to 8 photos                                                                                                                                                                                           |
| 7. Approvals             | Listing terms, the club's approvals, and interest in payments later. [Screenshot](./m7/m7-step-approvals.png)                                                                                                                                                                                                                          |
| 8. Review and send       | Everything on one page with **Change** links, what's still missing, then **Send to BookOn**. [Screenshot](./m7/m7-review.png), [phone](./m7/m7-review-phone.png)                                                                                                                                                                       |

### The price list, ready for payments

Each price is a structured line in the database (`club_rates`), not free text, so BookOn can later quote and charge from it. Each line has:

- **What for:** green fee, cart hire, club hire, buggy or trolley, driving range, deal or package, membership, something else.
- **Name** golfers see, **price**, and **per** player, cart, set, group or item.
- **Holes:** 9, 18, or doesn't matter.
- **Days:** any day, **midweek (Mon–Fri)**, weekends, public holidays, or picked days (e.g. Tuesdays only).
- **Who:** adult, senior, concession, junior, student, member's guest, anyone.
- **Times** (e.g. twilight from 3 pm), **date range** (seasonal prices and deals), which **course** (for multi-course clubs), whether **GST** is included, and notes or conditions.

Clubs start with the usual lines (18 and 9 holes midweek and weekend, senior, twilight, cart, club hire) with prices blank. They fill in what applies, and lines left blank aren't saved, with a note saying so. Quick-add buttons cover green fees, twilight, carts, club hire, buggies, deals and anything else. At least one green fee is required.

The details payments would need later are also asked for now: **ABN**, **legal name**, **accounts contact**, **GST registration** and the **business name payouts would go to**. **Bank details are deliberately not collected.** The form says they'll be asked for later through a secure payments provider, never on a form.

### Approvals

The club ticks each approval, and BookOn records **the exact wording, who ticked it, their role and when**. That's evidence of permission to show their times and read their booking page.

| Approval                                                                                         | Required |
| ------------------------------------------------------------------------------------------------ | -------- |
| Authorised to list the club                                                                      | Yes      |
| BookOn may show tee times, prices and course details and send golfers to the club's booking page | Yes      |
| BookOn may read the public booking page automatically, politely, as BookOnBot                    | Yes      |
| BookOn may ask the booking system provider for a data feed                                       | No       |
| Has read the listing terms (free, leave any time, reports shared)                                | Yes      |
| BookOn news                                                                                      | No       |

Plus: interested in taking payments through BookOn later (yes, maybe, no).

### Photos

Uploaded photos are turned the right way up, shrunk to at most 2000 pixels, converted to WebP and **stripped of hidden details such as GPS location** before saving. The club must confirm it owns each photo or may share it, and who confirmed.

Photos only appear on the site once **you approve them**. They then replace the drawing for that course on the course page, the courses page, the home page gallery and in search results.

### After a club sends it

- The club gets a "We've got your listing" email with its link.
- **You get an email with the whole application** (sent to `BOOKON_OWNER_EMAIL`, or info@bookon.com.au).
- The listing becomes read-only. Changes go through info@bookon.com.au.

### Reviewing listings: `pnpm clubs`

Until the admin dashboard (now Milestone 8):

```sh
pnpm clubs                                   # listings waiting for review
pnpm clubs -- all                            # every listing
pnpm clubs -- show <id>                      # everything a club sent, and its photos
pnpm clubs -- approve <id> [note]
pnpm clubs -- decline <id> [note]
pnpm clubs -- reopen <id>                    # let the club edit it again
pnpm clubs -- photo <photo id> approve <course slug>
pnpm clubs -- photo <photo id> decline
```

## Checked

| Check                 | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full run in a browser | A club started a listing; its private link was emailed; a short ABN was caught; contacts, two courses (27 and 9 holes), tee times and a price list with a Tuesday deal were entered; a deal with no days was caught with a plain message; blank lines were skipped with a note; a photo uploaded; missing approvals were caught; the review page showed everything; **Send** produced the club's confirmation and BookOn's notice; the sent listing couldn't be changed through its link |
| Reviewing             | `pnpm clubs` listed it; `show` printed every answer, each approval with who and when, and the photo; approving the photo put it on Collier Park's page; declining took it off and the drawing came back                                                                                                                                                                                                                                                                                  |
| Security              | Uploads from other sites refused (403); a listing's photos can't be seen with the wrong link (404); unapproved photos aren't public (404); files that aren't photos refused, including SVG; photo location data removed (tested); 5 new listings per email address a day; a hidden field catches form-filling bots                                                                                                                                                                       |
| Lighthouse            | Every step: Accessibility 100, Best practices 100, Performance 99–100                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Tests                 | 188 passing. New ones cover price checking, starting and saving listings, approvals, sending, photo limits and approval, the review email, the price wording, and photo processing                                                                                                                                                                                                                                                                                                       |
| Earlier milestones    | The Milestone 4 and 6 flows re-run on the current code                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| All checks            | `format:check`, `lint`, `typecheck`, `test` and `build` pass                                                                                                                                                                                                                                                                                                                                                                                                                             |

## Bugs found and fixed while checking

1. **Web addresses without "https://" blocked the form.** "lakesidegolf.com.au" was rejected by the browser with no clear message. These fields now take any address and the site adds https://.
2. **Production refuses to start a listing without `BOOKON_SITE_URL`.** That's deliberate, the same as sign-in, but it's now spelled out in the launch checklist.

## Decisions I made

1. **A private link instead of an account.** Club staff change, and pro shops share inboxes, so a link anyone at the club can use is simpler than another password. The email warns that anyone with the link can edit.
2. **No bank details on the form**, even though payments are the goal. Collecting them safely needs a payments provider such as Stripe. Everything else payments need is collected.
3. **Approvals record their wording.** If the wording changes, older approvals keep the text the club actually agreed to (`CONSENTS_VERSION`).
4. **Approving a listing doesn't switch a course on.** Reading a club's booking page still needs setting up and testing (as for the 26 courses so far), and only for platforms you've approved. Approving prints that reminder.
5. **Sent listings are read-only through the link**, so what you reviewed can't change underneath you. `pnpm clubs -- reopen` hands it back.
6. **Photos are stored in the database.** Simple and private for now. A file store makes sense once there are many.
7. **Listing terms are a short plain-English summary.** They need a lawyer before launch (added to the launch checklist).

## Open issues

1. **Legal review** of the listing terms and approvals wording (launch checklist).
2. **Clubs on platforms you haven't approved** (Golf Genius, their own website) can sign up, but their times can't be read until you approve that platform in `docs/platforms.md`.
3. **The pages promise "usually within a week"** and monthly reports. Reports arrive with Milestone 8 (`pnpm stats` has the numbers now).
4. **An admin screen** for listings and photos is Milestone 8. `pnpm clubs` covers it until then.

## Before launch (as CLAUDE.md asks me to remind you)

Telling clubs about this page counts as launch work. Open items in [`launch-checklist.md`](./launch-checklist.md), starting with:

1. **Verified platform access** from MiClub, Quick18 and Chronogolf. The club approvals help here: each listed club has agreed in writing to BookOn reading its booking page, and can ask its provider for a feed.
2. **Postmark** (without it, the private links and confirmations don't reach clubs).
3. **The info@bookon.com.au mailbox**, hosting, `BOOKON_SITE_URL`, `CLICK_SIGNING_SECRET` and the push keys.
4. **Legal review** of the privacy policy, terms and club listing terms.

## How to demo

```sh
git pull && pnpm install                   # adds the image library
pnpm db:dev                                # keep running
pnpm db:seed                               # new tables
pnpm dev
```

1. Open http://localhost:3000/clubs and press **List your club**.
2. Fill in the steps. The private link email is at http://localhost:3000/dev/outbox.
3. Send it, then check the outbox for both emails, and run `pnpm clubs` and `pnpm clubs -- show <id>`.
4. To see a photo on the site: `pnpm clubs -- photo <photo id> approve collier-park`, then open http://localhost:3000/courses/collier-park. `pnpm clubs -- photo <photo id> decline` puts the drawing back.
