import type { KonakaiEvent } from './event.types.js';

export interface EventsQuery {
  staples?: string;
  from?: string;
  to?: string;
}

/**
 * Applies the `?staples=`/`?from=`/`?to=` query params to a snapshot's
 * events. `staples` only narrows the set when explicitly "false" -- omitting
 * it, or passing "true", returns everything (matches the spec's endpoint
 * table, where the default view of one-offs-only is a client-side choice,
 * not the server's default).
 */
export function filterEvents(
  events: KonakaiEvent[],
  query: EventsQuery,
): KonakaiEvent[] {
  let result = events;

  if (query.staples === 'false') {
    result = result.filter((event) => !event.is_staple);
  }

  const { from, to } = query;

  if (from) {
    result = result.filter((event) => event.date >= from);
  }

  if (to) {
    result = result.filter((event) => event.date <= to);
  }

  return result;
}
