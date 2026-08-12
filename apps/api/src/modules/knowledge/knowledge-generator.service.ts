import { z } from 'zod';
import { anthropicConfigured, env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { ConflictError } from '../../lib/errors.js';
import {
  bodyTypeValues,
  driveTypeValues,
  fuelTypeValues,
  gearboxValues,
} from '../filters/filters.schemas.js';
import { upsertModel, type ModelPayload } from './knowledge.service.js';
import type { GenerateInput } from './knowledge.schemas.js';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

const generatedIssueSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  severity: z.enum(['minor', 'moderate', 'serious']).default('moderate'),
  mileageHint: z.string().max(100).nullish(),
  engineName: z.string().nullish(),
});

const generatedEngineSchema = z.object({
  name: z.string().min(1).max(120),
  engineCode: z.string().max(40).nullish(),
  fuelType: z.enum(fuelTypeValues).nullish(),
  displacementCm3: z.number().int().positive().nullish(),
  powerHp: z.number().int().positive().nullish(),
  torqueNm: z.number().int().positive().nullish(),
  gearbox: z.enum(gearboxValues).nullish(),
  driveType: z.enum(driveTypeValues).nullish(),
  acceleration0To100: z.number().positive().nullish(),
  topSpeedKmh: z.number().int().positive().nullish(),
  fuelConsumptionCombined: z.number().positive().nullish(),
  yearFrom: z.number().int().nullish(),
  yearTo: z.number().int().nullish(),
});

const generatedNoteSchema = z.object({
  kind: z.enum(['reputation', 'ownership_cost', 'buying_advice']),
  body: z.string().min(1),
});

const generatedModelSchema = z.object({
  generation: z.string().min(1).max(80),
  yearFrom: z.number().int().nullish(),
  yearTo: z.number().int().nullish(),
  bodyTypes: z.array(z.enum(bodyTypeValues)).nullish(),
  summary: z.string().min(1),
  engines: z.array(generatedEngineSchema).max(15),
  knownIssues: z.array(generatedIssueSchema).max(20),
  notes: z.array(generatedNoteSchema).max(6),
});

function buildPrompt(input: GenerateInput): string {
  const generationHint = input.generation
    ? `konkretnie generację "${input.generation}"`
    : 'najbardziej znaną / najnowszą generację (sam zdecyduj którą i podaj jej nazwę)';

  return `Jesteś ekspertem motoryzacyjnym. Opisz ${generationHint} modelu: ${input.make} ${input.model}.

Zwróć WYŁĄCZNIE jeden obiekt JSON (bez markdown, bez \`\`\`, bez komentarzy) o dokładnie takim kształcie:

{
  "generation": string (np. "Mk7", "B9", "III"),
  "yearFrom": number | null,
  "yearTo": number | null (null jeśli nadal produkowana),
  "bodyTypes": string[] (dowolne z: ${bodyTypeValues.join(', ')}),
  "summary": string (2-4 zdania po polsku - co to za auto, dla kogo),
  "engines": [
    {
      "name": string (np. "2.0 TDI 150 KM"),
      "engineCode": string | null,
      "fuelType": string | null (dowolne z: ${fuelTypeValues.join(', ')}),
      "displacementCm3": number | null,
      "powerHp": number | null,
      "torqueNm": number | null,
      "gearbox": string | null (dowolne z: ${gearboxValues.join(', ')}),
      "driveType": string | null (dowolne z: ${driveTypeValues.join(', ')}),
      "acceleration0To100": number | null (sekundy),
      "topSpeedKmh": number | null,
      "fuelConsumptionCombined": number | null (l/100km),
      "yearFrom": number | null,
      "yearTo": number | null
    }
  ] (2-6 najpopularniejszych wersji silnikowych, realne dane techniczne),
  "knownIssues": [
    {
      "title": string (krótko, np. "Łańcuch rozrządu"),
      "description": string (2-3 zdania po polsku, na czym polega usterka),
      "severity": "minor" | "moderate" | "serious",
      "mileageHint": string | null (np. "zwykle po 150-200 tys. km"),
      "engineName": string | null (dokładna nazwa z listy "engines" powyżej, jeśli usterka dotyczy konkretnego silnika, inaczej null)
    }
  ] (3-8 realnych, powszechnie znanych usterek/słabych punktów tego modelu),
  "notes": [
    { "kind": "reputation", "body": string (opinia właścicieli, reputacja, po polsku) },
    { "kind": "ownership_cost", "body": string (koszty eksploatacji, serwisu, po polsku) },
    { "kind": "buying_advice", "body": string (na co zwrócić uwagę kupując, po polsku) }
  ]
}

Podawaj tylko dane, których jesteś w miarę pewny. Jeśli nie znasz dokładnej liczby, użyj null zamiast zgadywać. Odpowiedz samym JSON-em.`;
}

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>;
  error?: { message?: string };
}

async function callAnthropic(prompt: string): Promise<string> {
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY ?? '',
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: env.ANTHROPIC_MODEL,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const body = (await res.json()) as AnthropicResponse;
  if (!res.ok) {
    throw new Error(body.error?.message ?? `Anthropic API zwróciło ${res.status}`);
  }

  const text = body.content?.find((block) => block.type === 'text')?.text;
  if (!text) throw new Error('Anthropic API nie zwróciło treści');
  return text;
}

/** Strips a ```json fence if the model added one despite being asked not to. */
function extractJson(text: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  return (fenced?.[1] ?? text).trim();
}

/**
 * Asks Claude for a structured write-up of one generation and persists it.
 * Everything it returns is labelled `source: 'ai_generated'` in the DB and
 * in the UI - this is a summary of general knowledge, not a verified fact
 * sheet, and is presented to the user as such.
 */
export async function generateModel(input: GenerateInput): Promise<string> {
  if (!anthropicConfigured) {
    throw new ConflictError(
      'Generowanie wymaga skonfigurowanego ANTHROPIC_API_KEY na serwerze',
    );
  }

  const rawText = await callAnthropic(buildPrompt(input));

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(extractJson(rawText));
  } catch (err) {
    logger.error({ err, rawText }, 'Knowledge generator: odpowiedź modelu nie jest JSON-em');
    throw new Error('Model zwrócił odpowiedź, której nie dało się odczytać jako JSON');
  }

  const parsed = generatedModelSchema.safeParse(parsedJson);
  if (!parsed.success) {
    logger.error(
      { issues: parsed.error.issues, rawText },
      'Knowledge generator: odpowiedź modelu nie pasuje do oczekiwanego kształtu',
    );
    throw new Error('Model zwrócił dane w nieoczekiwanym kształcie');
  }

  const data = parsed.data;
  const payload: ModelPayload = {
    make: input.make,
    model: input.model,
    generation: data.generation,
    yearFrom: data.yearFrom ?? null,
    yearTo: data.yearTo ?? null,
    bodyTypes: data.bodyTypes ?? null,
    summary: data.summary,
    source: 'ai_generated',
    engines: data.engines.map((e) => ({
      name: e.name,
      engineCode: e.engineCode ?? null,
      fuelType: e.fuelType ?? null,
      displacementCm3: e.displacementCm3 ?? null,
      powerHp: e.powerHp ?? null,
      torqueNm: e.torqueNm ?? null,
      gearbox: e.gearbox ?? null,
      driveType: e.driveType ?? null,
      acceleration0To100: e.acceleration0To100 ?? null,
      topSpeedKmh: e.topSpeedKmh ?? null,
      fuelConsumptionCombined: e.fuelConsumptionCombined ?? null,
      yearFrom: e.yearFrom ?? null,
      yearTo: e.yearTo ?? null,
    })),
    knownIssues: data.knownIssues.map((issue) => ({
      title: issue.title,
      description: issue.description,
      severity: issue.severity,
      mileageHint: issue.mileageHint ?? null,
      engineName: issue.engineName ?? null,
      source: 'ai_generated',
      sourceUrl: null,
    })),
    notes: data.notes.map((n) => ({
      kind: n.kind,
      body: n.body,
      source: 'ai_generated',
      sourceUrl: null,
    })),
  };

  return upsertModel(payload);
}
