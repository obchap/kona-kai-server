import { vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { SchedulerRegistry } from '@nestjs/schedule';
import type { CronJob } from 'cron';
import { ScraperSchedulerService } from './scraper-scheduler.service.js';
import type { EventCacheService } from './event-cache.service.js';

function fakeConfig(values: Record<string, string | undefined>): ConfigService {
  return {
    get: (key: string, fallback?: string) => values[key] ?? fallback,
  } as unknown as ConfigService;
}

describe('ScraperSchedulerService', () => {
  it('registers a single named cron job using the configured expression', () => {
    const addCronJob = vi.fn();
    const scheduler = { addCronJob } as unknown as SchedulerRegistry;
    const cache = { refresh: vi.fn() } as unknown as EventCacheService;
    const config = fakeConfig({ SCRAPE_CRON: '0 6 * * *' });

    const service = new ScraperSchedulerService(cache, config, scheduler);
    service.onModuleInit();

    expect(addCronJob).toHaveBeenCalledTimes(1);
    const [name, job] = addCronJob.mock.calls[0] as [string, CronJob];
    expect(name).toBe('daily-calendar-scrape');
    expect(job.isActive).toBe(true);
    void job.stop();
  });

  it('triggers a cache refresh when the scheduled job fires', async () => {
    const scheduler = { addCronJob: vi.fn() } as unknown as SchedulerRegistry;
    const refresh = vi.fn().mockResolvedValue(undefined);
    const cache = { refresh } as unknown as EventCacheService;
    const config = fakeConfig({});

    const service = new ScraperSchedulerService(cache, config, scheduler);
    service.onModuleInit();

    const [, job] = (scheduler.addCronJob as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, CronJob];
    await job.fireOnTick();
    void job.stop();

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('does not let a failed scrape crash the scheduler', async () => {
    const scheduler = { addCronJob: vi.fn() } as unknown as SchedulerRegistry;
    const refresh = vi.fn().mockRejectedValue(new Error('site is down'));
    const cache = { refresh } as unknown as EventCacheService;
    const config = fakeConfig({});

    const service = new ScraperSchedulerService(cache, config, scheduler);
    service.onModuleInit();

    const [, job] = (scheduler.addCronJob as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, CronJob];

    await expect(job.fireOnTick()).resolves.toBeUndefined();
    void job.stop();
  });

  it('stops the cron job on module destroy', () => {
    const addCronJob = vi.fn();
    const jobs = new Map<string, CronJob>();
    const scheduler = {
      addCronJob: (name: string, job: CronJob) => {
        addCronJob(name, job);
        jobs.set(name, job);
      },
      getCronJob: (name: string) => jobs.get(name)!,
    } as unknown as SchedulerRegistry;
    const cache = { refresh: vi.fn() } as unknown as EventCacheService;
    const config = fakeConfig({});

    const service = new ScraperSchedulerService(cache, config, scheduler);
    service.onModuleInit();

    const [, job] = addCronJob.mock.calls[0] as [string, CronJob];
    expect(job.isActive).toBe(true);

    service.onModuleDestroy();

    expect(job.isActive).toBe(false);
  });
});
