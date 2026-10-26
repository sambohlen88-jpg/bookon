# Milestone 26 review: coach places, travel, lesson types and DM Sans

26 October 2026. You asked for coaches to be able to add more places they coach and more types of lesson, and for the site to use DM Sans from Google Fonts in the same weights. After my plan you asked for:

- an "Add another" button instead of a page full of empty boxes
- a "happy to travel" option for coaches who go to the player
- the share pictures in DM Sans too

I took "pictures in DM Sans too" as approval of the revised plan. Launch is now Milestone 27.

**About the screenshots:** they're from my local database. "Casey Tran" is a coach I made up for the test. Mia Hartley, Daniel Reyes and Grace Okafor are the made-up example coaches, now with lesson types, and Mia travels. "Alex Golfer" is made up, and the booking used practice payments, so no money moved. The "winter twilight times" article is a test article from my local database.

## What was done

### My coaching: places

[New coach](./m26/m26-portal-new-places.png), [filled in](./m26/m26-portal-places.png)

- **One place to start, then "+ Add another place"**, up to 10. Each place has a **Remove** link.
- Pick a course or venue on BookOn, or type a name and suburb. Once a BookOn course is picked, its suburb shows and the name boxes go away.
- **"I'm happy to travel to the player":**
  - Tick it, then pick the areas they'll travel to. Their own area is ticked to start.
  - Add an optional note, like "Anywhere from Yanchep to Scarborough".
  - A coach who always goes to the player doesn't need any places.

### My coaching: lessons

[New coach](./m26/m26-portal-new-lessons.png), [filled in](./m26/m26-portal-lessons.png)

- **One lesson to start, then "+ Add another lesson"**, up to 12, each with **Remove**.
- **Type of lesson** for each:
  - Private lesson
  - Playing lesson
  - Short game and putting
  - Junior lesson
  - Simulator or indoor
  - Video analysis
  - Club fitting
  - Group clinic
  - Other
- **Where:** "Everywhere I teach", or "Only some places" with a tick box for each place and, for coaches who travel, "At the player's choice". For example, a playing lesson only at the player's course, or video analysis only at the home studio. It only shows once there's more than one choice.
- Weekend and holiday prices work as before.

### Booking a lesson

[Lessons (phone)](./m26/m26-book-lessons-phone.png), [where (phone)](./m26/m26-book-place-phone.png), [booked (phone)](./m26/m26-booked-phone.png)

- Each lesson shows its type and "comes to you" when the coach travels.
- **Where** lists only the places that lesson is taught at, plus **"Somewhere you choose"** for a coach who travels. Choosing it shows a box: "Where would you like Mia to come?"
- A lesson taught only at the player's choice goes straight to that box.
- The place the golfer types goes on the booking, their booking page and the coach's email.
- A coach with no places types where a group session is on.

### Find a coach

[Desktop](./m26/m26-coaches-desktop.png), ["Comes to you"](./m26/m26-coaches-comes-to-you.png), [phone](./m26/m26-coaches-phone.png)

- **Areas count every area a coach teaches in:**
  - where they're based
  - where the BookOn courses they teach at are
  - every area they travel to

  Mia (based North, travels North and West) now shows under West too. The Golf in Perth area pages count coaches the same way.

- **New "Comes to you" filter**, and a **"Comes to you"** label on travelling coaches.
- **New "Any type of lesson" filter.** It lists only types some coach offers.

### Coach pages

[Casey's page](./m26/m26-coach-page.png)

- **Where … teaches** starts with **"Comes to you"**, the areas and the note, then the places.
- Each lesson shows its type (when the name doesn't already say it) and where it's taught when that isn't everywhere: "Wherever you choose", "At Home studio".
- Admin, Coaches shows whether a coach travels, and each lesson's type, when you approve them.

### DM Sans

[Home (phone)](./m26/m26-home-phone.png), [share picture](./m26/m26-share-picture.png), [share link preview](./m26/m26-share-card.png), [news link preview](./m26/m26-news-card.png)

- **The whole site is in DM Sans**, in the same weights as before (regular, medium, semibold and bold). It's stored with the site, not loaded from Google, so pages don't wait on Google and no visitor details go to Google. The font's free licence (SIL Open Font License) is with the files.
- **The share pictures and link previews are in DM Sans too**, replacing Inter.
- DM Sans is a little wider than Inter, so a long share title now wraps beside the logo instead of running into it.

## Checked

| Check               | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser walkthrough | <ul><li>As a new coach, Casey filled in a BookOn course and a home studio. Casey added a third place and removed it, and the cursor moved to each new place.</li><li>Casey ticked travel (North was ticked to start), added West and a note.</li><li>Casey added a private lesson, a playing lesson at the player's choice only, and video analysis at the home studio only, then sent it.</li><li>Reopening the listing showed every choice as saved.</li><li>"Add another" stopped at 10 places and 12 lessons, saying so. Unticking travel took "At the player's choice" off the lessons.</li><li>You approved Casey. Find a coach then showed:<ul><li>4 coaches</li><li>2 for "Comes to you"</li><li>2 for video analysis</li><li>3 for West</li></ul></li><li>On a phone, Alex booked Mia's playing lesson. There was no list of places, just the box. Alex typed "Wembley Golf Course, Wembley Downs" and paid in practice mode. It showed on the booking page and in Mia's email.</li><li>The share picture, both link previews and the pages all render in DM Sans.</li><li>No page errors.</li></ul> |
| Tests               | 516 passing (10 new). They cover:<ul><li>lesson types and the guess for older lessons</li><li>where a lesson is taught</li><li>the form: travel, types, where each lesson is, 10 places and 12 lessons, places optional when travelling</li><li>a typed group session place</li><li>booking at the golfer's choice: refused when the coach doesn't travel or the box is empty</li><li>the areas, travel and types Find a coach uses</li></ul>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| All checks          | `format:check`, `lint`, `typecheck`, `test` and `build` pass.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

### Fixed while checking

- A lesson only at the player's choice read **"At wherever you choose"**. It now reads "Wherever you choose", or "At Home studio, or wherever you choose".
- The tee time **share link preview's title came close to the logo** in DM Sans. A long title now wraps.

## Decisions I made

1. **Lessons saved before this keep working.** They're taught everywhere the coach teaches, including at the player's choice if the coach travels. Their type is guessed from the name ("9 hole playing lesson" is a Playing lesson, a group lesson is a Group clinic, otherwise Private lesson) until the coach saves again.
2. **A lesson set to "Only some places" whose places are all removed goes back to everywhere**, rather than disappearing.
3. **"Comes to you" shows the areas, not a distance.** Golfers type where they'd like the lesson, and the coach can contact them if it's too far, or decline the request (the hold on the card is released).
4. **No travel fees.** A coach who charges more to travel can add a separate lesson for it, like "Lesson at your course".
5. **The font is stored with the site.** Google Fonts is free to use, but loading it from Google on every page would send visitor details to Google, which the privacy policy doesn't cover.
6. **The privacy policy now says** that where a golfer would like the lesson goes to the coach. It may be a home address.

## Open issues

1. **Coaches already live** keep their lessons, with the type guessed. Worth asking them to check and save their listing once (on the launch checklist).
2. **The example coaches in your local database** only get the new lesson types and Mia's travel on a fresh database. The old ones work fine without.
3. **Not tried against real Stripe** (blocked from here). Booking at the golfer's choice only changes the place on the booking, not the payment.

## How to see it (Mac Terminal)

```bash
cd ~/bookon
git pull
pnpm install
pnpm db:dev                                                   # window 1
BOOKON_ADMIN_EMAIL=sambohlen88@gmail.com pnpm dev             # window 2
```

1. Open http://localhost:3000. The new font is everywhere.
2. Open **Find a coach** and try "Comes to you" and "Any type of lesson".
3. To try the coach side: sign in with another email in a private window (the link is in http://localhost:3000/dev/outbox), open **My coaching**, and use "Add another place", "I'm happy to travel to the player" and "Add another lesson". Send it, then approve it in your window under **Admin → Coaches**.
