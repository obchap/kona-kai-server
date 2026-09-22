# Konakai Calendar Scraper

A NestJS backend that scrapes the [Club Konakai calendar](https://clubkonakai.noblehcalendar.com), normalizes events into a clean schema, and serves them over a small HTTP API. Recurring ("staple") events like weekly Happy Hour are flagged separately from one-off events, so consumers can default to showing only what's special.

## How it works

1. **Scrape** (`src/events/scraper.service.ts`) — fetches the calendar page HTML and parses it with [cheerio](https://cheerio.js.org/). The page is server-rendered by WordPress/MEC, so no headless browser is needed.
2. **Normalize** (`src/events/normalize.ts`) — derives `day_of_week`/`month`/`day` from the scraped ISO date, splits time ranges into `time_start`/`time_end`, and classifies **staples**: any event title appearing 3+ times in a scrape is a staple.
3. **Cache** (`src/events/event-cache.service.ts`) — holds the normalized events in memory, with an optional JSON snapshot on disk so the cache survives a restart. Reads are always instant; a refresh swaps in new data only once the scrape completes, so a request during a refresh still gets the last-good data.
4. **Schedule** (`src/events/scraper-scheduler.service.ts`) — re-scrapes on a cron schedule (default: daily, 6 AM `America/Los_Angeles`).
5. **API** (`src/events/events.controller.ts`) — serves the cached data.

## Setup

Requires Node 20+ and [pnpm](https://pnpm.io/).

```bash
pnpm install
cp .env.example .env
```

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `SCRAPE_URL` | `https://clubkonakai.noblehcalendar.com` | Calendar page to scrape |
| `PORT` | `3000` | HTTP port |
| `SCRAPE_CRON` | `0 6 * * *` | Cron expression for the scheduled re-scrape (runs in `America/Los_Angeles`) |
| `SNAPSHOT_PATH` | *(unset)* | Path to persist a JSON snapshot of the cache to disk, e.g. `./data/events-snapshot.json`. If unset, the cache is memory-only and starts empty on every restart until the first scrape completes. |

## Running

```bash
pnpm start          # single run
pnpm start:dev      # watch mode
pnpm start:prod     # run the compiled build (pnpm build first)
```

On startup the app scrapes immediately and populates the cache before serving `/events`. If that initial scrape fails, the app still starts — `/events` will 500 until a scrape succeeds (scheduled or manual via `/events/refresh`).

## API

All responses share this envelope:

```json
{
  "scraped_at": "2026-09-21T09:00:00Z",
  "total": 137,
  "returned": 18,
  "events": [ /* KonakaiEvent[] */ ]
}
```

- `total` — number of events currently in the cache
- `returned` — number of events after filtering
- `scraped_at` — when the underlying cache data was last scraped

### `GET /events`

Returns cached events, instantly, filtered by the following optional query params:

| Param | Example | Effect |
|---|---|---|
| `staples` | `?staples=false` | Omit staple (recurring) events, returning one-offs only. Any other value (including omitting the param) returns everything. |
| `from` | `?from=2026-10-01` | Only events on or after this ISO date |
| `to` | `?to=2026-10-31` | Only events on or before this ISO date |

Params can be combined, e.g. `GET /events?staples=false&from=2026-10-01&to=2026-10-31`.

### `GET /events/refresh`

Triggers an immediate re-scrape and returns the full, refreshed event set once it completes. Concurrent calls (including one already running from the schedule) share a single in-flight scrape rather than starting duplicate ones.

### `KonakaiEvent` shape

```typescript
interface KonakaiEvent {
  event_id: string;
  event_url: string;

  date: string;               // ISO 8601, e.g. "2026-09-18"
  day_of_week: string;        // "Friday"
  month: string;              // "September"
  day: number;                // 18
  time_start: string | null;  // "5:00 pm"
  time_end: string | null;    // "9:00 pm"
  all_day: boolean;

  title: string;
  description: string | null; // plain text, newline-separated
  location: string | null;
  image_url: string | null;
  color: string | null;       // hex color from the event tag, e.g. "#fdd700"

  is_staple: boolean;         // true if this title appears 3+ times in the scraped set
  recurrence_count: number;   // how many times this exact title appears
}
```

## Testing

```bash
pnpm test         # unit tests
pnpm test:e2e     # e2e tests (boots the app with the scraper mocked)
pnpm test:cov     # coverage
```

Scraper unit tests run against `test/fixtures/konakai-calendar-sample.html`, a trimmed excerpt of real markup fetched from the live site (not hand-written HTML), so extraction logic is validated against the site's actual structure.

## Notes on the source site

The calendar is a WordPress site running the Modern Events Calendar plugin. Two things worth knowing if the site's markup changes and the scraper needs updating:

- The event date and past-event flag are read from the `.mec-masonry-item-wrap` element that wraps each `.mec-event-article` (`data-sort-masonry="2026-09-22"` / class `mec-past-event`), not from the article itself — that wrapper is the only place the full date (including year) actually appears.
- `extractEvents()` in `scraper.service.ts` is a pure function over raw HTML, independent of the network fetch, so selector changes can be diagnosed by saving a fresh page fetch and re-running the unit tests against it.
