# Milestone 27 review: Inter, bookon.au, alerts@ and the newsletter

26 October 2026. Getting ready to go live. You asked for:

- the Inter font
- the domain bookon.au, with info@bookon.au, and alerts@bookon.au sending tee time alerts
- a way for golfers to sign up for BookOn news when they sign in, for email marketing

You approved my recommendations: newsletters are sent from a marketing tool (I've used **Mailchimp**), and alerts@ sends tee time alerts only. Launch is now Milestone 28.

**About the screenshots:** they're from my local database. "keen.m27" and "bo.m27" are made-up golfers, and the lesson booking used practice payments.

## What was done

### Inter

[Home](./m27/m27-home-desktop.png), [share picture](./m27/m27-share-picture.png)

- **The site and the share pictures are in Inter**, replacing DM Sans, in the same weights.
- **The font is stored with the site**, so pages don't wait on Google and no visitor details go to Google. Inter's free licence (SIL Open Font License) is with the files.

### bookon.au

- **Every bookon.com.au is now bookon.au:**
  - the footer, the privacy policy and terms
  - every email, including the example news article
  - the contact address the worker gives clubs' booking sites
  - the settings template (`.env.example`)
- Older milestone reviews still say bookon.com.au, as they were written then.

### alerts@ and info@

- **Tee time alerts come from "BookOn alerts <alerts@bookon.au>".** Replies go to info@bookon.au, so a person reads them.
- **Every other email comes from info@bookon.au:** sign-in links, bookings, clubs, coaches and news.
- Since replies go to info@, **alerts@ can be a free alias** of info@ rather than a second paid mailbox.

### The newsletter tick box

[Sign in (phone)](./m27/m27-signin-phone.png), [booking a lesson (phone)](./m27/m27-booking-tick-phone.png)

- **"Send me BookOn news, golf tips and offers. Unsubscribe any time."** It always starts unticked, as the Spam Act expects.
- **Where it shows:**
  - signing in, which also covers people setting up tee time alerts, since alerts need an account
  - booking a lesson or a group session
  - entering an event or match play
- **Sign-ins are only added once the emailed link is used**, so nobody can sign up someone else's address.
- **BookOn keeps proof of consent:** when they ticked the box, where, and the exact words.

### My account

[Subscribed](./m27/m27-account-on.png), [after stopping](./m27/m27-account-off.png)

- Under **Settings**, "BookOn news" shows whether you're getting it, with **Send me BookOn news** or **Stop sending me BookOn news**.
- **Deleting an account unsubscribes it.** The address stays marked as unsubscribed so it's never added back by mistake.

### Mailchimp

- **BookOn keeps the list; Mailchimp sends the newsletters.** Each pass, the worker copies every sign-up and unsubscribe to your Mailchimp audience.
- **Unsubscribing in Mailchimp comes back to BookOn** through Mailchimp's webhook. So do bounced addresses, sign-ups on a Mailchimp form, and changed addresses.
- **If someone unsubscribed in Mailchimp and later ticks the box on BookOn,** Mailchimp emails them to confirm, rather than BookOn forcing them back on.
- **Until you set up Mailchimp, sign-ups wait in BookOn** and go across once it's connected.

### Admin → Newsletter

[Screenshot](./m27/m27-admin-newsletter.png)

- Counts of subscribed, unsubscribed and waiting for Mailchimp, plus where people joined.
- Everyone on the list, with the date they agreed and whether Mailchimp is up to date. Any problem is shown and tried again on the worker's next pass.
- **Download CSV** of everyone and their consent.

### Privacy policy

- A **BookOn news** paragraph covering:
  - the tick box, and what BookOn keeps
  - Mailchimp sending the newsletter from the United States
  - unsubscribing, acted on straight away (always within 5 working days)
  - keeping unsubscribed addresses so they aren't re-added
- Mailchimp is added to the list of companies BookOn shares details with.

## Checked

| Check               | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser walkthrough | <ul><li>On a phone, a new golfer signed in with the box ticked. It started unticked. My account said they're getting BookOn news.</li><li>They pressed Stop, then Send again. Both worked.</li><li>A golfer who didn't tick it wasn't added.</li><li>A lesson booking with the box ticked went to checkout, and the golfer was added as "Booking a lesson".</li><li>A Mailchimp unsubscribe sent to the webhook marked them unsubscribed. A wrong key was refused.</li><li>Admin, Newsletter and the CSV showed both golfers, with their consent. The CSV was refused when signed out.</li><li>Pages and the share picture render in Inter.</li><li>No page errors.</li></ul> |
| Tests               | 527 passing (11 new). They cover:<ul><li>sign-ins added only after the link is used, and only when ticked</li><li>each change queued for Mailchimp</li><li>problems kept and retried</li><li>Mailchimp's own changes not sent back</li><li>deleted accounts unsubscribed</li><li>the worker's sync</li><li>the Mailchimp request, including the confirm-again case, using responses written from Mailchimp's documentation</li><li>reading the webhook</li><li>alerts sent from alerts@ with replies to info@</li></ul>                                                                                                                                                       |
| All checks          | `format:check`, `lint`, `typecheck`, `test` and `build` pass.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

### Fixed while checking

- The Admin note said Mailchimp's settings go on the worker only. They go on the website too.
- I'd first dated the docs 27 October. Fixed to 26 October, today's date in Perth.

## Decisions I made

1. **Mailchimp** as the newsletter tool. It's the usual choice for an Australian newsletter like this, free to start, with templates, scheduling and open rates. Swapping to another tool later only changes the small Mailchimp part of the code.
2. **BookOn keeps the list, not just Mailchimp.** The proof of consent lives with your other records, and changing tools later doesn't lose anyone.
3. **Golfers who signed up before this aren't on the list.** They can turn it on in My account. They can't be emailed marketing until they do.
4. **Bookings record the tick straight away**, as the person is giving their own email for their booking. Sign-ins wait for the link.

## Open issues

1. **Not tried against real Mailchimp** (blocked from here). The first live check is your account: sign up with the box ticked, then look for yourself in the Mailchimp audience after the worker's next pass.
2. **Mailchimp needs a postal address** in every newsletter's footer (a PO box is fine), and the Spam Act asks for the business details, so add the ABN there.
3. **The tick box wording and the privacy policy** are for the lawyer, with the rest.

## Before launch (Milestone 28): your open items

Everything is in `docs/launch-checklist.md`. The main ones:

1. **Verified platform access first:** MiClub, Sagacity (Quick18, for Hamersley) and Your Golf Booking. Chronogolf and X-Golf only if wanted. Wembley stays off until the club agrees.
2. **The lawyer:** privacy policy, terms, and the lesson, event, coach and club terms, now including the newsletter.
3. **ABN**, then the business name and ABN in Admin, Settings.
4. **Sign up:**
   - bookon.au
   - a mailbox for info@, with alerts@ as an alias
   - Vercel Pro
   - Neon (Sydney)
   - Railway
   - Postmark
   - Stripe
   - Mailchimp
   - Sentry
5. **Stripe test-mode run-throughs** for lessons, group sessions, events and match play.
6. **On launch day:** remove the site password, add Search Console, and clear the test-mode analytics visits.

## How to see it (Mac Terminal)

```bash
cd ~/bookon
git pull
pnpm install
pnpm db:dev                                                   # window 1
BOOKON_ADMIN_EMAIL=sambohlen88@gmail.com pnpm dev             # window 2
```

1. In a private window, open http://localhost:3000/signin, tick "Send me BookOn news" and sign in with a made-up email. The link is in http://localhost:3000/dev/outbox.
2. In your normal window, open **Admin → Newsletter**. They're there.
3. In the private window, go to **My account → Settings** and try Stop and Send again.
