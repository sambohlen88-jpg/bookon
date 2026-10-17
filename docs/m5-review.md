# Milestone 5 review: installable app, push notifications and speed

17–18 October 2026, built overnight. The owner approved the plan as proposed: push alongside email with both on by default, a placeholder icon, and iPhone push testing once the site is hosted.

## What was done

### Installable app

- **Add to home screen.** BookOn has an app manifest (name, icons, BookOn green, opens full screen). On a phone it can sit on the home screen and open like an app, with no App Store.
- **Placeholder icon.** A golf flag on BookOn green, in [`apps/web/public/icons`](../apps/web/public/icons). It's easy to swap for a real logo: replace the images in that folder (and `apps/web/src/app/icon.svg` and `apple-icon.png`, which browsers use for tabs).
- **Install banner.** Never on a first visit. It appears after a golfer sets an alert, or when they come back.
  - Android and desktop Chrome get an **Add** button.
  - iPhone gets the two steps (Share, then **Add to Home Screen**), as Apple has no install button.
  - **Not now** keeps it away for a month. [Screenshot](./m5/m5-install-ios.png).
- **Offline page.** With no connection, BookOn says so instead of showing saved tee times, which could already be booked. [Screenshot](./m5/m5-offline.png).

### Push notifications

- **Turning it on.** A **Notifications** section on the account page turns them on or off for this device, and lists the devices they're on. It's also offered right after a golfer sets an alert. [Screenshot](./m5/m5-push-offer.png).
  - Blocked notifications get an explanation instead of a broken button.
  - On an iPhone not yet on the Home Screen, it explains to add BookOn first.
- **Per alert: email, push or both.** Each alert on the account page has **Tell me by: Email, Push**. Turning notifications on switches push on for all the golfer's alerts, keeping email too. One channel always stays on. [Screenshot](./m5/m5-account.png).
- **Same rules as email.** Each time is sent once, at most one notification per alert an hour, and pause and stop work the same.
- **What the golfer sees.** For example, "New tee time: Collier Park Golf Course / Sun 18 Oct 7:30 am · 18 holes · 4 spots · $40", or "3 new tee times". A newer notification for the same alert replaces the old one.
- **Tapping it** opens the alert's page with those times and **Book** buttons. Times that have gone since are marked **Gone**. It works without signing in. [Screenshot](./m5/m5-push-opens.png).
- **No one misses out.** If push was the only channel and no device took it, the worker emails instead. Devices the push service says are gone (app removed, notifications blocked) are deleted.
- **Keys.** Push messages are signed with a key pair. Locally one is made and kept in the database automatically. Production needs `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` (`pnpm push:keys` makes a pair). There's no account to sign up for.

### Speed

Measured on the production build with live data for 25 courses (median of 5).

| Page                                | Before                              | After                      |
| ----------------------------------- | ----------------------------------- | -------------------------- |
| One day, all courses (1,946 times)  | 599 ms, 1,930 KB (61 KB compressed) | **215 ms, 625 KB (32 KB)** |
| One day, 6 to 10 am                 | 222 ms, 897 KB                      | **128 ms, 432 KB**         |
| 14 days, all courses (18,431 times) | 658 ms, 2,192 KB (70 KB)            | **342 ms, 559 KB (29 KB)** |
| 14 days, one course                 | 58 ms, 116 KB                       | **54 ms, 100 KB**          |
| Home                                | 34 ms, 48 KB                        | 40 ms, 48 KB               |

Lighthouse (phone on slow 4G, simulated):

| Page                 | Performance | Accessibility | Best practices | Largest content shows | Total download |
| -------------------- | ----------- | ------------- | -------------- | --------------------- | -------------- |
| Home                 | 99          | 100           | 100            | 1.6 s                 | 131 KB         |
| One day, all courses | 95          | 100           | 100            | 2.4 s                 | 215 KB         |
| 14 days, all courses | 95          | 100           | 100            | 2.4 s                 | 207 KB         |

**What changed.**

- **The time-of-day filter runs in the database,** so times outside the golfer's window are never fetched.
- **Results are grouped per course in one pass,** instead of rescanning every time for each course.
- **Fewer rows on big searches.** Rendering about 950 rows was most of the time, as the database query itself takes 31 ms.
  - One day, many courses: 6 times per course with 10 more behind **Show more**, then **See all N times** for that course (was 40 more).
  - Several days, many courses: the first 3 days per course, then a link to that course's other days.
  - A search for one course still lists everything.
- **Shorter markup per tee time row** (shared CSS classes instead of long style lists), as each row is sent twice: once as the page and once as React's page data.

## Checked

| Check                              | Result                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tests                              | 167 passing. New ones cover push encryption and signing, gone devices, the push message wording, devices moving between accounts, channel rules, push-only alerts falling back to email, and the latest-times page data                                                                                                                                                                                                                            |
| Browser (Android and iPhone sizes) | Manifest and icons served; service worker running; offline page shown with no connection; install banner on second visit only, gone after **Got it**; push offered after setting an alert; a device saved through the site's API showed on the account page; email and push toggles, with the last one locked on; a push delivered to the service worker showed as a notification; the page a notification opens listed the new time with **Book** |
| Security                           | The device API refuses other sites (403) and push addresses that aren't https push services (400). A notification can only open BookOn pages                                                                                                                                                                                                                                                                                                       |
| Milestone 4 flow                   | Re-run end to end: sign in, star, alert, email, click, pause, clear, delete                                                                                                                                                                                                                                                                                                                                                                        |
| All checks                         | `format:check`, `lint`, `typecheck`, `test` and `build` pass                                                                                                                                                                                                                                                                                                                                                                                       |

## Not tested here

- **A real subscription.** Chrome subscribes through Google's push service, which this build environment can't reach. Everything after that step was tested, but you should try it on your Mac (below).
- **iPhone push.** Apple only allows it from a Home Screen app on an https site, so it waits for hosting. Added to the launch checklist.

## Decisions I made

1. **The icon is a golf flag, not a "B".** A flag reads better at small sizes. It's a placeholder either way.
2. **Push falls back to email** when it was the only channel and reached no device, rather than staying silent.
3. **Notifications expire after 2 hours** if the phone is off. A tee time from yesterday isn't news.
4. **The service worker only does the offline page and push.** It never caches pages or tee times, so it can't show an old time as free.
5. **The push page works without signing in,** like the email manage link, so tapping a notification always shows the times.
6. **Fewer rows on big searches** (see Speed). Golfers can still reach every time through the per-course links.

## Open issues

1. **Real logo.** Swap in the brand when it's ready; it feeds the app icon too.
2. **VAPID keys** for production, and an iPhone test once hosted (launch checklist).
3. **The "back/forward cache"** Lighthouse check fails because search pages are never cached. That's deliberate, as times change by the minute, and the refresh bar covers going back to an old page.

## How to demo (on your Mac)

```sh
git pull && pnpm install                   # web-push is new
pnpm db:dev                                # keep running
pnpm db:seed                               # new tables
pnpm --filter @bookon/worker poll
pnpm dev
```

1. In Chrome, open http://localhost:3000, sign in (the link is at /dev/outbox), and set an alert from a search.
2. Under **Want to hear even faster?** press **Turn on notifications** and allow them.
3. On **My account**, the device shows under **Notifications**, and the alert shows **Email** and **Push**.
4. To see a notification without waiting for a cancellation, open Chrome's DevTools, then **Application**, then **Service workers**, and press **Push** with this text:
   `{"title":"New tee time: Collier Park","body":"Sun 7:30 am · 4 spots","url":"/account","tag":"test"}`
5. For a real one, leave `pnpm dev:worker` running. When a new time matches, you'll get a notification and an email in the outbox.
6. Chrome's install icon in the address bar adds BookOn as an app on your Mac.
