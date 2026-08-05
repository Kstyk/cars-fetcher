import { env, otomotoConfigured } from '../config/env.js';
import { logger } from '../config/logger.js';
import { fixtureSource } from './fixture/fixture.source.js';
import { otomotoScraperSource } from './otomoto/otomoto-scraper.source.js';
import { otomotoSource } from './otomoto/otomoto.source.js';
import type { ListingSource, ProviderName } from './types.js';

/**
 * Resolves the adapter for a provider.
 *
 * Adding autoplac.pl or OLX means writing one `ListingSource` (reusing
 * `providers/scraping/*` for throttling and robots.txt) and registering it
 * here - nothing else in the application changes.
 */
const sources = new Map<ProviderName, ListingSource>();

sources.set('otomoto', resolveOtomotoSource());

function resolveOtomotoSource(): ListingSource {
  switch (env.OTOMOTO_SOURCE) {
    case 'api':
      if (!otomotoConfigured) {
        logger.warn(
          'OTOMOTO_SOURCE=api but credentials are missing - falling back to the scraper.',
        );
        return otomotoScraperSource;
      }
      logger.info('Otomoto: using the official partner API');
      return otomotoSource;

    case 'fixture':
      logger.warn('Otomoto: using the fixture source - listings are generated, not real.');
      return fixtureSource;

    case 'scraper':
    default:
      logger.info(
        {
          minDelayMs: env.SCRAPER_MIN_DELAY_MS,
          respectRobots: env.SCRAPER_RESPECT_ROBOTS,
        },
        'Otomoto: scraping public listing pages',
      );
      return otomotoScraperSource;
  }
}

export function getSource(provider: ProviderName): ListingSource {
  const source = sources.get(provider);
  if (!source) {
    throw new Error(`Brak adaptera dla dostawcy: ${provider}`);
  }
  return source;
}

export function listProviders(): Array<{
  provider: ProviderName;
  mode: string;
  configured: boolean;
  live: boolean;
}> {
  return [...sources.entries()].map(([provider, source]) => ({
    provider,
    mode: provider === 'otomoto' ? env.OTOMOTO_SOURCE : 'scraper',
    configured: source.isConfigured(),
    live: source !== fixtureSource,
  }));
}
