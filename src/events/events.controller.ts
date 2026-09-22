import { Controller, Get, Query } from '@nestjs/common';
import { EventCacheService } from './event-cache.service.js';
import type { EventsResponse } from './event.types.js';
import { filterEvents, type EventsQuery } from './events.filter.js';

@Controller('events')
export class EventsController {
  constructor(private readonly cache: EventCacheService) {}

  @Get()
  getEvents(@Query() query: EventsQuery): EventsResponse {
    const snapshot = this.cache.getSnapshot();
    const events = filterEvents(snapshot.events, query);

    return {
      scraped_at: snapshot.scraped_at,
      total: snapshot.events.length,
      returned: events.length,
      events,
    };
  }

  @Get('refresh')
  async refresh(): Promise<EventsResponse> {
    const snapshot = await this.cache.refresh();

    return {
      scraped_at: snapshot.scraped_at,
      total: snapshot.events.length,
      returned: snapshot.events.length,
      events: snapshot.events,
    };
  }
}
