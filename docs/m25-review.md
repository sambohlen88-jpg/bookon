# Milestone 25 review: navigation

26 October 2026. You asked for a wider header, the logo to go home instead of a "Find a tee time" link, your own areas pushed to the right, and an Apple-style menu that drops down from the top, on desktop and phones. You approved my plan, keeping the phone's bottom menu bar and the groupings as proposed. Launch is now Milestone 26.

**About the screenshots:** they're from my local database, signed in as you (Admin) unless they show "Sign in". The featured "Latest" article in the News menu is a test article.

## What was done

### Desktop

[Closed](./m25/m25-desktop-1440-closed.png), [scrolled down](./m25/m25-desktop-scrolled.png)

- **A wider header** (up to 1440 pixels) that **stays at the top while scrolling**.
- **The logo on the left goes home**, where the tee time search is. "Find a tee time" is now in the Courses menu instead.
- **Five sections in the middle:** Courses, Competitions, Coaching, News, For golf clubs.
- **On the right:** your areas (Admin, My club, My coaching, or Write for authors), then **My account**, or **Sign in**. Each person only sees what they have.

### The dropdowns

[Courses](./m25/m25-desktop-panel-courses.png), [Competitions](./m25/m25-desktop-panel-competitions.png), [Coaching](./m25/m25-desktop-panel-coaching.png), [News](./m25/m25-desktop-panel-news.png), [For golf clubs](./m25/m25-desktop-panel-for-golf-clubs.png)

- **Hover over or click a section** and a panel slides down from the header, the full width of the page, with its links in columns. Each link has a short line underneath.
- **The page behind dims.**
- **Competitions shows the next open event, and News the latest article**, the way Apple features things.
- **Closing:** move away, press Esc, or click the dimmed page. A click keeps a hover-opened panel open until you click again, so it doesn't snap shut under your mouse.
- **Between 1024 and 1280 pixels wide**, your areas fold into a small **My account** dropdown, so nothing overflows ([1024 wide](./m25/m25-desktop-1024-account.png), [1280 wide](./m25/m25-desktop-1280-account.png)).

| Menu           | Links                                                                                              |
| -------------- | -------------------------------------------------------------------------------------------------- |
| Courses        | Find a tee time, All courses, Simulators and driving ranges, Tee time alerts, Golf in Perth guides |
| Competitions   | All competitions, Match play                                                                       |
| Coaching       | Find a coach, Group sessions, List your coaching                                                   |
| News           | Latest news, Course news, Tips and how-to, Competitions, Around Perth, Gear                        |
| For golf clubs | Why BookOn, List your club, Run your events, Run your match play                                   |

### Phones and tablets

[Phone](./m25/m25-phone-closed.png), [menu open](./m25/m25-phone-menu.png), [Courses](./m25/m25-phone-menu-courses.png), [tablet](./m25/m25-tablet-closed.png), [tablet menu](./m25/m25-tablet-menu.png)

- **The logo on the left, and a menu button** (two lines that turn into a cross) on the right.
- **Tap it and the menu drops down from the top** over the whole screen, with the five sections in large text.
- **Tap a section and it slides across to its links**, with a back arrow, as on Apple's site.
- **Your areas and My account (or Sign in) are at the bottom** of the menu.
- The page behind doesn't scroll while the menu's open, and choosing a link closes it.
- **The bottom menu bar on phones stays** (Find, Courses, Coaches, Alerts, Account).

### Behind the scenes

- **It works with the keyboard and screen readers.** The section buttons say whether they're open, hidden menus are out of the tab order, and Esc closes.
- **The sliding is off for anyone with "reduce motion" switched on.**
- **Things that stay pinned on screen now sit below the header:** the search sidebar, the booking boxes on course and coach pages, and the tee sheet's hour headings. Jumping to a part of a page stops below it too.
- **The For golf clubs page** has anchors for the events and match play sections, for the menu's links.

## Checked

| Check               | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser walkthrough | <ul><li>Desktop at 1440, 1280 and 1024 wide, signed in and signed out: every dropdown opened on hover. Moving away closed it.</li><li>With the keyboard, Enter opened a menu and Esc closed it.</li><li>Clicking "All courses" went there and closed the menu.</li><li>The header stayed at the top when scrolled.</li><li>At 1024 wide your areas folded into My account, with no sideways scrolling.</li><li>On a phone, the menu opened, Courses slid across to its links, the back arrow returned, and "Tips and how-to" went to that news category and closed the menu.</li><li>A signed-in author saw Write and My account in the menu.</li><li>The tablet menu opened.</li><li>No page errors.</li></ul> |
| Tests               | 506 passing (2 new): the menu's five sections, that each has links, and that every link is a BookOn page.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| All checks          | `format:check`, `lint`, `typecheck`, `test` and `build` pass.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

### Fixed while checking

- **The dimmed background didn't show**, because the header's frosted-glass effect trapped it inside the header. The header is now solid white (dark in dark mode).
- **Hovering then clicking closed the menu**: hover opened it, then the click shut it. A click now keeps it open.
- **The build hung on pages built ahead of time** (like Golf in Perth), because the header looked up the featured event and article from the database while building. The dropdowns now fetch those the first time a menu opens, so pages don't need the database to build.
- **The phone menu shared its screen-reader name with the bottom menu bar.** It's now "Site menu".

## Decisions I made

1. **Section names open their dropdown rather than going to a page.** Every dropdown has the section's main page as its first link (for example All courses), so it's one more click, but phones and keyboards work the same way.
2. **The header stays at the top while scrolling** on every screen, so the menu is always in reach. It's 56 pixels tall on phones and 72 on desktop.
3. **The dropdown panels are white with a soft shadow**, not frosted glass. Frosted glass breaks the dimmed background.

## Open issues

1. **The featured items** in the dropdowns only show the next competition and latest article. Courses, Coaching and For golf clubs have none. Featured courses or coaches could come later.
2. **On phones, the header now stays at the top while scrolling**, as well as the bottom menu bar, so there's a little less room for the page. If that feels cramped, I can make the header hide while scrolling down and come back when scrolling up, as many apps do.

## How to see it (Mac Terminal)

```bash
cd ~/bookon
git pull
pnpm db:dev                                                   # window 1
BOOKON_ADMIN_EMAIL=sambohlen88@gmail.com pnpm dev             # window 2
```

Open http://localhost:3000. Hover over the sections in the header. Make the window narrow (or use your phone on the same Wi-Fi) to see the menu button.
