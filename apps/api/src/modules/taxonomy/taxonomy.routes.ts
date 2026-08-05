import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import { logger } from '../../config/logger.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { NotFoundError } from '../../lib/errors.js';

interface TaxonomyOption {
  value: string;
  label: string;
}

interface Taxonomy {
  generatedAt: string;
  makes: Array<TaxonomyOption & { models: TaxonomyOption[] }>;
  countries: TaxonomyOption[];
  colors: TaxonomyOption[];
  bodyTypes: TaxonomyOption[];
  fuelTypes: TaxonomyOption[];
  gearboxes: TaxonomyOption[];
  driveTypes: TaxonomyOption[];
  doorCounts: TaxonomyOption[];
  seatCounts: TaxonomyOption[];
  equipment: Array<{
    id: string;
    label: string;
    group: string;
    options: TaxonomyOption[];
  }>;
}

const TAXONOMY_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../data/otomoto-taxonomy.json',
);

/** Read once and kept in memory - it is a static dictionary, not live data. */
let cached: Taxonomy | null = null;

async function loadTaxonomy(): Promise<Taxonomy> {
  if (cached) return cached;

  try {
    cached = JSON.parse(await readFile(TAXONOMY_PATH, 'utf8')) as Taxonomy;
    logger.info(
      { makes: cached.makes.length, generatedAt: cached.generatedAt },
      'Taxonomy loaded',
    );
    return cached;
  } catch (err) {
    logger.error({ err, path: TAXONOMY_PATH }, 'Taxonomy file missing');
    throw new NotFoundError(
      'Brak pliku słownika. Uruchom: npm run taxonomy:build --workspace @cars-fetcher/api',
    );
  }
}

export const taxonomyRouter = Router();

/**
 * Public on purpose: the filter form needs it before any listing is fetched,
 * and it holds no user data.
 */
taxonomyRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const taxonomy = await loadTaxonomy();
    res.set('Cache-Control', 'public, max-age=3600');
    res.json(taxonomy);
  }),
);

/** Lighter payload for the make dropdown - models are fetched per make. */
taxonomyRouter.get(
  '/makes',
  asyncHandler(async (_req, res) => {
    const taxonomy = await loadTaxonomy();
    res.set('Cache-Control', 'public, max-age=3600');
    res.json(
      taxonomy.makes.map(({ value, label, models }) => ({
        value,
        label,
        modelCount: models.length,
      })),
    );
  }),
);

taxonomyRouter.get(
  '/makes/:make/models',
  asyncHandler(async (req, res) => {
    const taxonomy = await loadTaxonomy();
    const wanted = String(req.params.make ?? '').toLowerCase();
    const make = taxonomy.makes.find(
      (m) => m.value.toLowerCase() === wanted || m.label.toLowerCase() === wanted,
    );

    if (!make) throw new NotFoundError('Nie znaleziono marki');

    res.set('Cache-Control', 'public, max-age=3600');
    res.json(make.models);
  }),
);
