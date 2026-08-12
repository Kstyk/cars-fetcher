import { Router } from 'express';
import { anthropicConfigured } from '../../config/env.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { authenticate, pathParam, requireRole } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { generateModel } from './knowledge-generator.service.js';
import * as service from './knowledge.service.js';
import { generateSchema, makeParam, modelIdParam, searchQuery } from './knowledge.schemas.js';

export const knowledgeRouter = Router();

knowledgeRouter.use(authenticate);

knowledgeRouter.get(
  '/makes',
  asyncHandler(async (_req, res) => {
    res.json(await service.listMakes());
  }),
);

knowledgeRouter.get(
  '/search',
  validate(searchQuery, 'query'),
  asyncHandler(async (req, res) => {
    const { q } = req.query as unknown as { q?: string };
    res.json(q ? await service.searchModels(q) : []);
  }),
);

knowledgeRouter.get(
  '/makes/:make/models',
  validate(makeParam, 'params'),
  asyncHandler(async (req, res) => {
    res.json(await service.listModels(pathParam(req, 'make')));
  }),
);

knowledgeRouter.get(
  '/models/:id',
  validate(modelIdParam, 'params'),
  asyncHandler(async (req, res) => {
    res.json(await service.getModel(pathParam(req, 'id')));
  }),
);

// Costs real money per call (Anthropic API) - admin only, no exceptions.
knowledgeRouter.post(
  '/generate',
  requireRole('admin'),
  validate(generateSchema),
  asyncHandler(async (req, res) => {
    const modelId = await generateModel(req.body);
    res.status(201).json(await service.getModel(modelId));
  }),
);

knowledgeRouter.get(
  '/generate/available',
  requireRole('admin'),
  asyncHandler(async (_req, res) => {
    res.json({ available: anthropicConfigured });
  }),
);
