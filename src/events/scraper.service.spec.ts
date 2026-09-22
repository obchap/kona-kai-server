import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { extractEvents } from './scraper.service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureHtml = readFileSync(
  join(__dirname, '..', '..', 'test', 'fixtures', 'konakai-calendar-sample.html'),
  'utf8',
);

describe('extractEvents', () => {
  it('extracts every event article in the page', () => {
    const events = extractEvents(fixtureHtml);
    expect(events).toHaveLength(6);
  });

  it('reads the date and past flag from the wrapper, not the article', () => {
    const events = extractEvents(fixtureHtml);
    const happyHour = events.find((e) => e.title === 'Member Only Happy Hour 5pm-6pm');

    expect(happyHour?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(typeof happyHour?.is_past).toBe('boolean');
  });

  it('strips the color span and comment anchor out of the title', () => {
    const events = extractEvents(fixtureHtml);
    for (const event of events) {
      expect(event.title).not.toContain('<');
      expect(event.title.length).toBeGreaterThan(0);
    }
  });

  it('extracts a multi-paragraph description as newline-joined plain text', () => {
    const events = extractEvents(fixtureHtml);
    const gentlemensNight = events.find((e) =>
      e.title.startsWith('Gentlemen'),
    );

    expect(gentlemensNight?.description).toContain('\n');
    expect(gentlemensNight?.description).not.toContain('<');
  });

  it('parses the hex color from the event-color style attribute when present', () => {
    const events = extractEvents(fixtureHtml);
    const gentlemensNight = events.find((e) =>
      e.title.startsWith('Gentlemen'),
    );
    const happyHour = events.find((e) => e.title === 'Member Only Happy Hour 5pm-6pm');

    expect(gentlemensNight?.color).toMatch(/^#[0-9a-fA-F]{3,6}$/);
    expect(happyHour?.color).toBeNull();
  });

  it('captures event id and url from the booking button', () => {
    const events = extractEvents(fixtureHtml);
    for (const event of events) {
      expect(event.event_id).toMatch(/^\d+$/);
      expect(event.event_url).toMatch(/^https:\/\//);
    }
  });
});
