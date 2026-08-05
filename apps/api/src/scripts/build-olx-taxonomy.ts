import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from '../config/logger.js';
import { scrapingClient } from '../providers/scraping/http-client.js';

/**
 * Builds the OLX make dictionary.
 *
 * OLX has no `filter_enum_make` for cars - the API answers
 * "Dynamic filters not applicable for category 84: filter_enum_make". Each make
 * is its own category instead (Volvo = 208, Toyota = 206, Mazda = 194), so the
 * adapter needs a slug -> category_id map.
 *
 * The map is derived from the public category pages and committed to the repo.
 * Run with: npm run taxonomy:olx --workspace @cars-fetcher/api
 */

export interface OlxMake {
  slug: string;
  label: string;
  categoryId: number;
}

export interface OlxTaxonomy {
  generatedAt: string;
  /** Category holding every passenger car, used when no make is selected. */
  allCarsCategoryId: number;
  makes: OlxMake[];
}

const CARS_URL = 'https://www.olx.pl/motoryzacja/samochody/';
const ALL_CARS_CATEGORY_ID = 84;

/**
 * Reads the page's own category id.
 *
 * Two independent signals, because the embedded state arrives with a varying
 * number of backslash escapes depending on how the page was rendered:
 *   1. every offer on the page carries `"category":{"id":N}` - the modal value
 *      is the make's category,
 *   2. the prefetch link to the offers API spells out `category_id=N`.
 */
function extractCategoryId(html: string): number | null {
  const counts = new Map<string, number>();

  const patterns = [
    // Offer categories, with any amount of escaping around the quotes.
    /\\*"category\\*"\s*:\s*\{\s*\\*"id\\*"\s*:\s*(\d+)/g,
    // The API URL embedded for the next page of results.
    /category_id=(\d+)/g,
  ];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const id = match[1];
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }

  const [best] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  // A couple of stray hits are noise, not the page's own category.
  if (!best || best[1] < 5) return null;
  return Number(best[0]);
}

function labelFromSlug(slug: string): string {
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('-');
}

async function build(): Promise<void> {
  logger.info('Pobieram listę marek z OLX');
  const html = await scrapingClient.fetchHtml(CARS_URL, { fresh: true });

  const slugs = [
    ...new Set(
      [...html.matchAll(/\/motoryzacja\/samochody\/([a-z0-9-]+)\//g)]
        .map((match) => match[1])
        .filter((slug): slug is string => Boolean(slug)),
    ),
  ]
    // `/samochody/q-audi/` is a search URL, not a make category - it resolves
    // to a real category id and would otherwise land in the map as a "make".
    .filter((slug) => !slug.startsWith('q-'))
    .filter((slug) => !['q', 'page', 'nowe', 'uzywane'].includes(slug))
    .sort();

  logger.info({ count: slugs.length }, 'Znalezione slugi marek');

  const makes: OlxMake[] = [];
  for (const [index, slug] of slugs.entries()) {
    try {
      const page = await scrapingClient.fetchHtml(`${CARS_URL}${slug}/`);
      const categoryId = extractCategoryId(page);

      if (categoryId === null || categoryId === ALL_CARS_CATEGORY_ID) {
        logger.warn({ slug }, 'Nie ustalono kategorii, pomijam');
        continue;
      }

      makes.push({ slug, label: labelFromSlug(slug), categoryId });
      logger.info(
        { slug, categoryId, progress: `${index + 1}/${slugs.length}` },
        'Kategoria ustalona',
      );
    } catch (err) {
      logger.warn({ err, slug }, 'Nie udało się pobrać strony marki');
    }
  }

  const taxonomy: OlxTaxonomy = {
    generatedAt: new Date().toISOString(),
    allCarsCategoryId: ALL_CARS_CATEGORY_ID,
    makes,
  };

  const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data');
  await mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, 'olx-taxonomy.json');
  await writeFile(outFile, `${JSON.stringify(taxonomy, null, 2)}\n`, 'utf8');

  logger.info({ outFile, makes: makes.length }, 'Słownik OLX zapisany');
}

try {
  await build();
  process.exit(0);
} catch (err) {
  logger.error({ err }, 'Budowa słownika OLX nie powiodła się');
  process.exit(1);
}
