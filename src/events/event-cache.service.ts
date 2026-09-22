import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { KonakaiEvent } from './event.types.js';
import { normalizeEvents } from './normalize.js';
import { ScraperService } from './scraper.service.js';

export interface EventCacheSnapshot {
  scraped_at: string;
  events: KonakaiEvent[];
}

/**
 * Holds the current scraped/normalized events in memory, with an optional
 * JSON snapshot on disk so the cache survives a restart. Reads
 * (`getSnapshot`) always return instantly from memory; `refresh()` swaps in
 * a new snapshot once a re-scrape completes, so callers reading the cache
 * while a refresh is in flight keep getting the last-good data.
 */
@Injectable()
export class EventCacheService implements OnModuleInit {
  private readonly logger = new Logger(EventCacheService.name);
  private snapshot: EventCacheSnapshot | null = null;
  private refreshing: Promise<EventCacheSnapshot> | null = null;

  constructor(
    private readonly scraper: ScraperService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.loadSnapshotFromDisk();
    if (!this.snapshot) {
      await this.refresh();
    }
  }

  getSnapshot(): EventCacheSnapshot {
    if (!this.snapshot) {
      throw new Error('Event cache has not been populated yet');
    }
    return this.snapshot;
  }

  /** Re-scrapes and swaps in a new snapshot. Concurrent callers share one in-flight refresh. */
  refresh(): Promise<EventCacheSnapshot> {
    this.refreshing ??= this.doRefresh().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  private async doRefresh(): Promise<EventCacheSnapshot> {
    const scraped = await this.scraper.scrape();
    const snapshot: EventCacheSnapshot = {
      scraped_at: new Date().toISOString(),
      events: normalizeEvents(scraped),
    };

    this.snapshot = snapshot;
    await this.writeSnapshotToDisk(snapshot);
    return snapshot;
  }

  private get snapshotPath(): string | null {
    return this.config.get<string>('SNAPSHOT_PATH') ?? null;
  }

  private async loadSnapshotFromDisk(): Promise<void> {
    const path = this.snapshotPath;
    if (!path) return;

    try {
      const raw = await readFile(path, 'utf8');
      this.snapshot = JSON.parse(raw) as EventCacheSnapshot;
      this.logger.log(
        `Loaded cached snapshot from ${path} (scraped_at ${this.snapshot.scraped_at})`,
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn(
          `Failed to read snapshot at ${path}: ${(error as Error).message}`,
        );
      }
    }
  }

  private async writeSnapshotToDisk(
    snapshot: EventCacheSnapshot,
  ): Promise<void> {
    const path = this.snapshotPath;
    if (!path) return;

    try {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, JSON.stringify(snapshot, null, 2), 'utf8');
    } catch (error) {
      this.logger.warn(
        `Failed to write snapshot to ${path}: ${(error as Error).message}`,
      );
    }
  }
}
