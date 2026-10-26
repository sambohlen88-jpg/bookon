# Launch checklist

Things that must be done before BookOn launches publicly (SPEC section 11, Milestone 28). Claude Code is asked, in `CLAUDE.md`, to raise these with the owner before any launch work.

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

## Special rates and group sessions (Milestone 19)

- [ ] **WA holiday dates:** 2027 school term dates were preliminary when added. Check them against the Department of Education's final list, and add 2028 public and school holidays in Admin, Settings once WA publishes them. Until then, 2028 days get the standard price (and the 2027-28 summer holidays stop at 31 December 2027).
- [ ] **Group session terms** reviewed by a lawyer with the lesson terms: charged on booking, full refund up to 24 hours before, called off and refunded if the minimum isn't reached, coach cancellations refunded in full. The coach terms (`LESSON_PAYMENT_TERMS`, version 2 since Milestone 20) now cover group sessions, and coaches agree again in My coaching.
- [ ] Try a group booking and a called-off session in Stripe test mode (refunds use the same Stripe calls as lessons).

## Course ratings (Milestone 20)

- [ ] Privacy policy: each account's star ratings are kept with the account (deleted with it). Golfers see only averages, never names.
- [ ] Decide who checks ratings, and how often (Admin, Ratings). Clubs may ask for a rating to be taken down; removing one is logged in the change log.
- [ ] Terms of use: a line on fair ratings (no ratings for courses you haven't played, no rating your own club), and that BookOn can remove ratings.
- [ ] At launch every course says "Not rated yet". Consider asking friendly golfers to rate their home course early, so averages appear.

## Club events (Milestone 21)

- [ ] **Event payment terms** (`EVENT_TERMS` in `packages/db/src/events.ts`) and the golfer's refund rule on the event page reviewed by a lawyer, including who's responsible for the event itself, and chargebacks. Changing the club terms means bumping `EVENT_TERMS_VERSION`.
- [ ] Try a club setting up Stripe in test mode (Stripe asks for the club's ABN and a contact's ID), then an entry, a withdrawal before and after entries close, and a cancelled event.
- [ ] **Privacy policy:** entrants' names, email and mobile go to the club; players' names show on the public start sheet once it's published; member numbers go to the club only.
- [ ] Decide what to tell clubs about Stripe's fees: BookOn's booking fee covers Stripe's card fee, and clubs get their full entry fees.
- [ ] Ask each club to set a **contact email** in their details, which gets new-entry emails. Without one, they go to the club's owners on BookOn.
- [ ] GST on the event booking fee, with the lesson fee (ask your accountant).

## Match play (Milestone 22)

- [ ] **Privacy policy:** when the draw is out, each player's name, mobile and email are emailed to their opponents, and the entry form asks them to agree to that. Names and results show on the public draw sheet. Club-added players are entered by the club, so the club should tell them their details will be shared with opponents.
- [ ] Terms of use: the club has the final say on results; BookOn only passes reports and disputes on.
- [ ] Refund rule for paid match play entries (a full refund until the draw is made, then it's up to the club) reviewed with the event payment terms.
- [ ] Try a paid match play entry and a club cancelling a competition with Stripe in test mode.
- [ ] Show a club captain the draw and results flow before launch. Clubs run match play differently (strokes given, extra holes, deadlines) and may want more.

## Analytics (Milestone 23)

- [ ] **Privacy policy:** BookOn records the pages visited, where the visit came from, device and browser, rough city (from the host), time on each page, a few actions and loading times, linked to the anonymous BookOn cookie (and to "signed in", not to the account). No IP addresses are kept. Private links are stored without their codes. Raw records are deleted after 13 months. "Do not track" and Global Privacy Control are respected.
- [ ] Ask the lawyer whether Australian law (or visitors from overseas, such as the EU) needs a cookie notice for first-party analytics. BookOn shows none now.
- [ ] Set **BOOKON_ADMIN_EMAIL on the worker** too (Railway or Fly), or the Monday summary email doesn't go out.
- [ ] Check the city shows in Admin, Analytics, Who, once on Vercel (it comes from Vercel's location headers; elsewhere it shows as Unknown).
- [ ] Before launch, delete the test-mode visits so the numbers start clean (ask Claude for a one-off clear-out), or note the launch date when comparing.
- [ ] Sign in on your own phone too, so your phone visits aren't counted.

## News, privacy policy and terms (Milestone 24)

- [ ] **Have a lawyer review `/privacy` and `/terms`** (drafts in `apps/web/src/app/privacy/page.tsx` and `apps/web/src/app/terms/page.tsx`). They cover everything up to Milestone 24. Change the "Last updated" dates in `apps/web/src/components/legal.tsx` when they change.
- [ ] Decide how long search and click records are kept (the privacy policy says they're linked only to the anonymous visitor number; there's no deletion date yet).
- [ ] Add the **business name and ABN** in Admin, Settings once the ABN arrives. The privacy policy and terms show them straight away.
- [ ] **Remove the example news articles** (Admin, News, "Remove all examples") once you've written a few, or keep them only if you're happy they read as BookOn's own.
- [ ] Add BookOn's Instagram, Facebook and TikTok in Admin, Settings, so articles show "Follow BookOn".
- [ ] Authors: tell them pictures must be their own or used with permission (the editor asks them to confirm each upload, with their name).

## Coach places, travel and lesson types (Milestone 26)

- [ ] **Ask live coaches to check their listing** once: each lesson's type is guessed from its name until they save again, and coaches who go to golfers can now tick "happy to travel".
- [ ] Privacy policy: it now says where a golfer would like the lesson goes to the coach (it may be a home address). Include it in the lawyer's review.

## Newsletter (Milestone 27)

- [ ] **Mailchimp account** with one audience for BookOn news. Mailchimp asks for a postal address for the footer of every newsletter (a PO box is fine), and the Spam Act asks for the sender's details: BookOn and the ABN.
- [ ] In the audience settings, turn **off** double opt-in for API sign-ups (BookOn already checks the address for sign-ins), or leave it on if you'd rather everyone confirms by email.
- [ ] Set `MAILCHIMP_API_KEY` and `MAILCHIMP_AUDIENCE_ID` on the worker and the website, and `MAILCHIMP_WEBHOOK_SECRET` on the website (`openssl rand -hex 24`).
- [ ] In Mailchimp, add a webhook to `https://bookon.au/api/mailchimp/webhook?key=<the secret>` for unsubscribes, cleaned addresses, subscribes and profile email changes, from the subscriber and from the account.
- [ ] Check Admin, Newsletter shows "Up to date" after the worker's next pass, and that unsubscribing in a test newsletter shows there as unsubscribed.
- [ ] Only email people on this list with marketing. Don't import other lists (club members, coaches' clients) without each person asking.
- [ ] Have the lawyer check the tick box wording and the newsletter part of the privacy policy.

## Business and legal

- [ ] **Register "BookOn" as a business name** with ASIC (about $47 for a year, $108 for three) before the site goes public, takes booking fees or is advertised. You have an ABN as a sole trader; trading under any name other than your own needs the business name registered. Until then, put your own legal name and ABN in Admin, Settings, Business details, and change it to BookOn once registered.
- [ ] Search IP Australia for "BookOn" trade marks in software and booking services, and decide whether to register one. A business name doesn't protect the name; a trade mark does. Settle the name before launch: changing it later means a new domain, emails, accounts and telling everyone.

- [ ] **Buy bookon.au** from an Australian registrar. .au names need an Australian presence (being an Australian citizen or resident counts, as does an ABN). If bookon.com.au is free, consider buying it too and pointing it at bookon.au.
- [ ] Create the **info@bookon.au** mailbox (Google Workspace or Microsoft 365). It's in the worker's user agent, so clubs may write to it, and replies to alert emails go there.
- [ ] Add **alerts@bookon.au**. Tee time alerts come from it. It can be a free alias of info@, since replies are sent to info@.
- [ ] Domain and brand.
- [ ] **Club listing terms and approvals** (the wording on the onboarding Approvals step, in `packages/db/src/clubs.ts`), reviewed by a lawyer. Changing the wording means bumping `CONSENTS_VERSION`.
- [ ] Decide who reviews new club listings and how fast. The pages promise clubs "usually within a week".
- [ ] Privacy policy and terms pages, reviewed by a lawyer (Spam Act 2003 and Australian Privacy Principles; SPEC section 10). Drafts are live at /privacy and /terms (Milestone 24); they cover accounts (email address, favourites, alerts, the list of tee times looked at) and how to delete an account. The privacy items in the sections above are covered in the draft; tick them once the lawyer has reviewed it.

## Hosting and operations

- [ ] Hosting: **Vercel Pro** for the website (the free Hobby plan is for non-commercial sites only, and BookOn charges booking fees), a hosted Postgres in Sydney (**Neon** or Supabase) with backups on, and **Railway** (or Fly) for the worker, which runs all the time. Put the website's functions in Sydney too.
- [ ] The worker running on a schedule, so results stay fresh.
- [ ] `BOOKON_SITE_URL` set on the website host and the worker. Without it, signing in, starting a club listing and sharing times fail on purpose, as emailed links must never use an address taken from the request.
- [ ] `BOOKON_ADMIN_EMAIL` set on the website host to your email (one address only). Nobody can open the admin area without it.
- [ ] `BOOKON_OWNER_EMAIL` set to whoever reviews new club listings (otherwise they go to info@bookon.au).
- [ ] `CLICK_SIGNING_SECRET` set on the website host **and** the worker, the same value on both (`openssl rand -base64 32`). Without it, Book clicks still work but aren't tracked.
- [ ] **Email sending (Postmark).** Until then, sign-in links and alerts go to the local outbox only, so nobody can sign in on a hosted site.
  - Sign up at postmarkapp.com and create a server. Copy its Server API token.
  - Add bookon.au as a sender domain and add the DKIM and Return-Path DNS records Postmark shows. Add a DMARC record if the domain has none.
  - Ask Postmark to approve the account for sending to anyone (new accounts can only email their own domain).
  - Set `EMAIL_PROVIDER=postmark`, `POSTMARK_SERVER_TOKEN`, `EMAIL_FROM` (BookOn <info@bookon.au>), `EMAIL_ALERTS_FROM` (BookOn alerts <alerts@bookon.au>) and `BOOKON_SITE_URL` on the website host and the worker. Postmark needs both addresses on the verified bookon.au domain.
- [ ] **Push notification keys.** Run `pnpm push:keys` once and set `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` on the website host and the worker. Never change them after launch: every golfer's notifications would stop until they turn them on again.
- [ ] **Test sharing on a real iPhone** once the site is on https: search, tap Share, then Send picture. The share sheet should open with the picture attached. Paste a share link into Messages and check the preview shows the times.
- [ ] **Test push on a real iPhone** once the site is on https: add BookOn to the Home Screen, open it from there, turn on notifications, set an alert.
- [ ] Error monitoring (Sentry), uptime checks, rate limits on public pages, database backups.

## Product

- [ ] Milestones 3 to 7 done, or explicitly deferred by the owner.
- [ ] Course coordinates entered, if the distance filter is wanted at launch.
