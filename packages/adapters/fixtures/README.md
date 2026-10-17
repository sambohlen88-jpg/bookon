# Adapter fixtures

Saved public booking pages used by the adapter tests, so tests never hit live club sites.

| File                                                   | Page                                                 | Saved     |
| ------------------------------------------------------ | ---------------------------------------------------- | --------- |
| `miclub/collier-park-calendar-2025-09-27.html`         | Collier Park MiClub public calendar                  | Sept 2025 |
| `miclub/collier-park-timesheet-2025-09-30-9holes.html` | Collier Park MiClub timesheet, 9 Holes fee group     | Sept 2025 |
| `miclub/fremantle-calendar-2025-09-27.html`            | Fremantle Public MiClub public calendar              | Sept 2025 |
| `miclub/fremantle-timesheet-2025-09-30-9holes.html`    | Fremantle Public MiClub timesheet, 9 Holes fee group | Sept 2025 |
| `quick18/hamersley-2025-10-18.html`                    | Hamersley Quick18 search matrix                      | Oct 2025  |
| `quick18/springs-2025-10-16.html`                      | The Springs Quick18 search matrix                    | Oct 2025  |

| `miclub/live-collier-park-calendar-2026-10-17.html` | Collier Park calendar, raw server response | 17 Oct 2026 |
| `miclub/live-collier-park-timesheet-2026-10-18-18holes.html` | Collier Park timesheet, 18 Holes greens coring rate, raw | 17 Oct 2026 |
| `miclub/live-fremantle-timesheet-2026-10-18-9holes.html` | Fremantle Public timesheet, single "concession" rate while greens are cored, raw | 17 Oct 2026 |
| `miclub/live-wembley-calendar-2026-10-17-captcha.html` | Wembley calendar with timesheet CAPTCHA switched on, raw | 17 Oct 2026 |
| `quick18/live-hamersley-2026-10-17.html` | Hamersley search matrix, evening with nothing left, raw | 17 Oct 2026 |
| `quick18/live-hamersley-2026-10-19.html` | Hamersley search matrix, raw | 17 Oct 2026 |

Source of the 2025 files: the test data of [TeeTimeFinder](https://github.com/Ay1tsMe/TeeTimeFinder) by Adam Wyatt, MIT licence.

The 2025 files were saved from a browser, after scripts ran. The `live-*` files are raw server responses recorded by `pnpm --filter @bookon/worker record` (see `apps/worker/README.md`). Record new ones the same way when a club's page changes.

`robots/` holds the robots.txt files of Quick18 and MiClub as read on 17 October 2026, for the HTTP client tests.
