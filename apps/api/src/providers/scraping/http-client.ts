import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { UpstreamError } from '../../lib/errors.js';
import { HostRateLimiter, sleep } from './rate-limiter.js';
import { RobotsChecker } from './robots.js';

interface CacheEntry {
  body: string;
  storedAt: number;
}

export interface ScrapeOptions {
  signal?: AbortSignal | undefined;
  /** Skip the cache for this call (used by manual "fetch now"). */
  fresh?: boolean;
  headers?: Record<string, string>;
}

/**
 * Shared HTTP client for every HTML-scraping adapter (Otomoto today,
 * autoplac.pl / OLX next).
 *
 * Responsibilities kept in one place so a new adapter cannot forget them:
 * robots.txt compliance, per-host throttling, a short response cache, retries
 * with backoff on 429/5xx, and browser-shaped headers.
 */
export class ScrapingClient {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly userAgent = env.SCRAPER_USER_AGENT,
    private readonly limiter = new HostRateLimiter(env.SCRAPER_MIN_DELAY_MS),
    private readonly robots = new RobotsChecker(
      env.SCRAPER_USER_AGENT,
      env.SCRAPER_RESPECT_ROBOTS,
    ),
    private readonly cacheTtlMs = env.SCRAPER_CACHE_TTL_MS,
    private readonly maxRetries = env.SCRAPER_MAX_RETRIES,
  ) {}

  async fetchHtml(url: string | URL, options: ScrapeOptions = {}): Promise<string> {
    const target = typeof url === 'string' ? new URL(url) : url;
    const key = target.toString();

    if (!options.fresh) {
      const cached = this.cache.get(key);
      if (cached && Date.now() - cached.storedAt < this.cacheTtlMs) {
        logger.debug({ url: key }, 'Scrape cache hit');
        return cached.body;
      }
    }

    if (!(await this.robots.isAllowed(target))) {
      throw new UpstreamError(
        `robots.txt zabrania pobierania ${target.pathname} na ${target.host}`,
      );
    }

    // Honour Crawl-delay when the site asks for more than our default gap.
    const crawlDelay = await this.robots.crawlDelayMs(target.origin);
    if (crawlDelay && crawlDelay > env.SCRAPER_MIN_DELAY_MS) {
      await sleep(crawlDelay - env.SCRAPER_MIN_DELAY_MS);
    }

    const body = await this.limiter.schedule(target.host, () =>
      this.request(target, options),
    );

    this.cache.set(key, { body, storedAt: Date.now() });
    this.pruneCache();
    return body;
  }

  private async request(target: URL, options: ScrapeOptions): Promise<string> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.maxRetries; attempt += 1) {
      try {
        const response = await fetch(target, {
          headers: {
            'User-Agent': this.userAgent,
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'pl-PL,pl;q=0.9,en;q=0.8',
            'Cache-Control': 'no-cache',
            ...options.headers,
          },
          redirect: 'follow',
          signal: options.signal ?? AbortSignal.timeout(30_000),
        });

        if (response.status === 429 || response.status >= 500) {
          // Respect Retry-After when the server sends one.
          const retryAfter = Number(response.headers.get('retry-after'));
          const backoffMs = Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : 2 ** attempt * 1000;

          lastError = new UpstreamError(
            `${target.host} zwróciło ${response.status}`,
          );
          logger.warn(
            { host: target.host, status: response.status, attempt, backoffMs },
            'Scrape throttled, backing off',
          );

          if (attempt < this.maxRetries) {
            await sleep(backoffMs);
            continue;
          }
          throw lastError;
        }

        if (response.status === 403) {
          throw new UpstreamError(
            `${target.host} odrzuciło żądanie (403) - prawdopodobnie ochrona antybotowa`,
          );
        }

        if (!response.ok) {
          throw new UpstreamError(`${target.host} zwróciło ${response.status}`);
        }

        return await response.text();
      } catch (err) {
        lastError = err;
        // 403 and other hard failures must not be retried.
        if (err instanceof UpstreamError && !err.message.includes('429')) throw err;
        if (attempt >= this.maxRetries) break;
        await sleep(2 ** attempt * 1000);
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new UpstreamError(`Nie udało się pobrać ${target.host}`);
  }

  /** Bounded cache - scraping many filters must not grow the heap forever. */
  private pruneCache(): void {
    if (this.cache.size <= 200) return;
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now - entry.storedAt >= this.cacheTtlMs) this.cache.delete(key);
    }
    while (this.cache.size > 200) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) break;
      this.cache.delete(oldest);
    }
  }
}

export const scrapingClient = new ScrapingClient();
