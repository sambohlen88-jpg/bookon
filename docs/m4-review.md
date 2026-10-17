# Milestone 4 review: accounts, favourites and alerts

17 October 2026. Plan approved by the owner the same day, with two changes from the spec: **previous visits** instead of bookings (BookOn can't see bookings), and **email sign-in links** instead of passwords. Email goes to a local outbox until Postmark is set up.

## What was done

- **Sign in by email link.** No passwords. The golfer enters their email and gets a link. The same link sets up an account the first time.
  - Links work once and expire after 15 minutes. One address can be sent at most 5 links an hour.
  - Opening the link shows a **Sign in** button rather than signing in straight away. Email scanners that open links can't use up the link or sign in for the golfer.
  - A device stays signed in for 90 days. The cookie holds a random token; the database keeps only its hash.
  - After signing in, the golfer goes back to where they were (for example, the search they were starring courses on).
  - [Screenshot](./m4/m4-signin.png).
- **Favourite courses.** Every course in the results has a star. Signed out, the star leads to sign in. Starred courses show on the account page with **Search my courses**. The search form gets a **My courses only** tick box once a golfer has starred any. [Screenshot](./m4/m4-search-star.png).
- **Alerts.** Below the results, or on an empty search, **Tell me when a time opens up** saves the search as an alert (signing in first if needed).
  - Times showing when the alert is set count as already seen, so the golfer only hears about new ones, like cancellations.
  - Each tee time is emailed once, ever. An alert sends at most one email an hour; times found in between go in the next one.
  - At most 10 alerts per golfer. Alerts end by themselves once their last day has passed.
  - The worker checks alerts after every poll. `pnpm alerts` checks them on their own, from times already stored.
  - Book links in the email are tracked like search ones and count as **alert clicks** in `pnpm stats` and club reports.
  - [Screenshot](./m4/m4-alert-email.png).
- **Every alert email has a manage link** that works without signing in, to pause or delete the alert (Spam Act). Each email also says who sent it and why.
- **Account page.** Favourites, alerts (pause, turn back on, delete), tee times looked at, sign out, and delete account. [Screenshot](./m4/m4-account.png).
  - **Tee times you've looked at** lists the times the golfer clicked **Book** on, newest first, with **Search again**. It includes clicks from this device made before signing in. **Clear this list** forgets them.
  - **Delete my account** needs a tick to confirm. It removes the email address, devices, favourites and alerts. Clicks stay in club reports with no link to the golfer.
- **Email.** A new `packages/email` package holds the templates (sign-in and alert, plain text and HTML), a local outbox and Postmark sending. Locally, every email goes to the outbox at http://localhost:3000/dev/outbox, which is switched off in production. Set `EMAIL_PROVIDER=postmark` and a token to send for real.

## Checked

| Check                                             | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tests                                             | 154 passing. New ones cover sign-in links (one use, expiry, rate limit, safe redirects), sessions, favourites, visits, deleting an account, alert baselines, once-per-slot, the hourly gap, alert expiry, the 10-alert limit, the worker sending and retrying, and both email templates                                                                                                                                                                                                                                     |
| Browser run (live Collier Park times, phone size) | Starred a course signed out (sent to sign in and back); signed in from the outbox link; opening the link alone didn't sign in; starred a course; **My courses only** showed only it; set an alert; the worker emailed a new time once and not again; the email's Book link was tracked and reached Collier Park; the account page listed the favourite, the alert and both visits, including the click from before sign-in; the manage link paused the alert from a signed-out browser; cleared visits; deleted the account |
| All checks                                        | `format:check`, `lint`, `typecheck`, `test` and `build` pass                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

## Bugs found and fixed while checking

1. **Deleting an account failed after clicking a link in an alert email.** The click pointed at the email's record, which is deleted with the account. Clicks now keep counting but drop that link (migration `0002`).
2. **The local database mixed up queries from the same page.** The page header (signed in or not) and the results now load at the same time, and PGlite's server is a single database session. The website and worker now use one connection each to the local server. Hosted Postgres is unaffected.

## Decisions I made

1. **Sign-in needs a button press**, so link scanners in work email systems don't break sign-in.
2. **Visits are clicks on Book**, not bookings. The page says BookOn can't see whether the golfer booked.
3. **Once per slot, ever.** A time that was booked and then freed again isn't re-sent. This keeps emails rare. Easy to change if golfers want repeats.
4. **The hourly cap holds back, never drops.** Times found within the hour wait for the next email.
5. **A failed send isn't recorded,** so the same times go out on the next try.
6. **No signing secret means direct club links in emails,** the same fallback as the search page.
7. **Sign-in links use `BOOKON_SITE_URL` in production,** never the request's address, so a forged request can't put another site's link in a BookOn email. Locally they use wherever the site is running.

## Not done (as planned)

- Web push: Milestone 5.
- Real email sending: needs the owner's Postmark account (see below).
- Rate limits by IP address and other abuse protection: Milestone 7.

## Open issues

1. **Postmark.** Sign up, add bookon.com.au as a sender domain (DNS records), and ask Postmark to approve sending to anyone. Steps are in [`launch-checklist.md`](./launch-checklist.md). Until then, nobody can sign in on a hosted site.
2. **The info@bookon.com.au mailbox** is now also the email sender. It needs to exist before launch.
3. **Sign-in link limits are per address.** Someone could still request one link each for many different addresses. IP rate limits in Milestone 7 cover this.
4. **No "sign out everywhere".** Deleting the account does it. Can add if wanted.
5. **The privacy policy** (Milestone 7) must cover accounts, alerts and the visits list.
6. **Still waiting on you:** the region filter question, and the Quick18 checks for The Springs and Lake Claremont on your Mac.

## How to demo

```sh
pnpm db:dev                                # keep running
pnpm db:seed                               # applies the new tables
pnpm --filter @bookon/worker poll          # fresh times
pnpm dev
```

1. Open http://localhost:3000, search, and tap a star. Enter any email address.
2. Open http://localhost:3000/dev/outbox, click the link in the email, then press **Sign in**.
3. Star a course, then set an alert from the results.
4. Run `pnpm alerts`. Nothing is sent, as every time showing was already seen. New times appear when clubs release or free up times, so run the worker again later (or leave `pnpm dev:worker` running) and check the outbox.
5. Visit **My account** to see favourites, alerts and tee times you've clicked Book on.
