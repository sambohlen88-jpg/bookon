# Milestone 6 review: the full website

18 October 2026, built overnight. The owner's brief: "make it a full website instead of app looking. For mobile keep it as it is. But for desktop … some images of the courses. A bigger section for logo etc."

This replaces the spec's original Milestone 6 (club reporting and admin), which moves to Milestone 8. Recorded in `SPEC.md` section 11.

## What was done

- **Desktop header.** The logo mark and name, links to **Find a tee time** and **Courses**, and **Sign in** or **My account**. Phones keep the simple header.
- **Desktop home page.** [Screenshot](./m6/m6-home-desktop.png), [dark mode](./m6/m6-home-dark.png).
  - **Hero:** a dark green band with a large logo, the headline "Every Perth public tee time, in one search.", the course count, how far ahead times go, and "$0 booking fees". The search form sits in a card on the right, over a drawn landscape.
  - **How it works:** three steps, ending with booking on the club's own page.
  - **Courses we check:** eight courses with pictures, and a link to all 26.
  - **Never miss a cancellation:** sells alerts, with sample notifications.
- **Phones see the same home page as before:** heading, search form, course list. [Screenshot](./m6/m6-home-phone.png).
- **Courses page** (`/courses`). Every course with its picture, grouped by area: Perth, Peel, South West, Great Southern, Mid West, and Pilbara and Kimberley. [Screenshot](./m6/m6-courses-desktop.png).
- **A page for each course** (`/courses/collier-park` and so on). [Desktop](./m6/m6-course-desktop.png), [phone](./m6/m6-course-phone.png).
  - A wide picture, the suburb, area and holes.
  - How many times are free each day this week, each day linking to its search.
  - **See tee times**, **Go to the club's booking page** (tracked as a "directory" click for club reports) and the club website.
  - Course details for Google (structured data), and a sitemap listing every course page.
- **Desktop search.** The search form stays open in a sidebar. Each course has a small picture, and times show in two columns. Course names link to their course page. [Screenshot](./m6/m6-search-desktop.png).
- **Sign-in, account and alert pages** are wider on desktop.
- **A footer on every page.** Links, the contact email, and that golfers book and pay with the club.

## Course pictures

**I didn't copy photos from club websites.** They belong to the clubs or their photographers, and using them without permission would be a copyright problem.

Instead, every course has a **drawn landscape** in the feel of its area: coast for Secret Harbour, The Cut, Albany and Geraldton; river for Point Walter, Maylands and Pinjarra; lakes for Joondalup and Dunsborough Lakes; red earth for Karratha and Broome; bushland or parkland for the rest.

- Each is different (time of day, hills, trees, where the flag is) and always the same for that course.
- They switch to night colours in dark mode.
- Course pages are labelled "Illustration", and the courses page says the pictures are drawings.

**Real photos come next.** The club onboarding page (Milestone 7) lets clubs upload their own photos and confirm they own them. Once you approve one, it replaces the drawing.

## Checked

| Check               | Result                                                                                                                                                                                                                                    |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lighthouse, phone   | Home, courses and a course page: Performance 100, Accessibility 100, Best practices 100, SEO 100. Search: Performance 96 (SEO 58, because `robots.txt` keeps search engines out of search results on purpose)                             |
| Lighthouse, desktop | Performance 100 on all four pages; largest content shows in 0.4–0.6 s                                                                                                                                                                     |
| Page weight         | One day, all courses: 37 KB compressed (32 KB before this milestone). Home: 12 KB. Pictures are 2.3 KB each, cached for a year, and never downloaded by phones where they're hidden                                                       |
| Tests               | 176 passing. New ones cover course areas and scenery (and that every seeded course has them), illustrations (same each time, different per course, dark mode, wide version), and the picture route refusing anything but a course picture |
| Earlier milestones  | The Milestone 4 flow (sign in, star, alert, email, click, pause, delete) and the Milestone 5 flow (manifest, offline, push) re-run end to end on the new layout                                                                           |
| All checks          | `format:check`, `lint`, `typecheck`, `test` and `build` pass                                                                                                                                                                              |

## Decisions I made

1. **Drawings, not borrowed photos** (above).
2. **The desktop layout starts at 1024 pixels wide** (laptops and up). Tablets and phones keep the phone layout, apart from the header and footer, which switch at 768 pixels.
3. **Areas live in the website, not the database.** They're only for grouping the courses page. If you want the region filter in search, they'd move to the database as part of that.
4. **Pictures are image files** made by the site, not drawn inside each page. Drawn inside, they added 58 KB to every phone search page.
5. **The search form appears twice in the page** (phone and desktop versions), with only one shown. That's simpler than one form that rearranges itself, and costs a few KB.
6. **Pictures carry their own colours.** CLAUDE.md asks for colours to come from the CSS tokens, but a picture loaded as an image can't see the page's CSS. So its palette (light and dark) lives in `apps/web/src/lib/course-art.ts`, like colours in any image file. CLAUDE.md now says so.

## Open issues

1. **Real logo and brand.** The flag mark and BookOn green are still placeholders. Everything takes its colours from `globals.css`, so a new brand is a small change.
2. **Real course photos** need clubs to supply them (Milestone 7) and your approval.
3. **Region filter:** still your call.

## How to demo

```sh
git pull && pnpm install
pnpm db:dev                                # keep running
pnpm --filter @bookon/worker poll
pnpm dev
```

Open http://localhost:3000 on your Mac with the browser window wide, then narrow it to phone width to see the phone layout. Try **Courses** in the header, then a course.
