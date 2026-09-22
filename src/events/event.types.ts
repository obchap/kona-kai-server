export interface KonakaiEvent {
  // Identity
  event_id: string;
  event_url: string;

  // Date & time
  date: string;
  day_of_week: string;
  month: string;
  day: number;
  time_start: string | null;
  time_end: string | null;
  all_day: boolean;

  // Content
  title: string;
  description: string | null;
  location: string | null;
  image_url: string | null;
  color: string | null;

  // Classification (derived, not scraped)
  is_staple: boolean;
  recurrence_count: number;
}

/**
 * Raw fields pulled straight off the DOM, before time parsing or staple
 * classification.
 *
 * `date` and `is_past` come from the `data-sort-masonry` / `mec-past-event`
 * attributes on the `.mec-masonry-item-wrap` ancestor of `.mec-event-article`,
 * not from the day/month/day-of-week text nodes the spec's selector table
 * describes — that text has no year, so the wrapper's ISO date is the only
 * reliable source of the real calendar date.
 */
export interface ScrapedEvent {
  event_id: string;
  event_url: string;
  date: string;
  time_text: string | null;
  title: string;
  description: string | null;
  location: string | null;
  image_url: string | null;
  color: string | null;
  is_past: boolean;
}

export interface EventsResponse {
  scraped_at: string;
  total: number;
  returned: number;
  events: KonakaiEvent[];
}
