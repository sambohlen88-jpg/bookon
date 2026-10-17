# Courses

Every course BookOn knows about, and whether search covers it. The seed data in `packages/db/src/seed.ts` is the source of truth; this page explains it. Last updated 17 October 2026.

## Searchable (26)

All on MiClub except Hamersley (Quick18). Each was test-read live before being switched on.

### Perth metro and Peel

| Course             | Suburb         | Holes | Booking window | Notes                                                                     |
| ------------------ | -------------- | ----- | -------------- | ------------------------------------------------------------------------- |
| Collier Park       | Como           | 27    | 8 days         | Three nines; prices change with demand                                    |
| Fremantle Public   | Fremantle      | 18    | 9 days         |                                                                           |
| Hamersley Public   | Karrinyup      | 18    | 14 days        | Quick18. Claude can't fetch it (see platforms.md); the owner's worker can |
| Hartfield          | Forrestfield   | 18    | not confirmed  | Members' club selling public times                                        |
| Joondalup Resort   | Connolly       | 27    | not confirmed  | 18 hole rates include a cart                                              |
| Kwinana            | Medina         | 18    | not confirmed  |                                                                           |
| Links Kennedy Bay  | Port Kennedy   | 18    | not confirmed  |                                                                           |
| Marangaroo         | Marangaroo     | 18    | 11 days        | Belgravia Leisure                                                         |
| Maylands Peninsula | Maylands       | 18    | not confirmed  |                                                                           |
| Meadow Springs     | Meadow Springs | 18    | not confirmed  | Weekday and weekend rates                                                 |
| Pinjarra           | Pinjarra       | 18    | not confirmed  |                                                                           |
| Point Walter       | Bicton         | 9     | 11 days        | Belgravia Leisure; left Quick18 in 2026                                   |
| Rockingham         | Rockingham     | 18    | not confirmed  | "Social Golf Bookings" calendar; fees in a pop-up                         |
| Secret Harbour     | Secret Harbour | 18    | not confirmed  |                                                                           |
| Sun City           | Yanchep        | 18    | not confirmed  | Members' club selling public times                                        |
| The Cut            | Dawesville     | 18    | not confirmed  | About 80 km from the CBD                                                  |
| Whaleback          | Parkwood       | 18    | 10 days        |                                                                           |

### Regional WA

| Course            | Town           | Holes | Booking window |
| ----------------- | -------------- | ----- | -------------- |
| Albany            | Albany         | 18    | not confirmed  |
| Broome            | Broome         | 18    | not confirmed  |
| Bunbury           | Bunbury        | 18    | not confirmed  |
| Busselton         | Busselton      | 18    | not confirmed  |
| Capel             | Capel          | 18    | not confirmed  |
| Dunsborough Lakes | Dunsborough    | 18    | not confirmed  |
| Geraldton         | Geraldton      | 18    | not confirmed  |
| Karratha          | Karratha       | 18    | not confirmed  |
| Margaret River    | Margaret River | 18    | not confirmed  |

"Not confirmed" windows are set to 14 days, the longest search. Days a club hasn't released yet come back as an empty calendar, which BookOn reads as "nothing yet" rather than an error.

## Known but switched off

| Course                    | Why                          | What would unlock it                                                                                                                     |
| ------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Wembley                   | Timesheets behind a CAPTCHA  | The club's permission or a feed (Town of Cambridge)                                                                                      |
| The Springs (Forrestdale) | Quick18, which blocks Claude | The owner runs `pnpm --filter @bookon/worker poll -- --course the-springs --days 2` on their own computer; switch on if it reads cleanly |
| Lake Claremont            | Quick18, which blocks Claude | Same, with `--course lake-claremont`                                                                                                     |

## Found but not added

| Course                                                                                                       | Why                                                                                                        |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Carramar                                                                                                     | Its site answers 403 to BookOnBot, even for robots.txt                                                     |
| Embleton                                                                                                     | Its calendar (Maylands site, resource 3900000) was empty on 17 October 2026; may be closed for greens work |
| Gosnells                                                                                                     | No public calendar online; visitors on Mondays by arrangement                                              |
| Wanneroo                                                                                                     | "Please contact Pro Shop for public tee times"                                                             |
| Mandurah Country Club, Lakelands, Collie, Esperance, Altone Park, Port Hedland, Katanning, Merredin, Denmark | On MiClub, but no public calendar on the default resource                                                  |
| Augusta, Exmouth, Narrogin, Northam, York                                                                    | On MiClub's OneGolf product, with no public calendar                                                       |
| The Vines                                                                                                    | MiClub calendar is members' competitions only                                                              |
| Carnarvon (miclub address)                                                                                   | It's Carnarvon Golf Club in Sydney, not WA                                                                 |
| Hillview, Araluen, Armadale, Kalgoorlie, Marri Park                                                          | No `<club>.miclub.com.au` site found; booking system unknown                                               |
| Royal Perth, Lake Karrinyup, Mt Lawley, Cottesloe, WA Golf Club, Nedlands                                    | Private clubs; visitors by enquiry, not online booking                                                     |

## How the list was built

1. Web searches, and the courses already researched in `platforms.md`.
2. One polite request each to the public calendars of about 60 likely `<club>.miclub.com.au` addresses. That checked whether the site exists, the club's name and location, the rate names, and whether there's a CAPTCHA.
3. A short live read of each candidate through the worker, then a check of the stored prices and course names.

TeeNet, MiClub's own directory, would be a fuller source, but its club list needs a browser session.
