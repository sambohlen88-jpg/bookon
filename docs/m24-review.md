# Milestone 24 review: News, privacy policy and terms

24 October 2026. You approved a Golf in Perth news section: a writing desk in Admin with pictures, links to socials, the latest article featured on the news page, example articles, and authors whose articles you approve before they're published. Also a privacy policy. You said the ABN is coming soon, so the business name and ABN can be added in Settings whenever it arrives. As I recommended, terms of use are drafted too, and articles have no comments. Launch is now Milestone 25.

**About the screenshots:** they're from my local database. "Jess Walker" is a made-up author and her article is made up. The six example articles are the real examples that ship with BookOn (marked as examples). The picture in Jess's article is a simple drawing I made for the test, not a photo.

## What was done

### The news page (/news)

[Desktop](./m24/m24-news-desktop.png), [phone](./m24/m24-news-phone.png), [home page](./m24/m24-home-news-strip.png)

- **The newest article is the big feature at the top**, with its picture, headline, summary and author. Every other article follows, newest first, 12 to a page.
- **Category buttons:** Course news, Tips and how-to, Competitions, Around Perth, Gear.
- **"Latest news"** on the home page (phone and desktop), and **News** in the header and footer.
- An **RSS feed** at /news/rss.xml for news readers, and every article is in the sitemap.

### An article

[Desktop](./m24/m24-article-by-author.png), [phone](./m24/m24-article-phone.png), [link preview](./m24/m24-og-card.png)

- The category, date and reading time, the headline, summary and author, then the cover picture. A cover is either an uploaded picture or one of BookOn's course drawings.
- The article itself, with headings, bold, links, lists, quotes, and pictures with captions.
- **Share buttons:** Facebook, X, WhatsApp, email and copy link. They're plain links, so nothing loads from those sites until someone taps.
- **"Follow BookOn"** to your Instagram, Facebook and TikTok. It shows once they're added in Admin → Settings; they're not set in my test.
- The author's short bio, if they've written one, and **More news**.
- **Shared links look good:** Facebook, WhatsApp and others show a BookOn News card with the headline ([example](./m24/m24-og-card.png)). Google gets news article details.

### Admin → News (your writing desk)

[List](./m24/m24-admin-news-after.png), [approving an article](./m24/m24-admin-review.png), [menu badge](./m24/m24-admin-nav-badge.png)

- **Every article by status:** waiting for your approval (also counted on the News menu item), drafts, scheduled, published.
- **The editor** ([screenshot](./m24/m24-write-editor.png), [preview](./m24/m24-write-preview.png)):
  - headline, summary and category
  - a cover picture: none, uploaded, or a course drawing, with a description
  - formatting buttons: heading, smaller heading, bold, italics, link, bullet list, numbered list, quote
  - **Add a picture**, which goes where your cursor is, with a description and optional caption
  - a **Preview** tab that shows it exactly as golfers will
- **Publish now, or schedule** for a Perth day and time; it goes live by itself. You can also unpublish, edit after publishing (the web address stays the same, so shared links keep working), and delete.
- **Pictures:** each upload asks the writer to confirm they took it or have permission, with their name. Pictures are resized for phones and **hidden details like GPS location are removed**.
- **Example articles:** six about golf in Perth, with "Remove all examples" (and "Add the example articles" to put them back). A new local database gets them automatically. On the live site, add them with the button.

### Authors

[Making an author](./m24/m24-admin-user-author.png), [the author's page](./m24/m24-write-home.png), [sent back](./m24/m24-write-sent-back.png)

1. The person signs in to BookOn once. In **Admin → Users**, open them and press **"Let them write news"**, giving the name to show on their articles.
2. They get a **Write** link in the header, and their own page at **/write** with the same editor. They can set their name and a short bio.
3. They **send articles to you for approval** and can't publish. **You're emailed** with a link straight to it.
4. You **approve** (publish now or schedule), or **send it back with a note**. They're emailed either way, and see your note on their article.
5. Once published, only you can change it. "Stop them writing news" takes access away; their published articles stay up.

### Privacy policy and terms

[Privacy policy](./m24/m24-privacy.png), [on a phone](./m24/m24-privacy-phone.png), [terms](./m24/m24-terms.png), [business details](./m24/m24-settings-business.png)

- **/privacy**, in plain English, with a short version up top. It covers everything BookOn collects from every milestone so far:
  - looking around (the anonymous cookie, searches, clicks to clubs, analytics, Near me)
  - accounts, alerts and notifications
  - lessons, group sessions, events and match play, and payments through Stripe
  - coaches, clubs and news authors
- It also covers cookies, who BookOn shares data with, overseas storage, emails, how long things are kept, how to see, change or delete your details, complaints to the OAIC, and security.
- **/terms:**
  - tee times are booked with the club
  - lessons and events are run by the coach or club, with the refund rules shown at booking
  - fair ratings, and rules for authors' content and pictures
  - fair use
  - the Australian Consumer Law, and Western Australian law
- **Links to the policy** are in the footer, on sign-in, and beside every booking and entry form.
- **Admin → Settings → Business details:** add the business name and ABN, and both pages show them straight away. The ABN is checked the way the Australian Business Register checks it, so a typo is caught.

## Checked

| Check               | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser walkthrough | <ul><li>Removed and re-added the example articles from Admin.</li><li>The news page, an article, categories, the phone layout, the home page strip, the RSS feed (6 items) and the link preview picture all worked.</li><li>A new person signed in and got "not found" at /write, and their picture upload was refused. You made them an author, then they could.</li><li>They wrote an article with a course drawing as cover, a heading, bold text and a list, uploaded a picture with a caption, and sent it in. You were emailed.</li><li>You sent it back with a note. They saw the note, added to it and sent it again. You approved it, they were emailed, and it became the **Latest** article, picture and all.</li><li>An article scheduled for tomorrow stayed off the news page.</li><li>The privacy policy and terms showed the business name and ABN once added, and a wrong ABN was refused.</li><li>No page errors.</li></ul> |
| Tests               | 504 passing (12 new). They cover:<ul><li>the formatting language: headings, lists, quotes, pictures, bold and links</li><li>dangerous links and outside pictures being refused, and HTML staying plain text</li><li>reading time and article addresses</li><li>draft, send in, send back, approve and schedule</li><li>authors unable to change published articles, and addresses kept after publishing</li><li>unique addresses</li><li>the news page order, categories and pages</li><li>adding and removing the examples</li><li>the Author group</li><li>the article form and publish times</li><li>the ABN check</li></ul>                                                                                                                                                                                                                                                                                                               |
| All checks          | `format:check`, `lint`, `typecheck`, `test` and `build` pass.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

### Fixed while checking

- **The heading and list buttons** selected the "##" mark along with the placeholder word, so typing a heading replaced the mark too. That's why "1. Book early on weekends" shows as a list rather than a heading in the screenshots. Now only the placeholder word is selected.
- **The home page's two "Latest news" strips** (phone and desktop) shared an id. Each has its own now.
- **My local test database was damaged** (from stopping it mid-write after the last milestone). I set it aside and started a fresh one. That only affects my cloud copy, not yours.

## Decisions I made

1. **Your articles are by "BookOn team".** Authors' articles carry their own name.
2. **Articles use a small formatting language, not a full word processor.** It's quick, works on a phone, and nothing in an article can run code on the site.
3. **Pictures in articles must be uploaded to BookOn** (or be course drawings). Pictures can't be linked from other sites, which keeps out copied photos and tracking.
4. **Link previews use a BookOn News card** with the headline, rather than the cover picture. Course drawings can't be used as previews, and the card looks the same everywhere.
5. **The example articles are general and evergreen.** No prices, hours or claims about a particular club that I can't stand behind. They mention BookOn features that exist (alerts, sorting, the forecast on course pages).
6. **Article views appear in Analytics** under "News" and "News article". Authors' /write pages aren't counted, like the other portals.

## Open issues

1. **The privacy policy and terms are drafts, not legal advice.** They need a lawyer before launch. That's on the launch checklist, with the other privacy items now covered by the draft.
2. **Search and click records have no deletion date yet.** The policy says they're linked only to the anonymous visitor number. Decide how long to keep them (on the checklist).
3. **Business name and ABN:** add them in Admin → Settings when the ABN arrives.
4. **Social links aren't set**, so "Follow BookOn" doesn't show yet. Add them in Admin → Settings.
5. **No comments** on articles, as agreed. Readers share instead.

## How to demo (on your PC, in PowerShell)

```powershell
cd ~\bookon
git pull
pnpm install
pnpm db:dev                                                      # window 1
pnpm dev:worker                                                  # window 2 (adds the example articles)
$env:BOOKON_ADMIN_EMAIL="sambohlen88@gmail.com"; pnpm dev        # window 3
```

1. Open http://localhost:3000/news. The example articles are there.
2. Sign in, then go to **Admin → News → Write an article**. Try the formatting buttons, add a picture, press **Preview**, then **Publish now**. It's the new Latest article on /news.
3. To try an author: in a private window, sign in with another email (the link is in http://localhost:3000/dev/outbox). Back in your window, open them in **Admin → Users** and press **Let them write news**. In the private window, refresh and use **Write**.
4. Have a read of http://localhost:3000/privacy and http://localhost:3000/terms.
