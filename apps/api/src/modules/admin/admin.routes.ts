import { Router } from 'express';
import { asyncHandler } from '../../lib/async-handler.js';
import {
  authenticate,
  currentUserId,
  pathParam,
  requireRole,
} from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { listProviders } from '../../providers/registry.js';
import * as service from './admin.service.js';
import { hostParam, runsQuery, updateUserSchema, userIdParam } from './admin.schemas.js';

export const adminRouter = Router();

// Every route below is an operator tool - admin only, no exceptions.
adminRouter.use(authenticate, requireRole('admin'));

adminRouter.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    res.json(await service.getStats());
  }),
);

adminRouter.get(
  '/users',
  asyncHandler(async (_req, res) => {
    res.json(await service.listUsers());
  }),
);

adminRouter.patch(
  '/users/:id',
  validate(userIdParam, 'params'),
  validate(updateUserSchema),
  asyncHandler(async (req, res) => {
    await service.updateUser(currentUserId(req), pathParam(req, 'id'), req.body);
    res.status(204).send();
  }),
);

adminRouter.get(
  '/scrapers',
  asyncHandler(async (_req, res) => {
    res.json({
      providers: listProviders(),
      circuits: service.listScraperCircuits(),
    });
  }),
);

adminRouter.post(
  '/scrapers/:host/reset',
  validate(hostParam, 'params'),
  asyncHandler(async (req, res) => {
    const reset = service.resetScraperCircuit(pathParam(req, 'host'));
    res.json({ reset });
  }),
);

adminRouter.get(
  '/runs',
  validate(runsQuery, 'query'),
  asyncHandler(async (req, res) => {
    const { limit } = req.query as unknown as { limit: number };
    res.json(await service.listRecentRuns(limit));
  }),
);
