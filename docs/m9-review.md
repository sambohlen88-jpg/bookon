# Milestone 9 review: share tee times with mates

18 October 2026. The owner approved the plan, keeping the picture as the main option:

- Links freeze what was shared and cross out times booked since.
- Whole searches are shared, and each course has its own share button.
- Prices are shown where we know them.

Hardening and launch move to Milestone 10 (recorded in SPEC.md).

## What was done

### The Share button

- **Share** sits beside the results heading. Each course with times also has a small share icon, for sharing just that course.
- Tapping it opens a panel with a preview of the picture and three options:
  - **Send picture:** a one-screen picture of the times for the group chat. [Example](./m9/m9-picture.png).
  - **Send link:** a link to a page showing the same times. [Screenshot](./m9/m9-shared-page.png).
  - **Copy as text:** a plain list to paste anywhere.
- On a phone, picture and link open the phone's share sheet (Messages, WhatsApp and so on). On a computer, the picture downloads and the link copies. [Phone](./m9/m9-phone-share.png), [desktop](./m9/m9-desktop-share.png).
- Anyone can share without signing in.

### The picture

- Sized to fit one phone screen (1080 pixels wide, at most 1920 tall).
- It shows:
  - the date, players, time window, holes, and how many times were found;
  - each course with its suburb, price and its earliest times;
  - "+N more" where there are more;
  - the link and the time the times were found.
- Courses that don't fit are counted at the bottom ("+4 more courses on the link").
- Longer searches show the first two days per course.
- When a club starts groups off two tees at the same time, the time shows once.
- A share of one course shows up to 15 of its times.

### The link

- The link is `/s/<code>`, and the code can't be guessed. It holds no names or emails. It stops working a week after the last day searched, and the worker deletes it then.
- When a mate opens it:
  - times booked since are crossed out and marked **Gone**, and times that have passed count as gone;
  - if we couldn't check a club recently, the page says so rather than guessing;
  - **See latest times** reruns the search, and **Pass it on** shares it again.
- In a chat, the link preview shows the first four courses and their times. [Example](./m9/m9-link-preview.png).
- Search engines are asked not to list share pages.

### The text

```
Tee times for Mon 19 Oct
4 players · 6:00 am to 10:00 am · 18 holes

Marangaroo Golf Course: 6:10 am, 6:18 am, 6:26 am, 6:42 am, 8:50 am ($40)
Links Kennedy Bay: 6:14 am, 6:38 am, 6:46 am ($69)
...
https://bookon.com.au/s/iXXPqMYpCss
```

### Reports

- Book clicks from a share are counted as **From shares** in the admin and club reports, the CSV download and `pnpm stats`.
- The club overview shows them as a fourth figure.
- A golfer's previous visits mark them "from shared times".

## Checked

| Check            | Result                                                                                                                                                                                                                                                                            |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser run      | Every step listed below passed.                                                                                                                                                                                                                                                   |
| Production build | The picture and preview render from `next build` / `next start`, with their fonts.                                                                                                                                                                                                |
| Tests            | 213 passing. New tests cover: saving a share and reading it back; expiry and clean-up; the same link for the same search; the hourly limit; empty shares; made-up codes; times trimmed per course; gone, open and can't-check times; the text, titles, prices and repeated times. |
| All checks       | `format:check`, `lint`, `typecheck`, `test` and `build` pass.                                                                                                                                                                                                                     |

The browser run went through:

1. On a phone-sized screen, searched Mon 19 Oct, 6 to 10 am, 4 players: 129 times at 10 courses.
2. Tapped Share. The panel showed the picture.
3. Copy as text put the list above on the clipboard.
4. Send picture opened the picture to press and hold (see "What I couldn't test").
5. A mate opened the link after one time was booked out. That time was crossed out, with "1 of these has gone since".
6. Book went through `/go` to the club, logged as a share click.
7. On a computer, a course's own share button shared just that course. Copy link copied it, Download picture saved `bookon-tee-times-2026-10-19.png`, and Esc closed the panel.
8. A made-up link showed "These times have expired".

## Decisions I made

1. **The picture is drawn by BookOn on the server,** not a screenshot of the page. That way it looks the same on every phone and stays readable in a chat. It uses the Inter font (free licence, in `apps/web/src/fonts`).
2. **Shares are made from the search again on the server,** never from what the browser sends. A share can only hold times BookOn really found.
3. **Light colours only in the picture.** It's sent to other people, whose phones may be in light or dark mode, so it uses the light palette like the course drawings.
4. **Limits:** 30 shares per visitor per hour. Sharing the same search again within 5 minutes gives the same link. Up to 60 times are kept per course, and the link sends mates to the full search for the rest.
5. **The link page is open to anyone with the link,** like a shared photo. It holds nothing private.

## What I couldn't test

- **Sending the picture straight from the iPhone share sheet.**
  - iPhones only allow this on a secure (`https://`) site, so it can only be tried once BookOn is hosted. That's on the launch checklist.
  - Until then, on a phone it opens the picture to press and hold, which is what the test above did.
  - The code uses the standard Web Share feature that Safari supports on iOS 15 and later.
- **Link previews in Messages and WhatsApp.** Those apps can't reach your computer, so the preview can only be checked once the site is hosted. The preview picture itself is tested above.

## Open issues

1. Links only work for mates once BookOn is hosted (Milestone 10). Until then they point to your computer.
2. Times found with a "My courses only" search are shared like any other search. Mates who open the link see those times, but not your favourites.

## How to demo (on your Mac)

```sh
git pull && pnpm install
pnpm db:dev                                # keep running
pnpm db:seed                               # new table
pnpm dev:worker                            # keep running
pnpm dev
```

1. Search at http://localhost:3000, then press **Share** beside the heading.
2. Try **Download picture**, **Copy link** and **Copy as text**.
3. Open the copied link in a private window: that's what your mates see.
4. On your phone, on the same wifi, open `http://<your Mac's name>.local:3000`, search and tap Share. **Send picture** opens the picture to press and hold, until the site is on https.
