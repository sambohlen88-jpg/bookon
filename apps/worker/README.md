# BookOn worker

Reads tee time availability from club booking pages and stores it. Runs separately from the website.

## Commands

From the repo root:

```sh
pnpm db:dev                                           # local database server; keep it running
pnpm db:seed                                          # tables and courses
pnpm --filter @bookon/worker poll                     # one pass over every enabled course
pnpm --filter @bookon/worker poll -- --course hamersley --days 2
pnpm --filter @bookon/worker record -- --course collier-park --days 1
pnpm --filter @bookon/worker start                    # poll every POLL_INTERVAL_MINUTES
```

`--course` runs a course even if it is switched off, for testing it before enabling it. `--days` overrides the course's booking window, to find where a club's window really ends.

Behind an HTTP proxy, put `NODE_USE_ENV_PROXY=1` in front of these commands. Node's built-in `fetch` ignores `HTTPS_PROXY` otherwise.

`record` saves every page it fetches to `apps/worker/recordings/`. Use it on the first live run to replace the browser-saved fixtures in `packages/adapters/fixtures/` with raw server responses.

## Settings

| Variable                  | Default                             |                                                 |
| ------------------------- | ----------------------------------- | ----------------------------------------------- |
| `BOOKON_CONTACT_EMAIL`    | `info@bookon.com.au`                | Goes in the user agent so clubs can contact us. |
| `BOOKON_SITE_URL`         | `https://bookon.com.au`             | Also in the user agent.                         |
| `DATABASE_URL`            | local PGlite server (`pnpm db:dev`) | `postgres://...` for Supabase or Neon.          |
| `POLL_INTERVAL_MINUTES`   | 30                                  | For `start`.                                    |
| `MIN_REQUEST_INTERVAL_MS` | 3000                                | Gap between requests to the same site.          |

## How it behaves

- Polls each enabled course from today to the end of its booking window.
- Requests to one site go one at a time with a gap. Different sites run in parallel.
- Honours robots.txt. If robots.txt cannot be read, it does not fetch (RFC 9309).
- Retries network errors, 429 and 5xx twice with back-off, honouring `Retry-After`.
- A page that does not look like the expected platform page is an error, never "no tee times".
- If a club puts its pages behind a CAPTCHA, the worker stops and records `CaptchaRequiredError`. It never tries to get past one.
- A failing course is recorded in `fetch_runs` and `availability_checks` and does not stop the others. Its old tee times are kept but marked stale, so the site can show a notice.
