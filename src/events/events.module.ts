import { Module } from '@nestjs/common';
import { EventCacheService } from './event-cache.service.js';
import { EventsController } from './events.controller.js';
import { ScraperService } from './scraper.service.js';

@Module({
  controllers: [EventsController],
  providers: [ScraperService, EventCacheService],
})
export class EventsModule {}
