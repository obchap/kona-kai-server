import { Module } from '@nestjs/common';
import { EventCacheService } from './event-cache.service.js';
import { EventsController } from './events.controller.js';
import { ScraperSchedulerService } from './scraper-scheduler.service.js';
import { ScraperService } from './scraper.service.js';

@Module({
  controllers: [EventsController],
  providers: [ScraperService, EventCacheService, ScraperSchedulerService],
})
export class EventsModule {}
