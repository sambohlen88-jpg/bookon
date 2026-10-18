# Launch checklist

Things that must be done before BookOn launches publicly (SPEC section 11, Milestone 11). Claude Code is asked, in `CLAUDE.md`, to raise these with the owner before any launch work.

## Platform access (owner asked to be reminded)

Data is read from public booking pages with the owner's approval, ahead of formal permission. Before full launch, get verified access or written permission from each platform:

- [ ] **MiClub** (Perth, owned by Northstar). Ask for read access to the live feed that powers TeeNet. Covers Collier Park, Fremantle Public, Whaleback, Wembley and other MiClub courses.
- [ ] **Sagacity Golf** (Quick18). Ask for API or feed access. Covers Hamersley.
- [ ] **Lightspeed Golf** (Chronogolf), only if a BookOn course turns out to use it. Apply for the [Partner API](https://partner-api.docs.chronogolf.com/). The Chronogolf pages for Marangaroo, The Cut and Point Walter now return 404, so they may be on MiClub instead.
- [ ] **Wembley** (Town of Cambridge). Its timesheets are behind a CAPTCHA; it stays switched off until the club gives permission or a feed.

## Other data sources (Milestone 10)

- [ ] **Course locations.** Run `pnpm courses:locate`, check each link it prints, then `pnpm courses:locate -- --save` and commit `packages/db/src/course-locations.ts`. Until then Near me stays hidden and there's no weather. Fix any course in admin (Courses → the course → Latitude and Longitude).
- [ ] **Weather.** Check the worker logs `[weather] N updated` on the host. MET Norway asks that our user agent names us and gives a contact (it does: `BOOKON_CONTACT_EMAIL`), and that the credit "Weather from MET Norway" stays wherever forecasts show.
- [ ] The privacy policy mentions Near me: the phone's location is rounded to about a kilometre, used for that search only and never saved.

## Business and legal

- [ ] Create the **info@bookon.com.au** mailbox. It is already in the worker's user agent, so clubs may write to it.
- [ ] Domain and brand.
- [ ] **Club listing terms and approvals** (the wording on the onboarding Approvals step, in `packages/db/src/clubs.ts`), reviewed by a lawyer. Changing the wording means bumping `CONSENTS_VERSION`.
- [ ] Decide who reviews new club listings and how fast. The pages promise clubs "usually within a week".
- [ ] Privacy policy and terms pages, reviewed by a lawyer (Spam Act 2003 and Australian Privacy Principles; SPEC section 10). They must cover accounts (email address, favourites, alerts, the list of tee times looked at) and how to delete an account.

## Hosting and operations

- [ ] Hosting: Vercel (website), a hosted Postgres such as Supabase or Neon, and Railway or Fly for the worker.
- [ ] The worker running on a schedule, so results stay fresh.
- [ ] `BOOKON_SITE_URL` set on the website host and the worker. Without it, signing in, starting a club listing and sharing times fail on purpose, as emailed links must never use an address taken from the request.
- [ ] `BOOKON_ADMIN_EMAILS` set on the website host to the people who run BookOn. Nobody can open the admin area without it.
- [ ] `BOOKON_OWNER_EMAIL` set to whoever reviews new club listings (otherwise they go to info@bookon.com.au).
- [ ] `CLICK_SIGNING_SECRET` set on the website host **and** the worker, the same value on both (`openssl rand -base64 32`). Without it, Book clicks still work but aren't tracked.
- [ ] **Email sending (Postmark).** Until then, sign-in links and alerts go to the local outbox only, so nobody can sign in on a hosted site.
  - Sign up at postmarkapp.com and create a server. Copy its Server API token.
  - Add bookon.com.au as a sender domain and add the DKIM and Return-Path DNS records Postmark shows. Add a DMARC record if the domain has none.
  - Ask Postmark to approve the account for sending to anyone (new accounts can only email their own domain).
  - Set `EMAIL_PROVIDER=postmark`, `POSTMARK_SERVER_TOKEN`, `EMAIL_FROM` and `BOOKON_SITE_URL` on the website host and the worker.
- [ ] **Push notification keys.** Run `pnpm push:keys` once and set `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` on the website host and the worker. Never change them after launch: every golfer's notifications would stop until they turn them on again.
- [ ] **Test sharing on a real iPhone** once the site is on https: search, tap Share, then Send picture. The share sheet should open with the picture attached. Paste a share link into Messages and check the preview shows the times.
- [ ] **Test push on a real iPhone** once the site is on https: add BookOn to the Home Screen, open it from there, turn on notifications, set an alert.
- [ ] Error monitoring (Sentry), uptime checks, rate limits on public pages, database backups.

## Product

- [ ] Milestones 3 to 7 done, or explicitly deferred by the owner.
- [ ] Course coordinates entered, if the distance filter is wanted at launch.
