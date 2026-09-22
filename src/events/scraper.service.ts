import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cheerio from 'cheerio';
import type { ScrapedEvent } from './event.types.js';

/**
 * Parses the Konakai calendar page HTML into raw scraped events.
 *
 * The event date and past-event flag are read from the
 * `.mec-masonry-item-wrap` ancestor's `data-sort-masonry` / `mec-past-event`
 * attributes rather than the `.mec-event-article` element itself -- the
 * wrapper carries the full ISO date, which the day/month/day-of-week text
 * nodes inside the article do not (they have no year).
 */
export function extractEvents(html: string): ScrapedEvent[] {
  const $ = cheerio.load(html);
  const events: ScrapedEvent[] = [];

  $('.mec-event-article').each((_, el) => {
    const $article = $(el);
    const $wrapper = $article.closest('[data-sort-masonry]');
    const date = $wrapper.attr('data-sort-masonry');

    const $booking = $article.find('a.mec-booking-button').first();
    const eventId = $booking.attr('data-event-id');
    const eventUrl = $booking.attr('href');

    if (!date || !eventId || !eventUrl) {
      return;
    }

    const title = $article
      .find('.mec-event-title')
      .clone()
      .find('span, a')
      .remove()
      .end()
      .text()
      .trim();

    const $description = $article.find('.mec-event-description').clone();
    $description.find('br').replaceWith('\n');
    const description =
      $description
        .find('p')
        .map((_i, p) => $(p).text().trim())
        .get()
        .filter(Boolean)
        .join('\n') || null;

    const location =
      $article
        .find('.mec-event-location-det')
        .text()
        .replace(/\s+/g, ' ')
        .trim() || null;

    const colorStyle = $article.find('.event-color').attr('style');
    const color = colorStyle?.match(/#[0-9a-fA-F]{3,6}/)?.[0] ?? null;

    const imageUrl = $article.find('.mec-masonry-img img').attr('src') ?? null;

    const timeText =
      $article.find('.mec-event-detail.time').text().trim() || null;

    events.push({
      event_id: eventId,
      event_url: eventUrl,
      date,
      time_text: timeText,
      title,
      description,
      location,
      image_url: imageUrl,
      color,
      is_past: $wrapper.hasClass('mec-past-event'),
    });
  });

  return events;
}

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  constructor(private readonly config: ConfigService) {}

  async scrape(): Promise<ScrapedEvent[]> {
    const url = this.config.get<string>(
      'SCRAPE_URL',
      'https://clubkonakai.noblehcalendar.com',
    );

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch calendar page (${response.status} ${response.statusText})`,
      );
    }

    const html = await response.text();
    const events = extractEvents(html);
    this.logger.log(`Scraped ${events.length} events from ${url}`);
    return events;
  }
}
