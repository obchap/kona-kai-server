import { filterEvents } from './events.filter.js';
import type { KonakaiEvent } from './event.types.js';

function event(overrides: Partial<KonakaiEvent> = {}): KonakaiEvent {
  return {
    event_id: '1',
    event_url: 'https://clubkonakai.noblehcalendar.com/events/example/',
    date: '2026-09-18',
    day_of_week: 'Friday',
    month: 'September',
    day: 18,
    time_start: '5:00 pm',
    time_end: '6:00 pm',
    all_day: false,
    title: 'Example',
    description: null,
    location: null,
    image_url: null,
    color: null,
    is_staple: false,
    recurrence_count: 1,
    ...overrides,
  };
}

describe('filterEvents', () => {
  it('returns everything when no query params are given', () => {
    const events = [event({ is_staple: false }), event({ is_staple: true })];
    expect(filterEvents(events, {})).toHaveLength(2);
  });

  it('returns everything when staples=true', () => {
    const events = [event({ is_staple: false }), event({ is_staple: true })];
    expect(filterEvents(events, { staples: 'true' })).toHaveLength(2);
  });

  it('excludes staples when staples=false', () => {
    const events = [
      event({ event_id: '1', is_staple: false }),
      event({ event_id: '2', is_staple: true }),
    ];
    const result = filterEvents(events, { staples: 'false' });
    expect(result).toHaveLength(1);
    expect(result[0]?.event_id).toBe('1');
  });

  it('filters by inclusive date range', () => {
    const events = [
      event({ event_id: 'before', date: '2026-09-30' }),
      event({ event_id: 'in-range-start', date: '2026-10-01' }),
      event({ event_id: 'in-range-end', date: '2026-10-31' }),
      event({ event_id: 'after', date: '2026-11-01' }),
    ];

    const result = filterEvents(events, { from: '2026-10-01', to: '2026-10-31' });

    expect(result.map((e) => e.event_id)).toEqual(['in-range-start', 'in-range-end']);
  });

  it('combines staples and date filters', () => {
    const events = [
      event({ event_id: 'staple-in-range', date: '2026-10-05', is_staple: true }),
      event({ event_id: 'one-off-in-range', date: '2026-10-05', is_staple: false }),
      event({ event_id: 'one-off-out-of-range', date: '2026-11-05', is_staple: false }),
    ];

    const result = filterEvents(events, {
      staples: 'false',
      from: '2026-10-01',
      to: '2026-10-31',
    });

    expect(result.map((e) => e.event_id)).toEqual(['one-off-in-range']);
  });
});
