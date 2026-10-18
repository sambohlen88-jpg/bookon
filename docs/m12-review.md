# Milestone 12 review: Find a Coach, and more on the home page

18 October 2026. You approved the plan with my recommendations:

- Coaches set their usual weekly hours plus days away.
- Coaches is a fifth tab in the phone menu bar.
- The sample coaches use suburbs only, not real clubs.
- Social links stay hidden until added in admin.

Hardening and launch move to Milestone 13 (recorded in SPEC.md, CLAUDE.md and the launch checklist).

**About the screenshots:**

- The coaches are the three **made-up sample coaches**, plus "Jo Tester", a coach I signed up during testing.
- The tee times in the home page banner are **real**, read from the clubs that evening.

## What was done

### Home page on desktop

[Screenshot](./m12/m12-home-desktop.png). Under the 26 / 14 days / $0 numbers there's now:

- **Free soon:** the next three tee times, each with a Book button and a "See all times" link. It replaces the Free soon section that sat further down the page, so nothing is repeated.
- **Two shortcut cards:**
  - **Golf sims & ranges**, which opens the search on Sims & ranges.
  - **Find a coach.**
- **Follow BookOn:** Instagram, Facebook and TikTok. Each shows only once you add its address in **Admin → Settings**. In the screenshot I added a test Instagram address.
- The banner is taller, so all of this sits above the drawing.

On phones, the shortcut cards and Follow links appear under Free soon.

### Find a coach (for golfers)

[List on desktop](./m12/m12-coaches-desktop.png), [on a phone](./m12/m12-coaches-phone.png), [a coach's page](./m12/m12-coach-page.png).

- **Find a coach** is in the desktop header, in the footer, and as the fifth phone tab (Find, Courses, Coaches, Alerts, Account).
- **The Coaches page** has filters for:
  - **Any time / This week / Next week**
  - **Near me**, closest first
  - area
  - speciality (All-round, Beginners, Juniors, Women's golf, Seniors, Short game, Putting, Driving, Course management, Club fitting)
- Each coach card shows the photo (or initials), name, suburb, a ✓ PGA Professional badge once BookOn has checked it, their one-line summary, specialities, which days they teach this week (or next) and "from $X".
- **A coach's page** shows:
  - their story and specialities
  - this week and next week day by day, their usual hours, and any days away
  - lessons and rates
  - where they teach, linking to the course page when it's a BookOn course, plus directions
- **Booking from the coach's page:**
  - **Message on WhatsApp** opens WhatsApp with "Hi Daniel, I found you on BookOn and I'd like to book a golf lesson." already written.
  - **Email** and **Call**.
  - **Pay through BookOn · coming soon.**
- Each WhatsApp, email, call and website tap is counted for the coach. A page that searches engines might show doesn't wait on it, and bots aren't counted.

### For coaches

[Portal on a phone](./m12/m12-coach-portal-phone.png).

- **For coaches** (`/coaching`) explains how it works, with a **List your coaching** button.
- **My coaching** (`/coach`): coaches sign in with their email (the same as everyone), then fill in one page in seven steps:
  1. About you, and PGA number
  2. What you teach
  3. Where you teach (a BookOn course or venue, or anywhere else)
  4. Lessons and rates (up to 6)
  5. Usual hours for each day
  6. Days away
  7. WhatsApp, phone, email and website
- They tick to agree their details are shown publicly, then press **Send to BookOn** or **Save without sending**.
- Problems are listed to fix, and nothing typed is lost.
- Once live, a coach sees their page link and how many golfers tapped each contact button in the last 30 days.
- **Every change goes back to BookOn.** The live page keeps showing the approved version until you approve the new one.
- **Photos:** coaches upload one. It shows once an admin approves it. Uploads are resized and stripped of hidden details, the same as club photos.
- A **My coaching** link shows in the header for anyone with a listing.

### For admins

[Review page](./m12/m12-admin-coach.png).

- **Admin → Coaches** lists listings and changes waiting first, with a count badge in the menu and on the overview.
- **Each coach's page in admin** has:
  - everything they sent
  - **PGA membership checked** (and untick)
  - **Approve** and **Decline**, with an optional note that's emailed to the coach
  - photo Approve and Decline
  - **Map location** for Near me, filled in from their BookOn course when approved
  - **Hide from golfers**
  - their contact tap counts
- Every button is its own action and checks admin access. Decisions are in the change log.
- **Emails, all going to the local outbox:**
  - a new listing or changes go to the reviewer (`BOOKON_OWNER_EMAIL`)
  - approval and decline go to the coach

### Sample coaches

| Coach        | Based                | Teaches                                        | From                                |
| ------------ | -------------------- | ---------------------------------------------- | ----------------------------------- |
| Mia Hartley  | Osborne Park (North) | Beginners, short game, women's golf            | $40 clinic, $65 30-min lesson       |
| Daniel Reyes | Applecross (South)   | All-round, driving, course management, juniors | $35 junior squad, $90 45-min lesson |
| Grace Okafor | Fremantle (West)     | Putting, seniors, club fitting                 | $60 putting lesson                  |

- They're clearly marked: a **Sample profile** badge, and a note on their pages saying the contact details don't reach anyone.
- **Contact details reach nobody:** phone numbers from Australia's range kept for fiction (0491 570 156–159) and example.com email addresses.
- Daniel is always "away" Monday to Wednesday of the coming week, to show how days away look.
- **Local databases only.** They're added when the worker starts or by `pnpm db:seed`, and only when the database is on this computer. A hosted database never gets them. Their pages are also kept out of search engines.

## Checked

| Check                      | Result                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Whole journey in a browser | <ul><li>A coach signed in by email, filled in their listing and sent it.</li><li>You (as admin) ticked PGA membership and approved with a note.</li><li>The coach went live with the PGA badge, located at Collier Park from their course.</li><li>They showed as the fourth coach on the Coaches page.</li><li>Social links saved in admin appeared on the home page.</li></ul>                                               |
| Filters                    | "Next week" left Daniel with only Sunday, as he's away Monday to Wednesday.                                                                                                                                                                                                                                                                                                                                                    |
| Phone                      | No sideways scrolling on the Coaches, coach and home pages, and no page errors.                                                                                                                                                                                                                                                                                                                                                |
| Contact taps               | Counted from a phone browser and refused for a made-up method. Headless test browsers count as bots, so they're skipped on purpose.                                                                                                                                                                                                                                                                                            |
| Tests                      | 288 passing. New tests cover: <ul><li>this-week and next-week days and days away</li><li>Australian phone numbers and WhatsApp links</li><li>reading the coach form and its problems</li><li>listings from draft to live</li><li>changes waiting while the old version stays live</li><li>declines, hiding and photos</li><li>contact counts</li><li>the samples (local only, nobody reachable)</li><li>social links</li></ul> |
| All checks                 | `format:check`, `lint`, `typecheck`, `test` and `build` pass.                                                                                                                                                                                                                                                                                                                                                                  |

## Decisions I made

1. **"This week" runs from today to Sunday, and "next week" from Monday to Sunday.** On a Sunday evening, "this week" is just what's left of Sunday, so most coaches show "Not teaching this week" then.
2. **Teaching days come from usual hours, not bookings.** BookOn can't see a coach's diary, so the page says "These are their usual teaching hours. Message them to book a time."
3. **"From $X" is the cheapest lesson, including group clinics.** Daniel shows "from $35" (junior squad). Say if you'd rather it be the cheapest private lesson.
4. **One listing per email address.** A coach who teaches in two areas lists up to three places.
5. **WhatsApp needs an Australian mobile.** Numbers are stored as +61 and shown as 0491 570 156.

## Open issues

1. **Paying through BookOn** is a placeholder. It needs a payments provider, coach payouts, refunds and GST. It's on the launch checklist.
2. **PGA membership is checked by hand.** There's no public PGA lookup BookOn can use automatically. Admins check "Find a PGA Professional", then tick the box.
3. **Places that aren't on BookOn** have no map location until an admin sets one, so those coaches don't sort by Near me until then.
4. **Coaches can't delete their listing themselves yet.** An admin can hide it.
5. **The test coach "Jo Tester"** exists only in my test database, not yours.

## How to demo (on your Mac)

```bash
cd ~/bookon
git pull
pnpm install
pnpm db:dev                    # window 1, keep running
pnpm dev:worker                # window 2: adds the 3 sample coaches when it starts
pnpm dev                       # window 3
```

Open http://localhost:3000 and try:

1. **Find a coach** in the header (or the Coaches tab on a phone). Try This week, Next week, an area, a speciality and Near me. Open Daniel Reyes.
2. **Become a coach:**
   - Footer → **List your coaching** → sign in with any email (the link is in http://localhost:3000/dev/outbox).
   - Fill in the form and **Send to BookOn**.
3. **Approve as admin:**
   - Start the website with your email as admin: `BOOKON_ADMIN_EMAILS=you@example.com pnpm dev`.
   - Sign in with that email, then **Admin → Coaches**, tick PGA, and **Approve**.
4. **Admin → Settings:** add BookOn's Instagram and see it on the home page.
