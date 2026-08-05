import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from '../config/logger.js';
import { scrapingClient } from '../providers/scraping/http-client.js';
import { extractNextData } from '../providers/scraping/next-data.js';

/**
 * Builds the make/model/equipment dictionary that drives the UI selects.
 *
 * Otomoto ships its entire filter definition inside the search page, including
 * the model list of every make - each model state carries a condition like
 * `{ filterId: 'filter_enum_make', value: 'ford' }`. So one request is enough;
 * there is no need to walk the makes one by one.
 *
 * The result is committed to the repo: the UI must not depend on the live site
 * being reachable, and the taxonomy barely changes.
 *
 * Run with: npm run taxonomy:build --workspace @cars-fetcher/api
 */

interface FilterValue {
  id: string;
  name: string;
  counter?: number | null;
}

interface FilterCondition {
  filterId: string;
  value: string;
  type: string;
}

interface FilterState {
  filterId: string;
  conditions?: FilterCondition[];
  values?: Array<{ name: string | null; values?: FilterValue[] }>;
}

interface FilterComponent {
  id: string;
  name: string;
  type: string;
  parentID: string | null;
  displayConfig?: { renderAs?: string } | null;
}

interface FiltersPayload {
  filters?: { components?: FilterComponent[]; states?: FilterState[] };
}

export interface TaxonomyOption {
  value: string;
  label: string;
}

export interface EquipmentOption {
  /** Otomoto filter id, e.g. filter_enum_towbar. */
  id: string;
  label: string;
  group: string;
  /** Options for multi-value filters; empty means a plain boolean toggle. */
  options: TaxonomyOption[];
}

export interface Taxonomy {
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
  equipment: EquipmentOption[];
}

const BASE = 'https://www.otomoto.pl/osobowe';

/** Handled by dedicated fields on the filter form, not the equipment list. */
const SKIP_EQUIPMENT_IDS = new Set([
  'filter_enum_authorized_dealer',
  'filter_enum_vat_discount',
  'filter_enum_vat',
  'filter_enum_leasing_concession',
  'filter_enum_financial_option',
  'filter_enum_registered',
  'filter_enum_no_accident',
  'filter_enum_original_owner',
  'filter_enum_service_record',
  'filter_enum_has_vin',
  'filter_enum_has_registration',
  'filter_enum_damaged',
  'filter_enum_color',
  'filter_enum_door_count',
  'filter_enum_transmission',
  'filter_string_vehicle_verification_status',
]);

const GROUP_LABELS: Record<string, string> = {
  connectivity: 'Multimedia i łączność',
  comfort: 'Komfort',
  safety: 'Bezpieczeństwo i asystenci',
  electric_vehicles: 'Auta elektryczne',
  bodywork_capacity: 'Nadwozie',
  engine_and_powertrain: 'Silnik i napęd',
  history_condition: 'Historia i stan',
  seller_details: 'Sprzedający',
  other: 'Pozostałe',
};

async function loadFilters(url: string): Promise<{
  components: FilterComponent[];
  states: FilterState[];
}> {
  const html = await scrapingClient.fetchHtml(url);
  const nextData = extractNextData(html);

  const payloads: FiltersPayload[] = [];
  const seen = new Set<unknown>();

  (function walk(node: unknown, depth: number): void {
    if (depth > 14 || node === null || typeof node !== 'object') return;
    if (seen.has(node)) return;
    seen.add(node);

    const record = node as Record<string, unknown>;
    if (typeof record.data === 'string' && record.data.includes('"filters"')) {
      try {
        payloads.push(JSON.parse(record.data) as FiltersPayload);
      } catch {
        // Not the cache entry we want.
      }
    }
    for (const value of Object.values(record)) walk(value, depth + 1);
  })(nextData, 0);

  const payload = payloads.find((p) => p.filters?.components?.length);
  if (!payload?.filters) {
    throw new Error(`Nie znaleziono definicji filtrów pod ${url}`);
  }

  return {
    components: payload.filters.components ?? [],
    states: payload.filters.states ?? [],
  };
}

function flatten(state: FilterState | undefined): TaxonomyOption[] {
  return (state?.values ?? [])
    .flatMap((group) => group.values ?? [])
    .filter((value) => value.id !== '' && value.name)
    .map((value) => ({ value: value.id, label: value.name }));
}

/** The unconditional state for a filter - the list shown before any choice. */
function baseState(states: FilterState[], filterId: string): FilterState | undefined {
  return states.find(
    (state) => state.filterId === filterId && (state.conditions ?? []).length === 0,
  );
}

async function build(): Promise<void> {
  logger.info('Pobieram definicję filtrów Otomoto');
  const { components, states } = await loadFilters(BASE);
  logger.info({ components: components.length, states: states.length }, 'Pobrano');

  const makeOptions = flatten(baseState(states, 'filter_enum_make'));

  // Model lists arrive as separate states keyed by a make condition.
  const modelsByMake = new Map<string, TaxonomyOption[]>();
  for (const state of states) {
    if (state.filterId !== 'filter_enum_model') continue;
    const condition = (state.conditions ?? []).find(
      (c) => c.filterId === 'filter_enum_make',
    );
    if (!condition) continue;
    modelsByMake.set(condition.value, flatten(state));
  }

  const makes = makeOptions.map((make) => ({
    ...make,
    models: modelsByMake.get(make.value) ?? [],
  }));

  const withoutModels = makes.filter((m) => m.models.length === 0);
  if (withoutModels.length > 0) {
    logger.warn(
      { count: withoutModels.length, sample: withoutModels.slice(0, 5).map((m) => m.label) },
      'Marki bez modeli',
    );
  }

  const equipment: EquipmentOption[] = [];
  for (const component of components) {
    if (!/^filter_(enum|string)_/.test(component.id)) continue;
    if (SKIP_EQUIPMENT_IDS.has(component.id)) continue;
    if (component.displayConfig?.renderAs !== 'CHECKBOX') continue;

    const groupKey = component.parentID ?? 'other';
    equipment.push({
      id: component.id,
      label: component.name,
      group: GROUP_LABELS[groupKey] ?? GROUP_LABELS.other ?? 'Pozostałe',
      options: flatten(baseState(states, component.id)),
    });
  }

  const taxonomy: Taxonomy = {
    generatedAt: new Date().toISOString(),
    makes,
    countries: flatten(baseState(states, 'filter_enum_country_origin')),
    colors: flatten(baseState(states, 'filter_enum_color')),
    bodyTypes: flatten(baseState(states, 'filter_enum_body_type')),
    fuelTypes: flatten(baseState(states, 'filter_enum_fuel_type')),
    gearboxes: flatten(baseState(states, 'filter_enum_gearbox')),
    driveTypes: flatten(baseState(states, 'filter_enum_transmission')),
    doorCounts: flatten(baseState(states, 'filter_enum_door_count')),
    seatCounts: flatten(baseState(states, 'filter_float_nr_seats')),
    equipment,
  };

  const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data');
  await mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, 'otomoto-taxonomy.json');
  await writeFile(outFile, `${JSON.stringify(taxonomy, null, 2)}\n`, 'utf8');

  logger.info(
    {
      outFile,
      makes: taxonomy.makes.length,
      models: taxonomy.makes.reduce((sum, m) => sum + m.models.length, 0),
      equipment: taxonomy.equipment.length,
      countries: taxonomy.countries.length,
      colors: taxonomy.colors.length,
    },
    'Słownik zapisany',
  );
}

try {
  await build();
  process.exit(0);
} catch (err) {
  logger.error({ err }, 'Budowa słownika nie powiodła się');
  process.exit(1);
}
