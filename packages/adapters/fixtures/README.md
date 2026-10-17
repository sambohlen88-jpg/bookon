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

Source: the test data of [TeeTimeFinder](https://github.com/Ay1tsMe/TeeTimeFinder) by Adam Wyatt, MIT licence.

These were saved from a browser, so they reflect the page after scripts ran, not the raw server response. Replace them with raw responses recorded by `pnpm --filter @bookon/worker record` once the worker has run against the live sites (see `apps/worker/README.md`).
