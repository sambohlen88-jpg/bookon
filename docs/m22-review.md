# Milestone 22 review: match play manager

24 October 2026. You approved a match play manager: knockout competitions, singles or pairs, with entries online or added by the club, a draw with seeds and byes, results reported by the players, and the club having the final say. Nothing touches handicaps. Split payments went onto the Phase 2 list in SPEC section 12.

**About the screenshots:** they're from a local database in practice mode (no money moves). I used Point Walter Golf Course as the club, signed in as you (admin can open any club's portal), plus made-up golfers. Point Walter hasn't signed up; the competition is made up.

## What was done

### Setting up (club portal → Match play)

[The form](./m22/m22-club-matchplay-form.png), [list](./m22/m22-club-matchplay-list.png)

- **Name and description.** The hint suggests saying how strokes work if they're given, since BookOn doesn't use handicaps.
- **Course**, if the club has more than one
- **Singles or pairs**
- **Field:** 2 to 128 entries. If it isn't 8, 16, 32 and so on, the top seeds get byes.
- **Entries:** golfers enter on BookOn, or the club adds every entry itself
- **Entry fee per player** for online entries, or free. A fee needs the club's payments set up (from Milestone 21). Golfers pay BookOn's $2.50 booking fee on top, once per entry.
- **When online entries close**
- **Open** (listed on the Competitions page) or **members only** (shared by link, not shown to search engines)

Once someone has entered, the format and fee are locked, as with events.

### Entering

[Competition page (phone)](./m22/m22-matchplay-page-phone.png), [checkout](./m22/m22-matchplay-checkout-phone.png), [entered](./m22/m22-matchplay-entered-phone.png)

- **Golfers enter online** with their name (and partner's, for pairs), email and mobile. They tick to agree that their email and mobile go to the club and to each opponent.
- **Free entries** go straight in. **Paid entries** go to the checkout and are in once paid.
- **Withdrawing:** golfers withdraw from the link in their email until the draw is made, with a full refund. After that, they contact the club.
- **The club adds entries** by name, with an email or a mobile. Players with only a mobile get no emails from BookOn, but their opponents still get the mobile.

### The draw

[Entries and seeds](./m22/m22-club-matchplay-entries.png), [draw made](./m22/m22-club-matchplay-drawn.png), [published](./m22/m22-club-matchplay-published.png)

- **Seeds are optional** (1 is the top seed). They're kept apart in the usual way: 1 and 2 can only meet in the final.
- **Make the draw:** everyone who isn't seeded is drawn at random. Byes go to the top seeds first. Making the draw stops new entries.
- Before it's out, the club can **swap** any two entries, **make it again**, or **undo it** to change the entries.
- **Play-by dates** for each round. The club can change them at any time.
- **Publish the draw and email everyone:** each side gets their opponent, their mobile and email, the play-by date, a "Report the result" link, and "Find a tee time at" the course. An entry with a bye is told so.

### Results

[Reported (phone)](./m22/m22-player-reported-phone.png), [confirm or dispute (phone)](./m22/m22-player-confirm-phone.png), [waiting with a bye (phone)](./m22/m22-player-bye-phone.png), [disputed, in the club portal](./m22/m22-club-matchplay-disputed.png), [results](./m22/m22-club-matchplay-results.png)

- **Either side reports** from their link: who won, and the score if they like (3&2, 1 up, 19th).
- **The other side is emailed.** They can confirm it, and it stands straight away, or dispute it with a note. If they do nothing for 48 hours, it stands.
- **A dispute emails the club** and is shown at the top of the club's match list, highlighted.
- **The club has the final say:**
  - it can record a result for any match, or correct one, as long as the next round's match hasn't been decided
  - it can award a walkover
- **Winners go through by themselves.** When both sides of the next match are known, both are emailed their new opponent. After the final, both sides get the result and the club is told who won.

### Draw sheet

[Desktop](./m22/m22-matchplay-draw-desktop.png), [phone](./m22/m22-matchplay-draw-phone.png)

- One column per round with play-by dates, seeds, results and scores. Losers are struck through.
- On a phone it scrolls sideways.
- **Names and results only. Contact details are never shown**, only emailed.
- A player's own page shows their current match and highlights them on the draw.

### What the worker does

- Reminds both sides **3 days before** a match's play-by date, once
- Tells the club about a match still without a result (or disputed) **after its play-by date**, once
- Lets reported results stand after 48 hours
- Closes unpaid checkouts, and refunds anyone in a cancelled competition if a refund failed the first time

### Listings and admin

[Competitions page](./m22/m22-competitions-matchplay.png), [For golf clubs](./m22/m22-clubs-matchplay-section.png), [Admin](./m22/m22-admin-matchplay.png)

- **Competitions:** a new Match play section lists open competitions taking entries or being played. They're in the sitemap too.
- **For golf clubs:** a new "Run your match play on BookOn" section.
- **Admin → Match play:** every competition at every club.
- **Cancelling** a competition refunds anyone who paid in full and emails everyone with the club's note.

## Checked

| Check               | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser walkthrough | <ul><li>Set up a singles championship at Point Walter: field of 8, $20 a player, entries close 1 November.</li><li>On a phone, Alex and Bo entered and paid **$22.50** each ($20 plus $2.50).</li><li>The club added Cy, Di and Ed (Ed with a mobile only), and seeded Alex 1 and Cy 2.</li><li>Made the draw: 5 entries in a draw of 8, so 3 byes. Swapped two players, set play-by dates and published.</li><li>Di and Ed were told they play each other. Cy and Bo were told they meet in the semi-finals. Alex got his bye email. Ed got nothing, as he has no email.</li><li>Bo reported a 3&2 win and Cy was asked to confirm. Cy disputed it ("I won 2&1"), and the club was emailed. The club recorded Cy winning 2&1.</li><li>The club awarded Ed a walkover against Di. Alex was emailed that he plays Ed, with Ed's mobile.</li><li>The draw sheet, Competitions page, For golf clubs and admin page all showed it.</li><li>No page errors.</li></ul> |
| Tests               | 463 passing (19 new). They cover:<ul><li>draw sizes, seed positions and byes</li><li>round names</li><li>where a winner goes next</li><li>the draw, swaps and undoing it</li><li>byes going through</li><li>reporting, confirming and disputing</li><li>the 48 hours</li><li>club results and corrections, and when they're refused</li><li>free and paid entries</li><li>refunds on withdrawing and cancelling</li><li>each email</li><li>reminders and overdue notices, sent once each</li><li>the form</li></ul>                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| All checks          | `format:check`, `lint`, `typecheck`, `test` and `build` pass.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

### Fixed while checking

- **A player with a bye** was told "Your match" against nobody. It now says "Waiting for your next opponent".
- **"Bo Driver reported that Bo Driver won"** now reads "Bo Driver reported that they won".
- **The draw's bye note** said the top seeds get the byes even when there weren't enough seeds. It now says "top seeds first".
- **The club's dispute view** now names who disputed, not "They said".

## Decisions I made

1. **The club adds entries before the draw only.** After the draw, it awards a walkover instead of withdrawing someone. That keeps the draw fair and simple.
2. **Golfers can withdraw (with a full refund) until the draw is made,** not until entries close. Many match play competitions are drawn after a closing date, and nothing is lost until then.
3. **The club can correct a result** until the next round's match has a result. After that, changing it would unpick later rounds.
4. **Changing play-by dates after publishing doesn't email anyone.** Reminders and overdue notices use the new dates. Clubs can tell players themselves if they move a date a lot.
5. **Opponents' contact details are emailed, not shown on the player's own page,** as you approved. The page says they're in the email.
6. **The walkover choice** defaults to the first player listed, so the club picks who it goes to.
7. **No handicaps or strokes.** The description is where a club says how strokes are given, if at all.

## Open issues

1. **Not tried against real Stripe** (blocked from here). Paid entries use the same Stripe calls as events. It's on the launch checklist.
2. **Privacy:** players' contact details go to their opponents. The entry form asks golfers to agree, but players the club adds don't see that form. The club should tell them. This is on the launch checklist for the privacy policy.
3. **No real club has seen this yet.** Match play varies by club (strokes, extra holes, consolation draws, deadlines). It'd be worth showing a club captain before launch.
4. **Players with no email** (added by the club with a mobile only) don't get emails or a link to report results. Their opponent reports, or the club records it.

## How to demo (on your PC, in PowerShell)

```powershell
cd ~\bookon
git pull
pnpm install
pnpm db:dev                                                      # window 1
pnpm dev:worker                                                  # window 2
$env:BOOKON_ADMIN_EMAIL="sambohlen88@gmail.com"; pnpm dev        # window 3
```

1. Sign in at http://localhost:3000/signin with your email. The link is in http://localhost:3000/dev/outbox.
2. Go to **Admin → Clubs**, open any club, then its club portal.
3. **Match play → Set up a competition.** Leave the fee empty for free entry, or set up **Payments** first to charge.
4. Open the competition's link in a private window and enter a player or two. Or add entries in the club portal.
5. In the club portal, press **Make the draw**, set the play-by dates, then **Publish**. The emails are in the outbox, each with a link to that player's page.
6. Open a player's link and report a result. Open their opponent's link to confirm or dispute it.
