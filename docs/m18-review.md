# Milestone 18 review: motion and loading

20 October 2026. You asked for subtle animations on buttons, and a smart loader whenever there's a delay, built around the logo.

You also set the order for what's next:

| Milestone | What                                                                       |
| --------- | -------------------------------------------------------------------------- |
| 19        | Special rates and group sessions                                           |
| 20        | Club events: entry and payment, start sheets, "Open competitions near you" |
| 21        | Match play manager                                                         |
| 22        | Launch                                                                     |

Each club milestone adds its piece to the For golf clubs page once it's built. Handicapped competitions, which need Golf Australia's approval, are set aside. All of this is recorded in SPEC.md, CLAUDE.md and the launch checklist.

## What was done

### Buttons

- **Pressed:** buttons and tappable chips dip slightly (3%), so a tap feels like a tap on a phone.
- **Hover (computers with a mouse):** green buttons, including every **Book**, lift a pixel with a soft shadow and a slightly richer green.
- **Colour changes fade** (150 ms) rather than snap, for example when picking players or a day on the tee sheet.
- **Off for "reduce motion".** People who've asked their phone or computer to reduce motion get no movement and no fades.

### Loaders

- **The logo loader** ([desktop](./m18/m18-loader-desktop.png), [phone](./m18/m18-loader-phone.png), [frames](./m18/m18-loader-frames.png)):
  - When a page takes more than a moment, the BookOn logo appears with the ball rolling across the green and dropping into the hole, and the flag gently waving.
  - It fades in after 0.2 seconds, so quick pages never flash it.
  - It's drawn from the logo itself, in the logo's own colours, and it's used for every page now, replacing the grey placeholder blocks.
- **A progress line** ([screenshot](./m18/m18-progress-line.png)) for changes within a page, like a tee sheet filter or another day. If the next page takes longer than 0.3 seconds, a thin green line appears along the top with a small ball rolling along it. It clears as soon as the page shows.
- **Buttons that send something** ([screenshot](./m18/m18-button-waiting.png)): Book and pay, Accept, Save, Sign in and the rest.
  - Once pressed, the label gives way to a small ball rolling side to side until the next page shows.
  - **A second press is ignored**, so nothing is booked, charged or emailed twice.
  - Buttons that save and stay on the same page (like the favourite star) clear as soon as the site answers.

## Checked

| Check                          | Result                                                                                                                                                                             |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Logo loader (production build) | With the page slowed to 3 seconds, the loader was invisible at 0.1 s and fully shown by 0.8 s, then the course page replaced it. Phone and desktop.                                |
| Progress line                  | Showed on a slowed course link and a slowed tee sheet filter, and cleared once the page loaded.                                                                                    |
| Waiting buttons                | The sign-in button showed the rolling ball and "busy" for screen readers. **Pressing twice sent one request.** The favourite star cleared after saving and could be pressed again. |
| Hover and press                | Book lifted 1 pixel on hover.                                                                                                                                                      |
| Reduce motion                  | No movement or transitions at all.                                                                                                                                                 |
| Page errors                    | None.                                                                                                                                                                              |
| Tests                          | 380 passing. Nothing new to unit test here: it's styling and browser behaviour, checked in the browser as above.                                                                   |
| All checks                     | `format:check`, `lint`, `typecheck`, `test` and `build` pass.                                                                                                                      |

### Fixed while checking

- **The progress line didn't appear at first.** Next's links cancel the browser's normal link handling before my code saw the click. It now listens a step earlier.
- **Buttons that save without leaving the page would have stayed "waiting" for 20 seconds.** They now clear when the site answers.
- **The ball on the progress line was half cut off** at the top of the window. The line now sits 3 pixels lower.

## Decisions I made

1. **Delays before showing anything:** 0.2 seconds for the logo loader and 0.3 seconds for the progress line, so fast pages feel instant.
2. **The logo loader replaces the grey placeholder pages** everywhere, for one consistent look.
3. **A waiting button gives up after 20 seconds** (say, if the connection drops), so it can be pressed again.
4. **I left out the arrow** I mentioned for the Book button, as Book has no arrow today. The lift on hover does the same job. Easy to add if you'd like one.

## Open issues

1. **In development (`pnpm dev`) the logo loader rarely shows**, because Next only fetches loading screens ahead of time in a production build. On the hosted site it works as tested. The progress line and waiting buttons work either way.
2. **The loader uses the logo's own colours** in dark mode too, the same as the app icon.

## How to demo (on your Mac)

```bash
cd ~/bookon
git pull
pnpm db:dev                                      # window 1
caffeinate -i pnpm dev:worker                    # window 2
BOOKON_ADMIN_EMAIL=<your email> pnpm dev         # window 3
```

- **Buttons:** hover and press Book on any course's tee sheet.
- **Waiting buttons:** on http://localhost:3000/signin, press Sign in twice quickly. Only one email arrives in the outbox.
- **Logo loader**, which needs a production build:
  - Stop window 3, then run `pnpm build && cd apps/web && BOOKON_SITE_URL=http://localhost:3000 npx next start`.
  - Open http://localhost:3000/courses and pick a course. In Chrome, DevTools → Network → "Slow 4G" makes it easy to see.
