import { normalizeEvents, STAPLE_THRESHOLD } from './normalize.js';
import type { ScrapedEvent } from './event.types.js';

function scrapedEvent(overrides: Partial<ScrapedEvent> = {}): ScrapedEvent {
  return {
    event_id: '1',
    event_url: 'https://clubkonakai.noblehcalendar.com/events/example/',
    date: '2026-09-18',
    time_text: '5:00 pm - 6:00 pm',
    title: 'Example Event',
    description: 'Some description',
    location: 'Vessel',
    image_url: null,
    color: '#fdd700',
    is_past: false,
    ...overrides,
  };
}

describe('normalizeEvents', () => {
  it('derives day_of_week, month, and day from the ISO date', () => {
    const [event] = normalizeEvents([scrapedEvent({ date: '2026-09-18' })]);

    expect(event.day_of_week).toBe('Friday');
    expect(event.month).toBe('September');
    expect(event.day).toBe(18);
    expect(event.date).toBe('2026-09-18');
  });

  it('splits a time range into time_start/time_end and sets all_day false', () => {
    const [event] = normalizeEvents([
      scrapedEvent({ time_text: '5:00 pm - 6:00 pm' }),
    ]);

    expect(event.time_start).toBe('5:00 pm');
    expect(event.time_end).toBe('6:00 pm');
    expect(event.all_day).toBe(false);
  });

  it('treats an "All Day" time_text (or a missing one) as all_day', () => {
    const [allDay, missing] = normalizeEvents([
      scrapedEvent({ time_text: 'All Day' }),
      scrapedEvent({ time_text: null }),
    ]);

    for (const event of [allDay, missing]) {
      expect(event.all_day).toBe(true);
      expect(event.time_start).toBeNull();
      expect(event.time_end).toBeNull();
    }
  });

  it('classifies a title recurring 3+ times as a staple', () => {
    const scraped = Array.from({ length: STAPLE_THRESHOLD }, (_, i) =>
      scrapedEvent({ event_id: String(i), title: 'Member Only Happy Hour 5pm-6pm' }),
    );

    const events = normalizeEvents(scraped);

    for (const event of events) {
      expect(event.is_staple).toBe(true);
      expect(event.recurrence_count).toBe(STAPLE_THRESHOLD);
    }
  });

  it('keeps a title recurring fewer than the threshold as a one-off', () => {
    const scraped = [
      scrapedEvent({ event_id: '1', title: 'Yoga & Mimosas' }),
      scrapedEvent({ event_id: '2', title: 'Yoga & Mimosas' }),
    ];

    const events = normalizeEvents(scraped);

    for (const event of events) {
      expect(event.is_staple).toBe(false);
      expect(event.recurrence_count).toBe(2);
    }
  });

  it('counts recurrence per exact title, independent of other titles', () => {
    const scraped = [
      ...Array.from({ length: 4 }, (_, i) =>
        scrapedEvent({ event_id: `staple-${i}`, title: 'Wine Wednesday' }),
      ),
      scrapedEvent({ event_id: 'one-off', title: 'Parents Night Out!' }),
    ];

    const events = normalizeEvents(scraped);
    const oneOff = events.find((e) => e.title === 'Parents Night Out!');
    const staple = events.find((e) => e.title === 'Wine Wednesday');

    expect(oneOff?.is_staple).toBe(false);
    expect(oneOff?.recurrence_count).toBe(1);
    expect(staple?.is_staple).toBe(true);
    expect(staple?.recurrence_count).toBe(4);
  });
});
