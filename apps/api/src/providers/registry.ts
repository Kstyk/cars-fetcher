import { env, otomotoConfigured } from '../config/env.js';
import { logger } from '../config/logger.js';
import { autoplacSource } from './autoplac/autoplac.source.js';
import { findcarSource } from './findcar/findcar.source.js';
import { fixtureSource } from './fixture/fixture.source.js';
import { olxSource } from './olx/olx.source.js';
import { otomotoScraperSource } from './otomoto/otomoto-scraper.source.js';
import { otomotoSource } from './otomoto/otomoto.source.js';
import { sprzedajemySource } from './sprzedajemy/sprzedajemy.source.js';
import { UnimplementedSource } from './unimplemented.source.js';
import type { ListingSource, ProviderName } from './types.js';

/**
 * Resolves the adapter for a provider.
 *
 * Adding a marketplace means writing one `ListingSource` (reusing
 * `providers/scraping/*` for throttling and robots.txt) and registering it
 * here - nothing else in the application changes.
 */
const sources = new Map<ProviderName, ListingSource>();

sources.set('otomoto', resolveOtomotoSource());
sources.set('olx', olxSource);
sources.set('autoplac', autoplacSource);
sources.set('findcar', findcarSource);
sources.set('sprzedajemy', sprzedajemySource);

/** Human-readable names for the provider picker in the UI. */
const PROVIDER_LABELS: Record<ProviderName, string> = {
  otomoto: 'Otomoto',
  olx: 'OLX',
  autoplac: 'autoplac.pl',
  findcar: 'FindCar',
  sprzedajemy: 'Sprzedajemy.pl',
  mobile_de: 'mobile.de',
  autoscout24: 'AutoScout24',
};

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

export interface ProviderInfo {
  provider: ProviderName;
  label: string;
  /** False for providers that are listed but have no adapter yet. */
  implemented: boolean;
  configured: boolean;
  /** False when the fixture generator stands in for a real source. */
  live: boolean;
  mode?: string;
}

export function listProviders(): ProviderInfo[] {
  return [...sources.entries()].map(([provider, source]) => {
    const implemented = !(source instanceof UnimplementedSource);
    return {
      provider,
      label: PROVIDER_LABELS[provider],
      implemented,
      configured: source.isConfigured(),
      live: implemented && source !== fixtureSource,
      ...(provider === 'otomoto' ? { mode: env.OTOMOTO_SOURCE } : {}),
    };
  });
}
