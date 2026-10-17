# Launch checklist

Things that must be done before BookOn launches publicly (SPEC section 11, Milestone 7). Claude Code is asked, in `CLAUDE.md`, to raise these with the owner before any launch work.

## Platform access (owner asked to be reminded)

Data is read from public booking pages with the owner's approval, ahead of formal permission. Before full launch, get verified access or written permission from each platform:

- [ ] **MiClub** (Perth, owned by Northstar). Ask for read access to the live feed that powers TeeNet. Covers Collier Park, Fremantle Public, Whaleback, Wembley and other MiClub courses.
- [ ] **Sagacity Golf** (Quick18). Ask for API or feed access. Covers Hamersley.
- [ ] **Lightspeed Golf** (Chronogolf), only if a BookOn course turns out to use it. Apply for the [Partner API](https://partner-api.docs.chronogolf.com/). The Chronogolf pages for Marangaroo, The Cut and Point Walter now return 404, so they may be on MiClub instead.
- [ ] **Wembley** (Town of Cambridge). Its timesheets are behind a CAPTCHA; it stays switched off until the club gives permission or a feed.

## Business and legal

- [ ] Create the **info@bookon.com.au** mailbox. It is already in the worker's user agent, so clubs may write to it.
- [ ] Domain and brand.
- [ ] Privacy policy and terms pages, reviewed by a lawyer (Spam Act 2003 and Australian Privacy Principles; SPEC section 10).

## Hosting and operations

- [ ] Hosting: Vercel (website), a hosted Postgres such as Supabase or Neon, and Railway or Fly for the worker.
- [ ] The worker running on a schedule, so results stay fresh.
- [ ] `CLICK_SIGNING_SECRET` set on the website host (`openssl rand -base64 32`). Without it, Book clicks still work but aren't tracked.
- [ ] Error monitoring (Sentry), uptime checks, rate limits on public pages, database backups.

## Product

- [ ] Milestones 3 to 7 done, or explicitly deferred by the owner.
- [ ] Course coordinates entered, if the distance filter is wanted at launch.
