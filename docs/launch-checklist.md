# Launch checklist

Things that must be done before BookOn launches publicly (SPEC section 11, Milestone 18). Claude Code is asked, in `CLAUDE.md`, to raise these with the owner before any launch work.

## Platform access (owner asked to be reminded)

Data is read from public booking pages with the owner's approval, ahead of formal permission. Before full launch, get verified access or written permission from each platform:

- [ ] **MiClub** (Perth, owned by Northstar). Ask for read access to the live feed that powers TeeNet. Covers Collier Park, Fremantle Public, Whaleback, Wembley and other MiClub courses.
- [ ] **Sagacity Golf** (Quick18). Ask for API or feed access. Covers Hamersley.
- [ ] **Lightspeed Golf** (Chronogolf), only if a BookOn course turns out to use it. Apply for the [Partner API](https://partner-api.docs.chronogolf.com/). The Chronogolf pages for Marangaroo, The Cut and Point Walter now return 404, so they may be on MiClub instead.
- [ ] **Your Golf Booking** (yourgolfbooking.com, linked with TrackMan). Ask for permission or a feed for the golf sims and ranges: OuttaBounds, Albatross Lounge, Elevate Golf Lounge and Lights Out Golf. The venues themselves could also say yes.
- [ ] **X-Golf** (six WA venues). Its robots.txt blocks the booking pages, so BookOn doesn't read them. If wanted, ask X-Golf for a feed or permission.
- [ ] **Wembley** (Town of Cambridge). Its timesheets are behind a CAPTCHA; it stays switched off until the club gives permission or a feed.

## Other data sources (Milestone 10)

- [x] **Course locations.** All 29 found and checked on 18 October 2026. For a new course, run `pnpm courses:locate` (then `-- --save`), or set it in admin (Courses → the course → Latitude and Longitude).
- [ ] **Weather.** Check the worker logs `[weather] N updated` on the host. MET Norway asks that our user agent names us and gives a contact (it does: `BOOKON_CONTACT_EMAIL`), and that the credit "Weather from MET Norway" stays wherever forecasts show.
- [ ] The privacy policy mentions Near me: the phone's location is rounded to about a kilometre, used for that search only and never saved.

## Coaches (Milestone 12)

- [ ] **The sample coaches never reach a hosted database.** They're only added when the database is local (`isLocalDatabaseUrl`). If a hosted database ever shows "Sample profile", delete those coaches in admin.
- [ ] Decide how PGA membership is checked (PGA of Australia's "Find a PGA Professional", or asking PGA for a way to confirm members), and who does it.
- [ ] Coach listing terms: what coaches agree to when they list, and that BookOn isn't party to lessons. The consent wording is `COACH_CONSENT` in `packages/db/src/coaches.ts`.
- [ ] The privacy policy covers coach contact details shown publicly and the counting of WhatsApp, email and call taps.
- [x] Paying for lessons through BookOn: built in Milestone 15 with Stripe Connect. The items left are under "Lesson payments" below.
- [ ] BookOn's Instagram, Facebook and TikTok addresses entered in Admin, Settings.

## Unbooked tee times (Milestone 13)

- [ ] Before showing unbooked numbers to a club or in a pitch, check how much of the period BookOn checked ("Checked" in Admin, Reports). It only counts while the worker runs, so hosting the worker comes first.
- [ ] Decide whether clubs ever see their own unbooked times. They're admin-only for now.

## Users, pitch report and Google (Milestone 14)

- [ ] **Remove `BOOKON_SITE_PASSWORD`** from the website host on launch day. While it's set, every page asks for a password and search engines are told to keep out.
- [ ] Set the pitch report contact (name, phone, email) in Admin, Settings before printing a pitch for a club.
- [ ] Once the site is on its real domain: add it to Google Search Console, submit `/sitemap.xml`, and check a few `/golf/...` pages with the URL inspection tool.
- [ ] Read the wording on the `/golf` pages (`apps/web/src/lib/seo-pages.ts`) and change anything that doesn't sound like BookOn.

## Lesson payments (Milestone 15)

- [ ] **Stripe account in BookOn's name**, with Connect turned on (Express accounts, Australia). Going live needs your ABN, ID and bank account. Fill in the Connect branding (name, icon, colour) so coaches see "BookOn" during setup.
- [ ] **Try it in Stripe test mode first** on your Mac (steps in `docs/m15-review.md`), including a coach setting up with Stripe's test details and a full book, accept and refund.
- [ ] Set `STRIPE_SECRET_KEY` (live) and `STRIPE_WEBHOOK_SECRET` on the website host and the worker. In the Stripe dashboard, add a webhook to `https://<site>/api/stripe/webhook` for `checkout.session.completed` and `checkout.session.expired`, and a Connect webhook for `account.updated`.
- [ ] **Lesson booking terms** (the coach terms in `LESSON_PAYMENT_TERMS`, `packages/db/src/lessons.ts`, and the golfer's cancellation rule on the booking page) reviewed by a lawyer, including what happens if a coach doesn't turn up. Changing the coach terms means bumping `LESSON_PAYMENT_TERMS_VERSION`.
- [ ] **GST:** check with your accountant whether BookOn's booking fee needs GST (once BookOn is registered) and how Stripe's fees are recorded.
- [ ] Privacy policy: a golfer's name, email and mobile go to the coach they book; Stripe processes card details.
- [ ] Decide who handles disputes and chargebacks (Stripe emails the account owner).
- [ ] Check the fee covers costs: with a $2.50 fee BookOn keeps about 60c on a $90 lesson after Stripe's card fee, less Connect's per-account and payout fees. Change it in Admin, Settings.

## Coach calendars (Milestone 16)

- [ ] **Try a real calendar link on the hosted site** (Google's secret address, an iCloud public calendar and an Outlook published calendar), and subscribe to a coach's BookOn link from an iPhone and from Google Calendar. Calendar apps can't reach a computer at home, so this needs the site hosted (with the site password on, `/calendar/` links still work for calendar apps).
- [ ] Privacy policy: BookOn reads a coach's calendar link for busy times only (start and end), and keeps no event names or details.
- [ ] Coaches' calendar links are private. If a coach's link leaks, they can make a new BookOn link in My calendar, and reset their own calendar's secret address in Google, iCloud or Outlook.

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
- [ ] `BOOKON_ADMIN_EMAIL` set on the website host to your email (one address only). Nobody can open the admin area without it.
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
