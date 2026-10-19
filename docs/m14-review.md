# Milestone 14 review: users, pitch report, pages for Google, private test mode

19 October 2026. You approved four things:

- a Users tab with one admin (you)
- a one-page club pitch report you can save as a PDF
- pages for Google covering areas and common searches around Perth
- a private test mode, so the site can go on Vercel before launch

Hardening and launch move to Milestone 15 (recorded in SPEC.md, CLAUDE.md and the launch checklist).

## What was done

### Admin → Users

[Screenshot](./m14/m14-users.png)

- **Everyone with an account**, newest first, with when they joined and last signed in. You can search by email.
- **Groups:** Customer, Club Owner, Club Staff, Coach and Admin, with a count on each filter button.
  - Groups come from what each person can actually do, so they can't drift out of step:
    - everyone who signs in is a Customer
    - Club Owner and Club Staff are the people added on a club's page
    - Coach means they have a coach listing
    - Admin is the one email in `BOOKON_ADMIN_EMAIL`
- **One admin.** BookOn reads a single address from `BOOKON_ADMIN_EMAIL`. If more than one is set, admin stays off until it's fixed, so a second admin can't slip in. The older `BOOKON_ADMIN_EMAILS` setting still works if it holds one address.
- **Each person's page** shows:
  - their clubs and role
  - their coach listing
  - how many alerts and favourites they have
  - **Delete account**, for privacy requests. You confirm by typing their email.
    - Their sign-ins, favourites, alerts and history go.
    - Club access and coach listings stay, because they belong to the club or listing.
    - The admin account can't be deleted.
    - Each delete goes in the change log.

### Club pitch report

[Screenshot](./m14/m14-pitch.png), [the PDF it saves](./m14/m14-pitch.pdf)

- **Admin → Reports → Pitch report**, or the "Pitch report" link next to each course in Unbooked tee times. Pick the course and dates, then **Print or save as PDF**. It fits on one A4 page.
- **What's on it:**
  - the club's name and its drawn course picture
  - searches that included the course
  - times golfers saw its tee times
  - clicks to its booking page
  - clicks from alerts
  - **tee times that went unbooked**, with empty player spots and green fees, plus bars by day of the week and time of day
  - what BookOn does for the club
  - a "Talk to us" contact
  - small print on how unbooked times are counted, including how much of the period was checked
- **The contact** (name, phone, email) is set in **Admin → Settings**.
- The screenshot's Bunbury numbers come from my half-hour of test checks, so they only show the layout. The phone number in it is a made-up one from the range set aside for examples.

### Pages for Google

[Hub](./m14/m14-seo-hub-desk.png), [southern suburbs on a phone](./m14/m14-seo-south-phone.png), [tee times today](./m14/m14-seo-today-desk.png), [cheap golf](./m14/m14-seo-cheap-desk.png)

There are 12 pages at `/golf/...`, plus a **Golf in Perth** hub at `/golf`.

**One page for each area:**

- `perth-northern-suburbs`
- `perth-east-and-hills`
- `perth-southern-suburbs`
- `perth-western-suburbs`
- `regional-wa`

Each area page shows:

- every course in the area, with its next free tee times
- the suburbs it covers
- a search button for that area
- three short questions and answers

**One page for each common search:**

| Page                      | What it shows                                                          |
| ------------------------- | ---------------------------------------------------------------------- |
| `tee-times-today-perth`   | The next free tee times today, soonest first                           |
| `golf-this-weekend-perth` | Free tee times this Saturday and Sunday at each course                 |
| `twilight-golf-perth`     | Tee times from 3 pm today and tomorrow                                 |
| `9-hole-golf-perth`       | Free 9-hole tee times today and tomorrow                               |
| `cheap-golf-perth`        | The lowest green fee at each course today and tomorrow, cheapest first |
| `golf-simulators-perth`   | The next free bay at each sim and range                                |
| `golf-lessons-perth`      | Coaches, with when they teach and what a lesson costs                  |

Across all of these pages:

- **The times are live**, so the pages stay fresh for Google and useful for golfers. Every time button goes to the club, tracked like any other Book click.
- **For Google**, each page has:
  - its own title (under 60 characters)
  - a description (under 160)
  - a canonical address
  - structured data: breadcrumbs, the list of courses, and the questions and answers on area pages
- **Links between pages:**
  - every page links to all the others
  - the footer has "Golf in Perth"
  - each course page links to its area page (sims link to the simulators page)
- **The sitemap** now lists the hub, every `/golf` page, Find a coach, the coaching page and each approved coach. Sample coaches are left out.
- **All the wording** is in one file, `apps/web/src/lib/seo-pages.ts`, so it's easy to change.

### Private test mode

When `BOOKON_SITE_PASSWORD` is set on the host:

- Every page asks for that password (any user name works). The browser remembers it.
- Search engines are told to keep out, three ways:
  - every response says "noindex"
  - robots.txt says `Disallow: /`
  - nothing can be read without the password
- **Two addresses stay open:**
  - robots.txt, because Google treats a robots.txt it can't read as "anything goes"
  - `/api/health`, so an uptime check works
- Turning it on or off takes effect without a rebuild (on Vercel, a redeploy applies a changed setting).

Remove the password on launch day. It's on the launch checklist.

## Checked

| Check             | Result                                                                                                                                                                                                                                                                                   |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pages for Google  | <ul><li>All 13 pages return 200 on a phone (390 px wide) and on desktop.</li><li>Each has the right title, description, canonical and structured data.</li><li>No console errors.</li><li>An unknown `/golf/...` address is "not found".</li><li>The sitemap lists every page.</li></ul> |
| Live times        | I checked Collier Park, Whaleback, Secret Harbour and The Cut. The cheap golf page showed them cheapest first: $20, $26, $45, $50 for 9 holes on Tue 20 Oct, matching the search.                                                                                                        |
| Pitch report      | Saved as a PDF: one A4 page, colours kept.                                                                                                                                                                                                                                               |
| Private test mode | On the development server and the production build: <ul><li>no password: 401 and noindex</li><li>wrong password: 401</li><li>right password: 200 and noindex</li><li>robots.txt and `/api/health`: 200</li><li>robots.txt says `Disallow: /`</li></ul>                                   |
| Tests             | 304 passing, including the single admin rule, user groups, deleting an account and the site password check.                                                                                                                                                                              |
| All checks        | `format:check`, `lint`, `typecheck`, `test` and `build` pass.                                                                                                                                                                                                                            |

### Fixed while checking

- **The pitch report printed squeezed onto two pages**, because the admin layout's narrow column applied when printing. Print now uses the full page width, and the report fits on one A4 page.
- **My first page addresses, like `north-perth`, clashed with real suburbs** (North Perth, East Perth, South Perth and West Perth). Someone searching for golf in South Perth wants Como, not Mandurah. They're now `perth-northern-suburbs` and so on.
- **The regional WA page asked "Which public golf courses are in Perth's regional WA?"** Each area now carries its own full wording ("Perth's northern suburbs", "regional WA"), which the course pages' "More golf in ..." link uses too.
- **robots.txt was being fixed at build time.** If the password had been added to Vercel after a build, robots.txt would still have let search engines in. It's now worked out on each request.

## Decisions I made

1. **Groups come from what people can do**, not a separate setting, so a person can't be labelled Club Owner without actually having club access. To make someone club staff, add them on the club's page as before.
2. **Area pages use "northern suburbs" and similar wording**, which is how people search, and they name the main suburbs so a search for "golf Joondalup" can find them.
3. **The SEO pages show only free times BookOn has actually checked**, the same as search. If the worker is off, the page says so rather than showing old times.
4. **The pitch report is a print page, not a PDF file the server makes.** It's simpler, and every browser can save it as a PDF.

## Open issues

1. **Google can only find these pages once the site is public on its real domain.** Until then, private test mode keeps them out on purpose. On launch, submit the sitemap in Google Search Console (on the launch checklist).
2. **The pages are only as good as the times behind them.** With the worker off, they show "no times right now". Hosting the worker comes first.
3. **The site still uses info@bookon.com.au and bookon.com.au** in emails, the footer and the user agent. That domain isn't yours. Once bookon.au is registered, tell me and I'll switch everything over.
4. **Please read the page wording** in `apps/web/src/lib/seo-pages.ts` and change anything that doesn't sound right.

## How to demo (on your Mac)

```bash
cd ~/bookon
git pull
pnpm install
pnpm db:dev                                      # window 1, keep running
caffeinate -i pnpm dev:worker                    # window 2, keep running
BOOKON_ADMIN_EMAIL=<your email> pnpm dev         # window 3
```

- **Pages for Google:** open http://localhost:3000/golf, or "Golf in Perth" in the footer.
- **Users and the pitch report:** sign in with your email (the link is in http://localhost:3000/dev/outbox).
  - Open **Admin → Users**.
  - Open **Admin → Settings** and fill in the pitch contact.
  - Open **Admin → Reports → Pitch report**, pick a course, then **Print or save as PDF**.
- **Private test mode:** stop `pnpm dev` and start it again as `BOOKON_SITE_PASSWORD=test pnpm dev`. The browser asks for a password: type anything as the user name and `test` as the password.
