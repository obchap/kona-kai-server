import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { ScraperService } from '../src/events/scraper.service.js';
import type { ScrapedEvent } from '../src/events/event.types.js';

const scraped: ScrapedEvent[] = [
  {
    event_id: '1',
    event_url: 'https://clubkonakai.noblehcalendar.com/events/parents-night-out/',
    date: '2026-09-18',
    time_text: '5:00 pm - 9:00 pm',
    title: 'Parents Night Out!',
    description: 'A fun night.',
    location: 'Coronado Room',
    image_url: null,
    color: '#fdd700',
    is_past: false,
  },
  ...Array.from({ length: 3 }, (_, i) => ({
    event_id: `staple-${i}`,
    event_url: 'https://clubkonakai.noblehcalendar.com/events/happy-hour/',
    date: `2026-09-${19 + i}`,
    time_text: '5:00 pm - 6:00 pm',
    title: 'Member Only Happy Hour 5pm-6pm',
    description: null,
    location: 'Vessel Restaurant & Bar',
    image_url: null,
    color: null,
    is_past: false,
  })),
];

describe('EventsController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ScraperService)
      .useValue({ scrape: async () => scraped })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /events returns all events with a response envelope', async () => {
    const res = await request(app.getHttpServer()).get('/events').expect(200);

    expect(res.body.total).toBe(4);
    expect(res.body.returned).toBe(4);
    expect(res.body.events).toHaveLength(4);
    expect(res.body.scraped_at).toEqual(expect.any(String));
  });

  it('GET /events?staples=false returns only the one-off event', async () => {
    const res = await request(app.getHttpServer())
      .get('/events?staples=false')
      .expect(200);

    expect(res.body.total).toBe(4);
    expect(res.body.returned).toBe(1);
    expect(res.body.events[0].title).toBe('Parents Night Out!');
    expect(res.body.events[0].is_staple).toBe(false);
  });

  it('GET /events?from=&to= filters by date range', async () => {
    const res = await request(app.getHttpServer())
      .get('/events?from=2026-09-19&to=2026-09-19')
      .expect(200);

    expect(res.body.returned).toBe(1);
    expect(res.body.events[0].date).toBe('2026-09-19');
  });

  it('GET /events/refresh re-scrapes and returns the full set', async () => {
    const res = await request(app.getHttpServer())
      .get('/events/refresh')
      .expect(200);

    expect(res.body.total).toBe(4);
    expect(res.body.returned).toBe(4);
  });
});
