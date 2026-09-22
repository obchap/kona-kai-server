import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { EventCacheService } from './event-cache.service.js';

const DEFAULT_CRON = '0 6 * * *'; // 6 AM
const CALENDAR_TIMEZONE = 'America/Los_Angeles'; // the club is in San Diego (PT)
const JOB_NAME = 'daily-calendar-scrape';

/**
 * Registers the daily re-scrape job via SchedulerRegistry (rather than the
 * @Cron() decorator) so the cron expression can be read from ConfigService
 * at runtime -- a decorator's arguments are fixed when the class is
 * defined, before Nest has loaded the config module.
 */
@Injectable()
export class ScraperSchedulerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ScraperSchedulerService.name);

  constructor(
    private readonly cache: EventCacheService,
    private readonly config: ConfigService,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    const cronExpression = this.config.get<string>('SCRAPE_CRON', DEFAULT_CRON);

    const job = new CronJob(
      cronExpression,
      () => {
        this.runScheduledRefresh().catch((error: unknown) => {
          this.logger.error(
            `Scheduled scrape failed: ${(error as Error).message}`,
          );
        });
      },
      null,
      false,
      CALENDAR_TIMEZONE,
    );

    this.scheduler.addCronJob(JOB_NAME, job);
    job.start();
    this.logger.log(
      `Scheduled daily scrape "${cronExpression}" (${CALENDAR_TIMEZONE})`,
    );
  }

  onModuleDestroy(): void {
    void this.scheduler.getCronJob(JOB_NAME).stop();
  }

  private async runScheduledRefresh(): Promise<void> {
    await this.cache.refresh();
    this.logger.log('Scheduled scrape completed');
  }
}
