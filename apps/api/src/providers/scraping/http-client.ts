import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { UpstreamError } from '../../lib/errors.js';
import { fetchViaBrowser } from './browser-fetch.js';
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
  /**
   * Route through a real headless Chromium instead of `fetch`. Some hosts'
   * WAF (OLX's CloudFront) lets a genuine browser TLS/HTTP2 fingerprint
   * through while blocking every non-browser client outright, headers aside.
   * Slower (~1s+ per call) - opt in only for adapters that need it.
   */
  useBrowser?: boolean;
}

/** Normalises the two transports (`fetch` vs a real browser) to one shape. */
interface RawResponse {
  status: number;
  retryAfterMs: number | null;
  text(): Promise<string>;
}

/**
 * Shared HTTP client for every HTML-scraping adapter (Otomoto, autoplac.pl,
 * OLX).
 *
 * Responsibilities kept in one place so a new adapter cannot forget them:
 * robots.txt compliance, per-host throttling, a short response cache, retries
 * with backoff on 429/5xx, browser-shaped headers, and (opt-in via
 * `useBrowser`) a real headless Chromium for hosts that block plain `fetch`
 * outright regardless of headers.
 */
/** Consecutive 403s from one host before we stop hammering it for a while. */
const CIRCUIT_THRESHOLD = 3;
/** How long a tripped circuit stays open before the next request is allowed through. */
const CIRCUIT_COOLDOWN_MS = 3 * 3_600_000;

export class ScrapingClient {
  private readonly cache = new Map<string, CacheEntry>();
  /** Per-host 403 streak and, once it trips, the timestamp it may retry again. */
  private readonly consecutive403 = new Map<string, number>();
  private readonly circuitOpenUntil = new Map<string, number>();

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

    // A host that just hard-blocked us repeatedly does not need to hear from
    // us again every 15-30 minutes - that regular drumbeat is itself part of
    // what gets an IP put on a blocklist in the first place. Fail fast and
    // quiet instead, and let the ban have a chance to expire on its own.
    const openUntil = this.circuitOpenUntil.get(target.host);
    if (openUntil && Date.now() < openUntil) {
      throw new UpstreamError(
        `${target.host} blokuje żądania (403) od dłuższego czasu - wstrzymano próby do ${new Date(openUntil).toLocaleString('pl-PL')}`,
      );
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

  private async performRequest(target: URL, options: ScrapeOptions): Promise<RawResponse> {
    if (options.useBrowser) {
      const result = await fetchViaBrowser(target.toString(), {
        timeoutMs: 30_000,
        signal: options.signal,
      });
      const retryAfter = Number(result.headers['retry-after']);
      return {
        status: result.status,
        retryAfterMs: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : null,
        text: () => Promise.resolve(result.text),
      };
    }

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

    const retryAfter = Number(response.headers.get('retry-after'));
    return {
      status: response.status,
      retryAfterMs: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : null,
      text: () => response.text(),
    };
  }

  private async request(target: URL, options: ScrapeOptions): Promise<string> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.maxRetries; attempt += 1) {
      try {
        const response = await this.performRequest(target, options);

        if (response.status === 429 || response.status >= 500) {
          const backoffMs = response.retryAfterMs ?? 2 ** attempt * 1000;

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
          const streak = (this.consecutive403.get(target.host) ?? 0) + 1;
          this.consecutive403.set(target.host, streak);

          if (streak >= CIRCUIT_THRESHOLD) {
            this.circuitOpenUntil.set(target.host, Date.now() + CIRCUIT_COOLDOWN_MS);
            logger.warn(
              { host: target.host, streak, cooldownMs: CIRCUIT_COOLDOWN_MS },
              '3 kolejne 403 z tego hosta - wstrzymuję dalsze próby na kilka godzin',
            );
          }

          throw new UpstreamError(
            `${target.host} odrzuciło żądanie (403) - prawdopodobnie ochrona antybotowa`,
          );
        }

        if (response.status < 200 || response.status >= 300) {
          throw new UpstreamError(`${target.host} zwróciło ${response.status}`);
        }

        // Any non-403 response means the host is talking to us again.
        this.consecutive403.delete(target.host);
        this.circuitOpenUntil.delete(target.host);
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

  /** For the admin panel - which hosts are currently blocked, and until when. */
  getCircuitStatus(): Array<{ host: string; streak: number; openUntil: number | null }> {
    const hosts = new Set([...this.consecutive403.keys(), ...this.circuitOpenUntil.keys()]);
    return [...hosts].map((host) => ({
      host,
      streak: this.consecutive403.get(host) ?? 0,
      openUntil: this.circuitOpenUntil.get(host) ?? null,
    }));
  }

  /** Manual override for the admin panel - clears a tripped circuit early. */
  resetCircuit(host: string): boolean {
    const had = this.circuitOpenUntil.has(host) || this.consecutive403.has(host);
    this.circuitOpenUntil.delete(host);
    this.consecutive403.delete(host);
    return had;
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
