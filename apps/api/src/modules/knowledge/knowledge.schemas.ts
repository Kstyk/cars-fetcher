import { z } from 'zod';

export const modelIdParam = z.object({ id: z.string().uuid() });

export const makeParam = z.object({ make: z.string().trim().min(1).max(60) });

export const searchQuery = z.object({
  q: z.string().trim().max(120).optional(),
});

/**
 * What the admin-triggered generator needs to know: which car. `generation`
 * is optional - left out, the model asks the LLM to name the generation
 * itself (useful for "what generations of the Golf even exist" browsing).
 */
export const generateSchema = z.object({
  make: z.string().trim().min(1).max(60),
  model: z.string().trim().min(1).max(80),
  generation: z.string().trim().max(80).optional(),
});

export type GenerateInput = z.infer<typeof generateSchema>;
