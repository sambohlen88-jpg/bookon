# Milestone 23 review: analytics

24 October 2026. You approved BookOn's own version of Google Analytics inside Admin, with charts and reports, and no outside service. You said "Approve" without picking, so I went with my recommendations:

- BookOn's own cookie is used for returning visitors.
- Analytics is admin-only for now (clubs could get their own numbers later).
- The Monday summary email is on, with a switch in Settings.

Launch is now Milestone 24.

**About the screenshots:** the 30-day ones use made-up visits I added to my local database so the charts have something to show. The day's real visits from the walkthrough are in there too. One screenshot (["today"](./m23/m23-analytics-today-real-visits.png)) shows only the real walkthrough visits. None of the made-up data is in the code.

## What was done

### What's recorded

Each page someone opens records:

- the page
- where the visit came from (Google, Facebook, BookOn's emails, direct, other sites, campaigns)
- phone, tablet or desktop, plus the browser and system
- whether it was opened from the installed app, and whether they're signed in
- a rough city from the website host (Vercel)
- how long the page was on screen

Also recorded:

- **Actions:** sorting, area filters, Near me, changing day on a tee sheet, the Share button, the install prompt and installs.
- **Loading times** from real phones and computers (Google's Core Web Vitals).

What's left out:

- **No IP addresses** are kept, and nothing goes to an outside company.
- **Private links** (a golfer's lesson, entry or alert link) are stored without their codes, as "/lessons/:link".
- **Not counted:** your own visits while signed in as admin, the admin, club and coach portals, bots and link previews, and browsers that ask not to be tracked.
- **Raw records are deleted after 13 months** by the worker.
- **Links in BookOn's emails are tagged**, so visits from alerts, bookings and entries show as "BookOn emails". Sign-in links and click-throughs to clubs are left alone.

### Admin → Analytics

[Overview](./m23/m23-analytics-overview.png), [on a phone](./m23/m23-analytics-overview-phone.png)

Every tab has:

- Today, 7 days, 30 days, 90 days, 12 months, or your own dates
- each number compared with the same length of time just before
- "Show as a table" under each chart, and hover for exact numbers
- Download CSV on the tabs with lists

The tabs:

1. **Overview** ([screenshot](./m23/m23-analytics-overview.png)): visitors, visits, page views, pages per visit, time per visit, and "left after one page" (bounce rate). Below those:
   - a visitors and page views chart
   - **Right now**: who's on in the last 5 minutes, and which pages
   - top pages and sources
2. **Pages** ([screenshot](./m23/m23-analytics-pages.png)): kinds of page, every page with views, visitors and time on page, and where visits start and end.
3. **Where from** ([screenshot](./m23/m23-analytics-sources.png)):
   - channels (search, social, email, other sites, direct, campaigns) and each source
   - a chart of the top two channels
   - campaigns: add `?utm_source=flyer&utm_campaign=spring` to a link you share, and its visits show here
4. **Who** ([screenshot](./m23/m23-analytics-audience.png)):
   - new and returning visitors, installed app and signed-in visits
   - devices, browsers, systems, and cities
   - **"Do they come back?"**: visitors grouped by the week they first came, and the share who came back each week after
5. **Tee times** ([screenshot](./m23/m23-analytics-tee-times.png)): the part Google can't do.
   - **visited → searched → clicked through to a club**
   - searches with nothing free
   - a **day-by-hour grid** of the tee times people search for
   - how far ahead people search, players and holes
   - sorting and filters used
   - **each course**: shown in results, page views, clicks to the club and click rate
   - tee time alerts set up, sent, and clicked
6. **Coaching & events** ([screenshot](./m23/m23-analytics-bookings.png)): funnels from looking to paying for lessons, group sessions, events and match play, plus golfers contacting coaches directly.
7. **Accounts** ([screenshot](./m23/m23-analytics-accounts.png)): new accounts, sign-ins, favourites, ratings, alerts, shares, and installs.
8. **Speed** ([screenshot](./m23/m23-analytics-speed.png)): loading times as Google measures them (3 in 4 page loads at least this quick), marked good, needs work or poor. Shown overall, for phones vs computers, and by kind of page.

### Monday summary email

[Settings](./m23/m23-settings-analytics.png)

Every Monday after 7 am Perth, the worker emails you last week against the week before:

- visitors, visits, page views, searches and clicks to clubs
- the share of visitors who clicked through, top courses and top channels
- new accounts and alerts

It's sent once, and you can turn it off in Admin, Settings.

## Checked

| Check               | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser walkthrough | <ul><li>As four made-up golfers on different devices:<ul><li>an iPhone from Google: searched, sorted, changed day on a tee sheet</li><li>an Android phone from Facebook, which left after one page</li><li>a Windows computer typing the address: filtered and sorted the Courses page</li><li>an iPhone arriving from an alert email link</li></ul></li><li>Each showed in the right channel, device and page: 10 page views. It counted 5 visitors for the 4 golfers, which was a bug (see below), now fixed and checked again.</li><li>The "alert" email link counted as "BookOn emails".</li><li>A browser asking not to be tracked, and you signed in as admin, recorded nothing.</li><li>Time on page was recorded, including when leaving by a full page load.</li><li>Loading times came through; local ones are slow because the dev server builds each page on first view.</li><li>The CSV downloaded, and was refused when signed out.</li><li>Every tab checked on a computer and a phone, with no page errors.</li></ul> |
| Tests               | 492 passing (29 new). They cover:<ul><li>page names, with private links stripped and portals left out</li><li>devices, browsers and bots</li><li>sorting visits into channels, including BookOn's emails and campaigns</li><li>date ranges and comparisons</li><li>visits ending after 30 minutes, with the source on the first page only</li><li>time on page set only by the visitor who viewed it</li><li>totals and bounce rate by Perth day and hour</li><li>start and end pages</li><li>new vs returning visitors and weekly cohorts</li><li>the search to click-through funnel and day-by-hour grid</li><li>loading times at the 75th percentile</li><li>deleting after 13 months</li><li>tagging email links</li><li>actions read from the address</li><li>the Monday email: sent once, only on Monday after 7, not without an admin email, not when switched off</li></ul>                                                                                                                                                   |
| All checks          | `format:check`, `lint`, `typecheck`, `test` and `build` pass.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

### Fixed while checking

- **One new visitor could count as two.** The visitor cookie was only set on some pages, so a first-time visitor who moved on quickly could have their second page counted as a new person. Every public page now sets it first. I checked again: a quick two-page first visit counts as one visitor.
- **Time on page showed 0s** when someone left by loading a new page. It's now sent then too.
- **The line chart's labels were unreadable on a phone.** The lines now stretch to fit, and the labels stay normal-size text.
- **The scale showed "3" and "5"** for 2.5 and 7.5. It now steps in whole numbers.
- **"Last 12 months" was cut off** beside the date boxes. They're now on separate rows.

## Decisions I made

1. **A visit ends after 30 minutes** with nothing happening, as in Google Analytics.
2. **Your own visits are left out only while you're signed in.** Sign in on your phone too, or your phone visits count.
3. **Clubs and coaches browsing the public site are counted** like anyone else; only their portals aren't.
4. **The funnels mix people and bookings.** Page steps count people, and paying steps count bookings. A booking isn't linked back to the visitor, so BookOn never ties a visitor to their name.
5. **Speed shows the 75th percentile,** as Google does for search rankings.
6. **Charts are drawn by BookOn itself, not a chart library.** The two line colours were checked for colour-blind readers and contrast in light and dark mode.

## Open issues

1. **City needs Vercel.** It comes from Vercel's location headers, so locally (and on any other host) it shows as Unknown.
2. **iPhones don't say when the app is installed**, so installs count Android and computers only. iPhone visits from the home screen are still counted, as "installed app" visits.
3. **The privacy policy needs a section on this** (on the launch checklist). Ask the lawyer whether a cookie notice is needed. There's none now, as analytics stays with BookOn.
4. **Test-mode visits will be in the numbers at launch.** I can clear them out just before launch if you'd like a clean start.
5. **Bookings happen on clubs' own sites,** so clicking through to a club is as far as BookOn can see.

## How to demo (on your PC, in PowerShell)

```powershell
cd ~\bookon
git pull
pnpm install
pnpm db:dev                                                      # window 1
$env:BOOKON_ADMIN_EMAIL="sambohlen88@gmail.com"; pnpm dev:worker  # window 2
$env:BOOKON_ADMIN_EMAIL="sambohlen88@gmail.com"; pnpm dev        # window 3
```

1. Open http://localhost:3000 in a **private window** (not signed in, so it counts). Look around: search, open a course, change the day on its tee sheet.
2. In your normal window, sign in and open **Admin → Analytics**. Choose **Today**.
3. Try each tab. Hover the chart points, and open "Show as a table".
4. **Settings** has the Monday email switch.
