import { logger } from '../../config/logger.js';

interface RobotsRule {
  path: string;
  allow: boolean;
}

interface RobotsFile {
  rules: RobotsRule[];
  crawlDelayMs: number | null;
  fetchedAt: number;
}

const CACHE_TTL_MS = 6 * 3_600_000;

/**
 * Minimal robots.txt reader: fetches, caches per origin and answers whether a
 * path may be crawled. Follows the usual precedence - the longest matching
 * pattern wins, and Allow beats Disallow at equal length.
 *
 * Otomoto matters here: it publishes `Disallow: /api/` and `Disallow: /ajax/`
 * (their internal GraphQL) while leaving the rendered listing pages under
 * `Allow: /`. This check keeps us on the allowed side without hard-coding it.
 */
export class RobotsChecker {
  private readonly cache = new Map<string, RobotsFile>();
  private readonly inFlight = new Map<string, Promise<RobotsFile>>();

  constructor(
    private readonly userAgent: string,
    private readonly enabled: boolean,
  ) {}

  async isAllowed(url: string | URL): Promise<boolean> {
    if (!this.enabled) return true;

    const target = typeof url === 'string' ? new URL(url) : url;
    const robots = await this.load(target.origin);
    const path = target.pathname + target.search;

    let best: RobotsRule | null = null;
    for (const rule of robots.rules) {
      if (!matches(path, rule.path)) continue;
      if (
        !best ||
        rule.path.length > best.path.length ||
        (rule.path.length === best.path.length && rule.allow)
      ) {
        best = rule;
      }
    }

    return best ? best.allow : true;
  }

  async crawlDelayMs(origin: string): Promise<number | null> {
    if (!this.enabled) return null;
    return (await this.load(origin)).crawlDelayMs;
  }

  private async load(origin: string): Promise<RobotsFile> {
    const cached = this.cache.get(origin);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached;

    const existing = this.inFlight.get(origin);
    if (existing) return existing;

    const promise = this.fetchRobots(origin)
      .then((file) => {
        this.cache.set(origin, file);
        return file;
      })
      .finally(() => this.inFlight.delete(origin));

    this.inFlight.set(origin, promise);
    return promise;
  }

  private async fetchRobots(origin: string): Promise<RobotsFile> {
    const empty: RobotsFile = { rules: [], crawlDelayMs: null, fetchedAt: Date.now() };

    try {
      const response = await fetch(`${origin}/robots.txt`, {
        headers: { 'User-Agent': this.userAgent },
        signal: AbortSignal.timeout(10_000),
      });

      // No robots.txt means no restrictions.
      if (!response.ok) return empty;

      return { ...parseRobots(await response.text(), this.userAgent), fetchedAt: Date.now() };
    } catch (err) {
      logger.warn({ err, origin }, 'Could not read robots.txt, assuming allowed');
      return empty;
    }
  }
}

function parseRobots(
  text: string,
  userAgent: string,
): Omit<RobotsFile, 'fetchedAt'> {
  const uaLower = userAgent.toLowerCase();
  const groups: Array<{ agents: string[]; rules: RobotsRule[]; crawlDelay: number | null }> = [];
  let current: (typeof groups)[number] | null = null;
  let lastLineWasAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.split('#')[0]?.trim() ?? '';
    if (!line) continue;

    const separator = line.indexOf(':');
    if (separator === -1) continue;

    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (field === 'user-agent') {
      // Consecutive User-agent lines share one rule block.
      if (!current || !lastLineWasAgent) {
        current = { agents: [], rules: [], crawlDelay: null };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastLineWasAgent = true;
      continue;
    }

    lastLineWasAgent = false;
    if (!current) continue;

    if (field === 'disallow') {
      // An empty Disallow means "allow everything".
      if (value) current.rules.push({ path: value, allow: false });
    } else if (field === 'allow') {
      if (value) current.rules.push({ path: value, allow: true });
    } else if (field === 'crawl-delay') {
      const seconds = Number(value);
      if (Number.isFinite(seconds)) current.crawlDelay = seconds * 1000;
    }
  }

  // A group naming our agent wins over the wildcard group.
  const specific = groups.find((g) =>
    g.agents.some((a) => a !== '*' && uaLower.includes(a)),
  );
  const wildcard = groups.find((g) => g.agents.includes('*'));
  const chosen = specific ?? wildcard;

  return {
    rules: chosen?.rules ?? [],
    crawlDelayMs: chosen?.crawlDelay ?? null,
  };
}

/** Supports the `*` wildcard and the `$` end-anchor. */
function matches(path: string, pattern: string): boolean {
  const anchored = pattern.endsWith('$');
  const body = anchored ? pattern.slice(0, -1) : pattern;

  const escaped = body
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');

  return new RegExp(`^${escaped}${anchored ? '$' : ''}`).test(path);
}
