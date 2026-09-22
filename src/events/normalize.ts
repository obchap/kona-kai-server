import type { KonakaiEvent, ScrapedEvent } from './event.types.js';

/** Titles appearing at least this many times in a scrape are staples. */
export const STAPLE_THRESHOLD = 3;

const WEEKDAY_FORMAT = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  timeZone: 'UTC',
});
const MONTH_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  timeZone: 'UTC',
});

function parseDateParts(isoDate: string): {
  day_of_week: string;
  month: string;
  day: number;
} {
  const parsed = new Date(`${isoDate}T00:00:00Z`);
  return {
    day_of_week: WEEKDAY_FORMAT.format(parsed),
    month: MONTH_FORMAT.format(parsed),
    day: parsed.getUTCDate(),
  };
}

function parseTimeText(timeText: string | null): {
  time_start: string | null;
  time_end: string | null;
  all_day: boolean;
} {
  if (!timeText || /all day/i.test(timeText)) {
    return { time_start: null, time_end: null, all_day: true };
  }

  const [start, end] = timeText.split(/\s*-\s*/, 2);
  return {
    time_start: start?.trim() || null,
    time_end: end?.trim() || null,
    all_day: false,
  };
}

function countByTitle(events: ScrapedEvent[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const event of events) {
    counts.set(event.title, (counts.get(event.title) ?? 0) + 1);
  }
  return counts;
}

export function normalizeEvents(scraped: ScrapedEvent[]): KonakaiEvent[] {
  const recurrenceCounts = countByTitle(scraped);

  return scraped.map((event) => {
    const { day_of_week, month, day } = parseDateParts(event.date);
    const { time_start, time_end, all_day } = parseTimeText(event.time_text);
    const recurrence_count = recurrenceCounts.get(event.title) ?? 1;

    return {
      event_id: event.event_id,
      event_url: event.event_url,
      date: event.date,
      day_of_week,
      month,
      day,
      time_start,
      time_end,
      all_day,
      title: event.title,
      description: event.description,
      location: event.location,
      image_url: event.image_url,
      color: event.color,
      is_staple: recurrence_count >= STAPLE_THRESHOLD,
      recurrence_count,
    };
  });
}
