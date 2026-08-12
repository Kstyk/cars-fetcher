import { asc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import {
  vehicleEngines,
  vehicleKnownIssues,
  vehicleModels,
  vehicleNotes,
  type NewVehicleEngine,
  type NewVehicleKnownIssue,
  type NewVehicleModel,
  type NewVehicleNote,
} from '../../db/schema.js';
import { NotFoundError } from '../../lib/errors.js';

/** Every make with at least one generation on file, alphabetical. */
export async function listMakes(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ make: vehicleModels.make })
    .from(vehicleModels)
    .orderBy(asc(vehicleModels.make));
  return rows.map((r) => r.make);
}

/** Generations on file for one make - the list view, before a generation is opened. */
export async function listModels(make: string) {
  return db
    .select({
      id: vehicleModels.id,
      make: vehicleModels.make,
      model: vehicleModels.model,
      generation: vehicleModels.generation,
      yearFrom: vehicleModels.yearFrom,
      yearTo: vehicleModels.yearTo,
      bodyTypes: vehicleModels.bodyTypes,
      summary: vehicleModels.summary,
      source: vehicleModels.source,
      engineCount: sql<number>`count(distinct ${vehicleEngines.id})`.mapWith(Number),
      issueCount: sql<number>`count(distinct ${vehicleKnownIssues.id})`.mapWith(Number),
    })
    .from(vehicleModels)
    .leftJoin(vehicleEngines, eq(vehicleEngines.modelId, vehicleModels.id))
    .leftJoin(vehicleKnownIssues, eq(vehicleKnownIssues.modelId, vehicleModels.id))
    .where(ilike(vehicleModels.make, make))
    .groupBy(vehicleModels.id)
    .orderBy(asc(vehicleModels.model), asc(vehicleModels.yearFrom));
}

/** Free-text search across make/model/generation, for the knowledge page's own search box. */
export async function searchModels(q: string) {
  const pattern = `%${q}%`;
  return db
    .select({
      id: vehicleModels.id,
      make: vehicleModels.make,
      model: vehicleModels.model,
      generation: vehicleModels.generation,
      yearFrom: vehicleModels.yearFrom,
      yearTo: vehicleModels.yearTo,
    })
    .from(vehicleModels)
    .where(
      or(
        ilike(vehicleModels.make, pattern),
        ilike(vehicleModels.model, pattern),
        ilike(vehicleModels.generation, pattern),
      ),
    )
    .orderBy(asc(vehicleModels.make), asc(vehicleModels.model))
    .limit(30);
}

export async function getModel(id: string) {
  const [model] = await db.select().from(vehicleModels).where(eq(vehicleModels.id, id)).limit(1);
  if (!model) throw new NotFoundError('Nie znaleziono modelu w bazie wiedzy');

  const [engines, knownIssues, notes] = await Promise.all([
    db
      .select()
      .from(vehicleEngines)
      .where(eq(vehicleEngines.modelId, id))
      .orderBy(asc(vehicleEngines.displacementCm3), asc(vehicleEngines.powerHp)),
    db
      .select()
      .from(vehicleKnownIssues)
      .where(eq(vehicleKnownIssues.modelId, id))
      .orderBy(asc(vehicleKnownIssues.severity)),
    db.select().from(vehicleNotes).where(eq(vehicleNotes.modelId, id)),
  ]);

  return { ...model, engines, knownIssues, notes };
}

type IssuePayload = Omit<NewVehicleKnownIssue, 'id' | 'modelId' | 'engineId' | 'createdAt'> & {
  /**
   * The engine this issue belongs to, by `name` - neither the seed data nor
   * the LLM generator knows a DB-assigned engine id yet, since the engines
   * are being inserted in the very same call. `null`/omitted means the issue
   * applies to the generation as a whole, not one specific engine.
   */
  engineName?: string | null;
};

export interface ModelPayload {
  make: string;
  model: string;
  generation: string;
  yearFrom: number | null;
  yearTo: number | null;
  bodyTypes: NewVehicleModel['bodyTypes'];
  summary: string | null;
  source: 'manual' | 'ai_generated';
  engines: Array<Omit<NewVehicleEngine, 'id' | 'modelId' | 'createdAt'>>;
  knownIssues: IssuePayload[];
  notes: Array<Omit<NewVehicleNote, 'id' | 'modelId' | 'createdAt'>>;
}

/**
 * Insert-or-replace for one generation: the model row upserts on
 * (make, model, generation), then its engines/issues/notes are dropped and
 * reinserted fresh. Used by both `knowledge:seed` and the LLM generator, so
 * re-running either is always idempotent - re-seeding or re-generating a
 * generation replaces its content rather than piling up duplicates.
 */
export async function upsertModel(payload: ModelPayload): Promise<string> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(vehicleModels)
      .values({
        make: payload.make,
        model: payload.model,
        generation: payload.generation,
        yearFrom: payload.yearFrom,
        yearTo: payload.yearTo,
        bodyTypes: payload.bodyTypes,
        summary: payload.summary,
        source: payload.source,
      })
      .onConflictDoUpdate({
        target: [vehicleModels.make, vehicleModels.model, vehicleModels.generation],
        set: {
          yearFrom: payload.yearFrom,
          yearTo: payload.yearTo,
          bodyTypes: payload.bodyTypes,
          summary: payload.summary,
          source: payload.source,
          updatedAt: new Date(),
        },
      })
      .returning({ id: vehicleModels.id });

    if (!row) throw new Error('Nie udało się zapisać modelu w bazie wiedzy');
    const modelId = row.id;

    await tx.delete(vehicleEngines).where(eq(vehicleEngines.modelId, modelId));
    await tx.delete(vehicleKnownIssues).where(eq(vehicleKnownIssues.modelId, modelId));
    await tx.delete(vehicleNotes).where(eq(vehicleNotes.modelId, modelId));

    // Engines need to exist before issues, since an issue may reference one.
    const engineIdByName = new Map<string, string>();
    if (payload.engines.length > 0) {
      const inserted = await tx
        .insert(vehicleEngines)
        .values(payload.engines.map((e) => ({ ...e, modelId })))
        .returning({ id: vehicleEngines.id, name: vehicleEngines.name });
      for (const e of inserted) engineIdByName.set(e.name, e.id);
    }

    if (payload.knownIssues.length > 0) {
      await tx.insert(vehicleKnownIssues).values(
        payload.knownIssues.map(({ engineName, ...issue }) => ({
          ...issue,
          modelId,
          engineId: engineName ? (engineIdByName.get(engineName) ?? null) : null,
        })),
      );
    }

    if (payload.notes.length > 0) {
      await tx.insert(vehicleNotes).values(payload.notes.map((n) => ({ ...n, modelId })));
    }

    return modelId;
  });
}
