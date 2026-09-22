import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { EventCacheService } from './event-cache.service.js';
import type { ScraperService } from './scraper.service.js';
import type { ScrapedEvent } from './event.types.js';

function scrapedEvent(overrides: Partial<ScrapedEvent> = {}): ScrapedEvent {
  return {
    event_id: '1',
    event_url: 'https://clubkonakai.noblehcalendar.com/events/example/',
    date: '2026-09-18',
    time_text: '5:00 pm - 6:00 pm',
    title: 'Example Event',
    description: null,
    location: null,
    image_url: null,
    color: null,
    is_past: false,
    ...overrides,
  };
}

function fakeConfig(values: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe('EventCacheService', () => {
  let snapshotDir: string;

  beforeEach(async () => {
    snapshotDir = await mkdtemp(join(tmpdir(), 'konakai-cache-test-'));
  });

  afterEach(async () => {
    await rm(snapshotDir, { recursive: true, force: true });
  });

  it('populates the cache from a refresh and exposes it via getSnapshot', async () => {
    const scraper = { scrape: vi.fn().mockResolvedValue([scrapedEvent()]) } as unknown as ScraperService;
    const config = fakeConfig({ SNAPSHOT_PATH: undefined });
    const cache = new EventCacheService(scraper, config);

    await cache.refresh();

    const snapshot = cache.getSnapshot();
    expect(snapshot.events).toHaveLength(1);
    expect(snapshot.scraped_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('throws from getSnapshot before any refresh has completed', () => {
    const scraper = { scrape: vi.fn() } as unknown as ScraperService;
    const cache = new EventCacheService(scraper, fakeConfig({}));

    expect(() => cache.getSnapshot()).toThrow();
  });

  it('shares a single in-flight refresh across concurrent callers', async () => {
    const scrape = vi.fn().mockResolvedValue([scrapedEvent()]);
    const scraper = { scrape } as unknown as ScraperService;
    const cache = new EventCacheService(scraper, fakeConfig({}));

    await Promise.all([cache.refresh(), cache.refresh(), cache.refresh()]);

    expect(scrape).toHaveBeenCalledTimes(1);
  });

  it('keeps serving the stale snapshot while a new refresh is in flight', async () => {
    let resolveScrape!: (events: ScrapedEvent[]) => void;
    const scrape = vi
      .fn()
      .mockResolvedValueOnce([scrapedEvent({ title: 'First' })])
      .mockImplementationOnce(
        () => new Promise<ScrapedEvent[]>((resolve) => (resolveScrape = resolve)),
      );
    const scraper = { scrape } as unknown as ScraperService;
    const cache = new EventCacheService(scraper, fakeConfig({}));

    await cache.refresh();
    expect(cache.getSnapshot().events[0]?.title).toBe('First');

    const secondRefresh = cache.refresh();
    // While the second scrape is still pending, reads see the stale snapshot.
    expect(cache.getSnapshot().events[0]?.title).toBe('First');

    resolveScrape([scrapedEvent({ title: 'Second' })]);
    await secondRefresh;
    expect(cache.getSnapshot().events[0]?.title).toBe('Second');
  });

  it('writes and reloads a snapshot from disk', async () => {
    const snapshotPath = join(snapshotDir, 'nested', 'events-snapshot.json');
    const scraper = {
      scrape: vi.fn().mockResolvedValue([scrapedEvent({ title: 'Persisted' })]),
    } as unknown as ScraperService;
    const config = fakeConfig({ SNAPSHOT_PATH: snapshotPath });
    const cache = new EventCacheService(scraper, config);

    await cache.refresh();
    const raw = await readFile(snapshotPath, 'utf8');
    expect(JSON.parse(raw).events[0].title).toBe('Persisted');

    const reloaded = new EventCacheService(scraper, config);
    await reloaded.onModuleInit();
    expect(reloaded.getSnapshot().events[0]?.title).toBe('Persisted');
  });

  it('falls back to scraping on startup when no snapshot file exists', async () => {
    const scraper = {
      scrape: vi.fn().mockResolvedValue([scrapedEvent({ title: 'Fresh' })]),
    } as unknown as ScraperService;
    const config = fakeConfig({
      SNAPSHOT_PATH: join(snapshotDir, 'does-not-exist.json'),
    });
    const cache = new EventCacheService(scraper, config);

    await cache.onModuleInit();

    expect(cache.getSnapshot().events[0]?.title).toBe('Fresh');
  });
});
