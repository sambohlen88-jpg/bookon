# Milestone 15 review: book and pay for lessons

19 October 2026. You approved booking and paying for coach lessons through Stripe Connect, with my suggestions:

- a $2.50 booking fee the golfer pays on top, so coaches keep 100% of their price
- free cancellation up to 24 hours before
- payment in full, not a deposit

Hardening and launch move to Milestone 16 (recorded in SPEC.md, CLAUDE.md and the launch checklist).

**About the screenshots:** they're from practice mode on a local database, with the made-up sample coaches. No money moved. Stripe's servers are blocked from my cloud environment, so the real Stripe pages haven't been tried yet; see "Open issues".

## What was done

### For golfers

1. **Book and pay** on a coach's page ([coach page](./m15/m15-coach-page-phone.png)). It shows once the coach has set up payments and turned bookings on. WhatsApp, email and call stay as they were.
2. **Pick a lesson, a day, then a time** ([booking page](./m15/m15-book-phone.png)):
   - Times come from the coach's usual hours, every half hour, from 12 hours ahead up to 4 weeks.
   - Days away are left out.
   - Times already held or booked don't show.
   - Group clinics stay "contact the coach", as they're priced per person.
3. **Your details:**
   - Name, email and mobile, and a note for the coach. No account needed.
   - A summary shows the lesson, the $2.50 fee and the total, with the rules in plain words.
   - A tick box agrees to the cancellation rule and to sharing their details with the coach.
4. **Pay on Stripe's page:**
   - Card, Apple Pay or Google Pay. BookOn never sees the card.
   - The money is **held, not charged**.
   - The time is held for 30 minutes while they pay. Coming back without paying frees it straight away.
   - In practice mode a [stand-in page](./m15/m15-practice-checkout-phone.png) marked "Practice: no money moves" takes Stripe's place.
5. **Their booking page** ([waiting](./m15/m15-lesson-requested-phone.png), [booked](./m15/m15-lesson-confirmed-phone.png), [cancelled and refunded](./m15/m15-lesson-cancelled-phone.png)):
   - It's linked from every email.
   - It shows where the booking is at and when the coach will answer.
   - It shows the coach's phone once the lesson is booked.
   - **Cancel** gives back the full amount up to 24 hours before, and nothing after that. Withdrawing a request that's still waiting releases the hold.
6. **My account → Lessons** lists their lessons when they're signed in ([screenshot](./m15/m15-account-lessons-phone.png)).
7. **Emails** go to the golfer for each step:
   - request sent (card held)
   - booked (card charged, receipt from Stripe)
   - declined, or lapsed (hold released)
   - cancelled (refunded or not)
   - the coach cancelled (full refund)

### For coaches (My coaching)

- **Bookings and payments** ([before](./m15/m15-coach-payments-setup.png), [after](./m15/m15-coach-payments-ready.png)):
  - **Set up payments with Stripe.** The first time, the coach agrees to the lesson payment terms, recorded with their name and the date.
  - Stripe's own pages ask for their ID, ABN and bank account.
  - Back on BookOn, the coach can **turn bookings on** (or off) and open their **Stripe dashboard** for payouts and receipts.
  - If Stripe ever says the account can't take payments, bookings switch off by themselves.
- **Requests** ([screenshot](./m15/m15-coach-request-close.png)):
  - the golfer's details and note
  - the price the coach gets
  - **Accept and charge**, or **Decline** with an optional note
  - the answer-by time
- **A request lapses** when it isn't answered within 48 hours, or by 2 hours before the lesson if that's sooner. The hold is released and both are told.
- **Coming up** ([screenshot](./m15/m15-coach-upcoming.png)) lists booked lessons. Under "Can't make it?", the coach can cancel and refund the golfer in full.
- **Emails:** each new request ([example](./m15/m15-email-coach-request.png)), lapsed requests, and golfer cancellations, saying whether the coach keeps the money.

### For you (admin)

- **Admin → Lessons** ([screenshot](./m15/m15-admin-lessons.png)): every paid booking, with:
  - coach and golfer
  - status
  - amount, fee and any refund
- **Admin → Settings → Lesson payments** ([screenshot](./m15/m15-admin-settings.png)):
  - turn lesson payments off or on for the whole site
  - change the booking fee, which applies to new bookings only
  - the hint says roughly what Stripe takes
- **Admin → Reports** ([screenshot](./m15/m15-admin-reports.png)): for the chosen dates, paid requests, lessons accepted, paid to coaches and booking fees, after refunds.
- **Admin → Coaches** shows each coach's payments status.

### Behind the scenes

- **`packages/payments`** is new. It uses Stripe's official library (pinned to 23.0.0) with:
  - Express accounts in Australia
  - Checkout with the card held (`capture_method: manual`)
  - the lesson price sent to the coach and the fee kept by BookOn (destination charges)
  - full refunds that also take the money back from the coach and return the fee
- **Every step is safe to repeat.** Money moves first, then the booking, and a booking only moves on from the state it expects. A double click or a late Stripe message can't charge or email twice.
- **The worker** closes unpaid checkouts and lapses unanswered requests on every pass (`pnpm --filter @bookon/worker lessons` runs it once).
- **Stripe webhook** at `/api/stripe/webhook`:
  - It only reads messages signed with `STRIPE_WEBHOOK_SECRET`.
  - It stays reachable in private test mode, because Stripe can't type the site password.
  - It isn't required: the booking page checks with Stripe itself when the golfer comes back from paying.
- **Practice mode:** used on a local database with no Stripe keys.
  - The three sample coaches take practice bookings.
  - Practice accounts are never used with real Stripe, and real ones are never used in practice.

## Checked

| Check                | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Practice walkthrough | <ul><li>A golfer booked a sample coach on a phone, and the coach accepted.</li><li>The golfer cancelled less than 24 hours before: not refunded, and the coach keeps the price.</li><li>A second booking was declined with a note.</li><li>A third, more than 24 hours ahead, was accepted then cancelled: refunded $122.50.</li><li>Backing out of checkout freed the time at once.</li><li>A held time didn't show to anyone else.</li><li>A new coach set up practice payments, turned bookings on, and their page showed Book and pay.</li><li>Emails all landed in the outbox. No page errors.</li></ul> |
| Admin                | Lessons list, Settings and Reports showed the right figures: 3 paid requests, 2 accepted, $110 to coaches and $2.50 in fees after the refund.                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Tests                | 350 passing (46 new). They cover:<ul><li>lesson times: hours, half hours, 12 hours' notice, days away, 4 weeks, overlaps</li><li>answer-by and refund rules</li><li>every booking step and that it only happens once</li><li>lapsing, and freeing unpaid checkouts</li><li>the fee setting</li><li>what's sent to Stripe for checkout, charge, release, refund and account setup</li><li>reading Stripe's answers and errors</li><li>webhook signatures, including a forged one</li><li>practice and real accounts never mixing</li><li>the emails</li></ul>                                                  |
| All checks           | `format:check`, `lint`, `typecheck`, `test` and `build` pass.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

### Fixed while checking

- **A refused form lost the chosen time.** If the golfer forgot the tick box, they had to pick the day and time again. The browser now asks for the tick box before sending, and if the server still refuses, the same time stays picked.
- **Search-engine rules.** My first draft hid `/coach` from search engines, which would also have hidden `/coaches` and `/coaching`. Now only `/lessons/` is hidden. The coach portal is marked "no index" on the page itself.
- **Tests sometimes timed out starting their test database** when all the packages tested at once (it happened twice, in the worker and website tests). Test setup now gets 60 seconds instead of 10.
- **Stripe's messages and private test mode.** The webhook address is open, like robots.txt, so Stripe's messages reach a password-protected test site.

## Decisions I made

1. **Golfers don't need an account.** Their emailed link is how they see or cancel. Signed-in golfers also see lessons under My account.
2. **12 hours' notice, half-hour start times, 4 weeks ahead**, so coaches always have at least 10 hours to answer.
3. **A $0 fee leaves the fee line off Stripe's checkout**, in case you ever run a free-booking promotion.
4. **A golfer can cancel within 24 hours, without a refund**, so the coach knows they're not coming. The coach keeps the lesson price, and BookOn keeps the fee.
5. **Coaches agree to short payment terms** before setting up (`LESSON_PAYMENT_TERMS` in `packages/db/src/lessons.ts`). They're on the launch checklist for a lawyer to read.

## Open issues

1. **Not tried against Stripe yet.** My environment can't reach api.stripe.com. The tests use Stripe responses I wrote by hand from Stripe's API reference (`packages/payments/fixtures/stripe/`). The first real check is your Stripe test mode (steps below). To let me test it from here, add `api.stripe.com` under Allowed domains in this environment's network settings.
2. **Thin margin at $2.50.** BookOn keeps about 60c on a $90 lesson after Stripe's card fee, before Connect's monthly and payout fees. You can change the fee any time in Admin → Settings.
3. **Lapsing happens on the worker's pass,** every 30 minutes. A request can sit a few minutes past its answer-by time before the golfer is told, though the coach can't accept it after that time.
4. **No reminders yet.** There's no "you have a request waiting" nudge to the coach and no "lesson tomorrow" reminder to the golfer. These are easy to add later.
5. **Coach no-shows and disputes** go through Stripe and you. The terms and the process are on the launch checklist.
6. **Bookings outside BookOn.** If a coach books someone directly in a time BookOn shows as free, they just decline the request. Calendar syncing would fix this later.

## How to demo (on your Mac)

```bash
cd ~/bookon
git pull
pnpm install
pnpm db:dev                                      # window 1, keep running
caffeinate -i pnpm dev:worker                    # window 2, keep running
BOOKON_ADMIN_EMAIL=<your email> pnpm dev         # window 3
```

- **As a golfer:**
  - Open http://localhost:3000/coaches/mia-hartley and tap **Book and pay**.
  - Pick a lesson, day and time, fill in your details, then **Hold (practice)**.
- **As the coach:**
  - Sign in as `mia.hartley@example.com` (the link is in http://localhost:3000/dev/outbox).
  - Open **My coaching** and accept or decline.
- **As yourself:** sign in with your email and open **Admin → Lessons**, **Settings** and **Reports**.

### Trying real Stripe test mode (when you're ready)

1. Make a free account at stripe.com. Stay in **Test mode**.
2. In the dashboard, open **Connect** and set it up as a platform with **Express** accounts.
3. Copy the test secret key (`sk_test_…`) into `apps/web/.env.local` and `apps/worker/.env` as `STRIPE_SECRET_KEY=…`.
4. Install the Stripe CLI (`brew install stripe/stripe-cli/stripe`), run `stripe login`, then run this and leave it running:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
   It prints a `whsec_…` secret. Add it as `STRIPE_WEBHOOK_SECRET=…` in `apps/web/.env.local`.
5. Restart `pnpm dev`.
6. Sample coaches don't take real Stripe bookings, so set up a test coach:
   - Sign in as a test coach with any email.
   - Fill in and send a listing, then approve it in admin.
   - In My coaching, **Set up payments with Stripe**, using the test details Stripe shows on each step.
   - **Turn bookings on**.
7. Book that coach, paying with Stripe's test card **4242 4242 4242 4242** (any future date, any CVC).
8. Accept the request as the coach, then cancel as the golfer. Each step shows in the Stripe dashboard.
