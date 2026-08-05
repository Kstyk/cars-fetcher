import { sql } from 'drizzle-orm';
import { logger } from '../config/logger.js';
import { db, pool } from '../db/client.js';
import { normalizeVoivodeship } from '../lib/regions.js';
import {
  backfillListingCoordinates,
  geocode,
  listUnresolvedPlaces,
} from '../modules/geo/geocoding.service.js';

/**
 * Normalises voivodeship spellings, geocodes every city we have listings for,
 * then copies the coordinates onto the listings.
 *
 * Nominatim allows one request per second, so a few hundred cities take a few
 * minutes. Safe to re-run: cached places are skipped.
 *
 * Run with: npm run geo:backfill --workspace @cars-fetcher/api
 */

async function normaliseRegions(): Promise<void> {
  const rows = await db.execute<{ region: string }>(
    sql`SELECT DISTINCT region FROM listings WHERE region IS NOT NULL`,
  );

  let updated = 0;
  for (const { region } of rows.rows) {
    const canonical = normalizeVoivodeship(region);
    if (!canonical || canonical === region) continue;

    const result = await db.execute(
      sql`UPDATE listings SET region = ${canonical} WHERE region = ${region}`,
    );
    updated += result.rowCount ?? 0;
    logger.info({ from: region, to: canonical }, 'Ujednolicono nazwę województwa');
  }
  logger.info({ updated }, 'Województwa znormalizowane');
}

async function run(): Promise<void> {
  await normaliseRegions();

  const places = await listUnresolvedPlaces();
  logger.info({ count: places.length }, 'Miejscowości do zgeokodowania');

  let resolved = 0;
  for (const [index, place] of places.entries()) {
    const coordinates = await geocode(place.city, place.region);
    if (coordinates) resolved += 1;

    logger.info(
      {
        city: place.city,
        region: place.region,
        listings: place.listings,
        found: Boolean(coordinates),
        progress: `${index + 1}/${places.length}`,
      },
      coordinates ? 'Zgeokodowano' : 'Brak wyniku',
    );
  }

  const updated = await backfillListingCoordinates();
  logger.info({ resolved, places: places.length, listingsUpdated: updated }, 'Gotowe');
}

try {
  await run();
  await pool.end();
  process.exit(0);
} catch (err) {
  logger.error({ err }, 'Backfill geo nie powiódł się');
  await pool.end();
  process.exit(1);
}
