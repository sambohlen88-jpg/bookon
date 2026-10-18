# Milestone 8 review: admin area and club logins

18 October 2026. The owner approved the plan with all four recommendations:

- Admins sign in with email links, and again every 12 hours.
- Club text and price edits go live straight away, with a change log.
- Photos and booking page changes wait for approval.
- Reports and CSV are included.
- There's no "check this course now" button yet.

This covers the spec's original Milestone 8 too: club reports, CSV export and the source health view.

## What was done

### Signing in

- **Admins** are the email addresses in `BOOKON_ADMIN_EMAILS`. They sign in with the usual emailed link, with no password. The admin area asks them to **sign in again every 12 hours**.
- Anyone else who opens `/admin` gets "not found", so the area doesn't advertise itself.
- **Club staff** sign in the same way. A person can manage a club once their email is added to it, even before they've ever signed in.
- The header shows **Admin** and **My club** links to the people who can use them.

### Your admin area (`/admin`)

- **Overview:** join requests waiting, photos to check, booking page changes to check, and live courses whose checks are failing or out of date. [Screenshot](./m8/m8-admin-overview.png).
- **Join requests:** listings by status (waiting, approved, declined, being filled in). Each shows everything the club sent, its photos and its approvals, with **Approve** or **Decline** and a note to the club. [Screenshot](./m8/m8-admin-listing.png).
  - **Approving** creates the club and its courses, switched off. It copies the price list and photos across and gives the main contact an owner login. The club is emailed with your note and a sign-in link.
  - **Declining** emails the club your note.
- **Photos:** each waiting photo with who confirmed the rights. Approve it to a course, and it replaces the drawing across the site.
- **Courses:** every course, on or off, with its booking system, last good check and failures in the last 24 hours. [Screenshot](./m8/m8-admin-course.png). Each course page has:
  - **Editable details:** name, suburb, holes, website, booking page, how far ahead times are released, typical fee, booking system and its settings, notes.
  - **Switch on or off.** A course can only be switched on when:
    - BookOn can read its booking system (MiClub or Quick18 for now),
    - its settings are filled in,
    - and **the worker has read its page successfully at least once**. The page shows the exact command to test it.
  - **Recent checks and changes:** the last 10 worker runs with any errors, and every change to the course.
- **Clubs:** every club with its courses and logins. [Screenshot](./m8/m8-admin-club.png). Each club page has:
  - Who can sign in: add someone (they're emailed) or remove them. A club always keeps at least one owner.
  - Booking page changes the club asked for, to **Approve** or **Decline**. Approving updates the course.
  - Everything the club has told us, and its change history.
  - A link to see the club's own view.
- **Reports:** searches, times shown, clicks to book, golfers and alert clicks per course, for any dates, with **Download CSV**. [Screenshot](./m8/m8-admin-reports.png).
- **Change log:** the last 200 changes, by admins and clubs, newest first. [Screenshot](./m8/m8-admin-log.png).

### Club logins (`/club`)

Each club gets a **Team** page with owners and staff. Staff can do everything except add or remove people.

- **Overview:** times shown, golfers sent and alert clicks for the last 30 days, and each course's status (live, or being set up). [Screenshot](./m8/m8-club-overview.png).
- **Details:** club details, contacts, tee time rules, description and facilities, in the same form as signing up.
  - Changes go live straight away and are logged.
  - **A new booking page is not used until you approve it**, because it changes where golfers are sent and where times are read from. The club is told so.
- **Prices:** the full price list editor from sign-up, saved straight away. [Screenshot](./m8/m8-club-prices.png).
- **Photos:** upload more (up to 20), each waiting for your approval, with its status shown.
- **Reports:** their own courses only, with CSV.
- **Team:** owners add staff or owners (emailed a sign-in link) and remove people.

## Checked

| Check                 | Result                                                                                                                                                                                                                                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full run in a browser | All the steps listed below passed                                                                                                                                                                                                                                                                               |
| Security              | Admin pages, actions and downloads all check access themselves (not only the page frame). A club login can't open another club's pages, photos or CSV. Admin and club actions are Next.js server actions, which refuse requests from other sites. CSV cells that look like spreadsheet formulas are neutralised |
| Tests                 | 202 passing. New ones cover approving a listing (club, courses, prices, photos, owner login, unique web addresses), logins and the last-owner rule, logged edits, booking page requests, the switch-on rules, course health, admin emails, report dates and safe CSV                                            |
| Earlier milestones    | The club sign-up (Milestone 7) and golfer flows (Milestone 4) re-run end to end                                                                                                                                                                                                                                 |
| All checks            | `format:check`, `lint`, `typecheck`, `test` and `build` pass                                                                                                                                                                                                                                                    |

The browser run went through:

1. A signed-in golfer got "not found" on `/admin`.
2. You signed in to `/admin` and opened a join request.
3. You approved it, which created the club, its course (switched off) and the owner login, and emailed the club.
4. The course couldn't be switched on before its settings were filled in.
5. You approved its photo.
6. The club signed in from the approval email and landed on its overview.
7. The club saved details with a new booking page, which went to you for approval.
8. The club saved prices, added a staff member and downloaded its CSV.
9. The club got "not found" on another club's CSV and on `/admin`.
10. You approved the booking page change, and the course was updated.
11. The change log showed every step with who did it.
12. Your CSV downloaded.
13. After 13 hours, `/admin` asked you to sign in again.

## Bug found and fixed while checking

**Two-button forms could record the wrong decision.** Approve and Decline shared one form and passed the choice as the button's value, which didn't reach the server. Approving a booking page change was saved as declined, and approving a photo did nothing. Each button now has its own action, so the choice can't get lost.

## Fixed after you tried it

**"Failed query" after approving a course and photo.** The local database server (`pnpm db:dev`) took queries from the website and the worker and could mix their pieces together, so one would fail. It only happened while the worker was checking courses at the same moment. `pnpm db:dev` now uses BookOn's own small server, which finishes one query (or transaction) before starting the next. A stress test went from 268 of 300 queries failing to 2,700 of 2,700 passing, and the admin run above passed again during a full worker check. This only affects the local database on your Mac; the hosted site will use a normal Postgres database. There's 1 new test, so 203 now.

## Decisions I made

1. **Admins are listed in a setting** (`BOOKON_ADMIN_EMAILS`), not in the database. That way nobody can make themselves an admin through the site.
2. **Club logins are by email.** Adding someone needs no invite code; they sign in with that address.
3. **Admins can open any club's view** (marked "You're seeing this as an admin"), to help a club or check what they see.
4. **Clubs added before onboarding** (the 26 seeded courses) have no details or logins yet. Add a club contact on its admin page and they can fill in their details.
5. **Course name and holes are admin-only.** They affect search, so clubs email info@bookon.com.au to change them.
6. **`pnpm clubs -- approve`** now does the full approval (club, courses, logins), the same as the admin button, but doesn't email the club.

## Open issues

1. **A "check this course now" button**, as agreed, is for later. The admin page shows the worker command instead.
2. **Monthly report emails** to clubs aren't automatic yet. Clubs can see and download their report any time.
3. **Admin access on the hosted site** needs `BOOKON_ADMIN_EMAILS` set there (launch checklist).

## How to demo (on your Mac)

```sh
git pull && pnpm install
echo "BOOKON_ADMIN_EMAILS=you@example.com" >> apps/web/.env.local   # your email
pnpm db:dev                                # keep running
pnpm db:seed                               # new tables
pnpm dev:worker                            # keep running
pnpm dev                                   # restart it after adding the setting
```

1. Sign in with your email (the link is at http://localhost:3000/dev/outbox). **Admin** appears in the header.
2. List a test club at http://localhost:3000/clubs/join with a second email address and send it.
3. In **Admin → Join requests**, open it and press **Approve**.
4. Open a private window and sign in with the club's email address. **My club** appears in the header. Edit details, prices and photos, and add a team member.
5. Back in admin, see the photo and booking page change waiting, and the change log.
