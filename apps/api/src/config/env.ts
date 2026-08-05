import { z } from 'zod';

const booleanish = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be >= 32 chars'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET must be >= 32 chars'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),

  /**
   * Which Otomoto adapter to use:
   *   scraper - public listing pages (real data, no credentials)
   *   api     - official partner OAuth2 API (needs OTOMOTO_* credentials)
   *   fixture - deterministic generator for offline development
   */
  OTOMOTO_SOURCE: z.enum(['scraper', 'api', 'fixture']).default('scraper'),
  OTOMOTO_ENABLED: booleanish.default('false'),
  OTOMOTO_BASE_URL: z.string().url().default('https://www.otomoto.pl/api/open'),
  OTOMOTO_CLIENT_ID: z.string().optional(),
  OTOMOTO_CLIENT_SECRET: z.string().optional(),
  OTOMOTO_USERNAME: z.string().optional(),
  OTOMOTO_PASSWORD: z.string().optional(),

  // Shared by every HTML-scraping adapter (Otomoto, autoplac.pl, OLX).
  SCRAPER_USER_AGENT: z
    .string()
    .default(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    ),
  /** Minimum gap between two requests to the same host. */
  SCRAPER_MIN_DELAY_MS: z.coerce.number().int().min(0).default(2500),
  SCRAPER_RESPECT_ROBOTS: booleanish.default('true'),
  SCRAPER_CACHE_TTL_MS: z.coerce.number().int().min(0).default(300_000),
  SCRAPER_MAX_RETRIES: z.coerce.number().int().min(1).max(10).default(3),
  /**
   * Car adverts below this price are treated as noise. OLX cross-posts leak
   * parts into the car category ("Lampa LED ... Volvo XC 60" at 1050 PLN) with
   * otherwise car-shaped attributes. Set to 0 to keep everything.
   */
  SCRAPER_MIN_PRICE_PLN: z.coerce.number().int().min(0).default(2000),

  SCHEDULER_ENABLED: booleanish.default('true'),
  SCHEDULER_CRON: z.string().default('*/30 * * * *'),
  FETCH_MAX_PAGES: z.coerce.number().int().positive().max(50).default(5),
  FETCH_PAGE_SIZE: z.coerce.number().int().positive().max(100).default(50),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  console.error(`Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';

/**
 * The Otomoto adapter only makes real calls when it has a full credential set;
 * otherwise the app falls back to the fixture source so local dev still works.
 */
export const otomotoConfigured =
  env.OTOMOTO_ENABLED &&
  Boolean(
    env.OTOMOTO_CLIENT_ID &&
      env.OTOMOTO_CLIENT_SECRET &&
      env.OTOMOTO_USERNAME &&
      env.OTOMOTO_PASSWORD,
  );
