# Milestone 20 review: sorting and ratings

23 October 2026. You asked for a sort on search results by price, availability and rating; for signed-in golfers to rate courses out of 5, with the average shown; and for the same on the Courses page. You approved:

- the average showing from 3 ratings
- stars only, with no written reviews
- updating the coach payment terms to cover group sessions

**New order of milestones** (recorded in SPEC.md, CLAUDE.md and the launch checklist):

| Milestone | What                           |
| --------- | ------------------------------ |
| 20        | Sorting and ratings (this one) |
| 21        | Club events                    |
| 22        | Match play manager             |
| 23        | Launch                         |

**About the screenshots:**

- The tee times are **live**, from a worker pass on 23 October.
- The ratings are from **made-up test golfers** on a local database. Nobody has rated anything for real yet.

## What was done

### Sorting search results

[Cheapest](./m20/m20-search-price.png), [top rated](./m20/m20-search-rating.png), [phone](./m20/m20-search-phone.png)

- **A row of sort buttons** above the results:
  - **Soonest** (as before)
  - **Cheapest**
  - **Most available**
  - **Top rated**
  - **Nearest**, after Near me
- **Cheapest** sorts by each course's cheapest time in your search. Each card says why it's there, like "**Cheapest $25 at 3:00 pm**", because the card lists the earliest times first. Clubs that don't show prices come after those that do.
- **Most available** sorts by how many times fit your group. The card says "45 tee times free".
- **Top rated** sorts by average rating. Courses with fewer than 3 ratings come after rated ones.
- **The sort is part of the page address.** A shared or bookmarked search keeps it, and so does changing the search.
- **Courses with nothing free stay at the bottom**, whatever the sort.
- Each card now shows the rating next to the suburb ("★ 4.5 (4)", or "Not rated yet").

### Ratings

[Signed in](./m20/m20-rate-signed-in.png), [signed out](./m20/m20-rate-signed-out.png), [admin](./m20/m20-admin-ratings.png)

- **On each course page:**
  - the rating shows under the course name, and a **Ratings** section has the average and the number of ratings
  - signed-in golfers tap 1 to 5 stars, can tap again to change, and can remove their rating
  - signed-out golfers see "Sign in to rate", which brings them back after signing in
- **One rating per account per course.** Sims and ranges can be rated too.
- **The average shows from 3 ratings.** Until then, it says "Not rated yet". The course page adds "the average shows once 3 golfers have rated it (2 so far)".
- **Golfers see only the average and the count**, never who rated.
- **Admin → Ratings:**
  - each course's average and count, and whether golfers can see it yet
  - every rating with the golfer's email and date
  - **Remove** for any that look like spam or a grudge; removals go in the change log
- **Clubs** see each live course's rating in the club portal, including the count before it reaches 3.

### Courses page

[Cheapest](./m20/m20-courses-price.png), [top rated](./m20/m20-courses-rating.png), [phone](./m20/m20-courses-phone.png)

- **Sort buttons:** **A to Z** (as before, grouped by area), **Cheapest**, **Most available**, **Top rated**, and **Nearest** once Near me is on.
- **Each course shows something for the sort:**
  - "From $16 this week" for Cheapest (or "From $40 an hour this week" for sims and ranges)
  - "86 free times this week" for Most available
  - its stars for any sort
- The search box and area buttons still narrow the list.
- "Next free" now looks across the week ("Next free Mon 8:04 am"), not just today and tomorrow.

### Coach payment terms

[Screenshot](./m20/m20-coach-terms.png)

- **The coach terms now cover group sessions:** charged when booked, everyone refunded if the coach calls one off or it doesn't reach its minimum, and a full refund for golfers who cancel 24 hours or more before.
- **Coaches already set up** see "We've updated the payment terms" in My coaching. Their lessons carry on as they are. They need to agree before putting on group sessions or turning bookings back on.
- New coaches agree to the new terms when they set up payments, as before.

## Checked

| Check                                                    | Result                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Search sorts (live data, Saturday 24 October, 2 players) | <ul><li>**Cheapest:** Geraldton $25, Fremantle Public $26, Collier Park $30, then Bunbury, Whaleback and Albany.</li><li>**Top rated:** The Cut 4.7, Point Walter 4.6, Collier Park 4.5, Whaleback 3.7, Secret Harbour 3.3, then courses not yet rated.</li><li>**Most available** put Links Kennedy Bay first.</li><li>Changing the search kept the sort.</li></ul> |
| Courses page sorts                                       | <ul><li>Cheapest started with Fremantle Public (from $16 this week).</li><li>Most available started with Karratha (1,138 free times this week).</li><li>Top rated showed the rated courses first.</li><li>A to Z went back to the area groups.</li></ul>                                                                                                             |
| Rating                                                   | Signed in as you (sambohlen88@gmail.com) on Collier Park, which had 4.5 from 4 ratings. Your 3 stars made it 4.2 from 5. Changing to 5 made it 4.6, and removing it went back to 4.5 from 4. Pinjarra, with 2 ratings, said "Not rated yet".                                                                                                                         |
| Admin                                                    | Removing a rating updated the average and showed in the change log.                                                                                                                                                                                                                                                                                                  |
| Coach terms                                              | Mia (sample coach) saw the updated terms box. "Put on a session" was off until she agreed, then came back.                                                                                                                                                                                                                                                           |
| Page errors                                              | None, phone and desktop.                                                                                                                                                                                                                                                                                                                                             |
| Tests                                                    | 416 passing (12 new). They cover:<ul><li>every sort order, including the 3-rating rule and fully booked courses</li><li>the cheapest price</li><li>one rating per golfer per course</li><li>changing and removing a rating</li><li>refusing anything but 1 to 5 stars</li><li>the average and when it shows</li><li>admin removal and its log entry</li></ul>        |
| All checks                                               | `format:check`, `lint`, `typecheck`, `test` and `build` pass.                                                                                                                                                                                                                                                                                                        |

### Fixed while checking

- **The Cheapest sort looked wrong at first:** Geraldton came first while its card showed $40, because its $25 time is at 3 pm, further down. Cards now say "Cheapest $25 at 3:00 pm" when sorting by price, and show the number of free times when sorting by availability.
- **Sims and ranges on the Courses page** now say their price is per hour.

## Decisions I made

1. **"Not rated yet" rather than "New"** for courses with fewer than 3 ratings. Next to a suburb, "New" read as if the course itself was new.
2. **Sorting doesn't change alerts.** Alert emails list new times soonest first, which suits an alert.
3. **Cheapest uses the cheapest time that fits your search**, 9 or 18 holes, as you set it. Pick 18 holes to compare full rounds.
4. **Most available counts free tee times that fit your group**, not player spots.
5. **Clubs see their own count before it reaches 3.** Golfers don't.
6. **On the Courses page, Cheapest and Most available look at the next 7 days.**

## Open issues

1. **Anyone with an account can rate any course.** There's no way to check they played it. Each account can rate once, and you can remove ratings in Admin. Club staff could rate their own course; the terms of use should say not to (on the launch checklist).
2. **At launch every course will say "Not rated yet"** until golfers rate. It might be worth asking friendly golfers to rate their home course early.
3. **The club portal line is checked in code but not seen in the browser.** The test club's only course isn't live on this computer, so its rating line doesn't show.
4. **Hamersley** (Quick18) wasn't in the live check, as I can't read Quick18.

## How to demo (on your PC, in PowerShell)

```powershell
cd ~\bookon
git pull
pnpm install
pnpm db:dev                                                      # window 1
pnpm dev:worker                                                  # window 2
$env:BOOKON_ADMIN_EMAIL="sambohlen88@gmail.com"; pnpm dev        # window 3
```

After the worker's first pass (a few minutes):

1. **Sorting:** http://localhost:3000/search?players=2 — try Cheapest, Most available and Top rated. Then try the same on http://localhost:3000/courses.
2. **Rating:**
   - Sign in at http://localhost:3000/signin with your email (the link is in http://localhost:3000/dev/outbox).
   - Open any course and tap the stars under **Ratings**.
   - A course's average needs 3 ratings, so sign in with two made-up emails (like test1@example.com) and rate the same course to see it appear.
3. **Admin:** http://localhost:3000/admin/ratings
