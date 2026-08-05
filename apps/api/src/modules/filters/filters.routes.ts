import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/async-handler.js';
import {
  authenticate,
  currentUserId,
  pathParam,
} from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { runGroup } from '../fetching/fetcher.service.js';
import {
  createGroupSchema,
  filterIdParam,
  filterInputSchema,
  groupIdParam,
  updateGroupSchema,
} from './filters.schemas.js';
import * as service from './filters.service.js';

export const filterGroupsRouter = Router();

filterGroupsRouter.use(authenticate);

filterGroupsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await service.listGroups(currentUserId(req)));
  }),
);

filterGroupsRouter.post(
  '/',
  validate(createGroupSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(await service.createGroup(currentUserId(req), req.body));
  }),
);

filterGroupsRouter.get(
  '/:id',
  validate(groupIdParam, 'params'),
  asyncHandler(async (req, res) => {
    res.json(await service.getGroup(currentUserId(req), pathParam(req, 'id')));
  }),
);

filterGroupsRouter.patch(
  '/:id',
  validate(groupIdParam, 'params'),
  validate(updateGroupSchema),
  asyncHandler(async (req, res) => {
    res.json(
      await service.updateGroup(currentUserId(req), pathParam(req, 'id'), req.body),
    );
  }),
);

filterGroupsRouter.delete(
  '/:id',
  validate(groupIdParam, 'params'),
  asyncHandler(async (req, res) => {
    await service.deleteGroup(currentUserId(req), pathParam(req, 'id'));
    res.status(204).send();
  }),
);

/* ------------------------------- filters --------------------------------- */

filterGroupsRouter.post(
  '/:id/filters',
  validate(groupIdParam, 'params'),
  validate(filterInputSchema),
  asyncHandler(async (req, res) => {
    res
      .status(201)
      .json(await service.addFilter(currentUserId(req), pathParam(req, 'id'), req.body));
  }),
);

filterGroupsRouter.put(
  '/:id/filters/:filterId',
  validate(filterIdParam, 'params'),
  validate(filterInputSchema),
  asyncHandler(async (req, res) => {
    res.json(
      await service.updateFilter(
        currentUserId(req),
        pathParam(req, 'id'),
        pathParam(req, 'filterId'),
        req.body,
      ),
    );
  }),
);

filterGroupsRouter.delete(
  '/:id/filters/:filterId',
  validate(filterIdParam, 'params'),
  asyncHandler(async (req, res) => {
    await service.deleteFilter(
      currentUserId(req),
      pathParam(req, 'id'),
      pathParam(req, 'filterId'),
    );
    res.status(204).send();
  }),
);

/* --------------------------------- runs ---------------------------------- */

filterGroupsRouter.post(
  '/:id/fetch',
  validate(groupIdParam, 'params'),
  asyncHandler(async (req, res) => {
    res.json(await runGroup(pathParam(req, 'id'), currentUserId(req), 'manual'));
  }),
);

filterGroupsRouter.get(
  '/:id/runs',
  validate(groupIdParam, 'params'),
  validate(z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) }), 'query'),
  asyncHandler(async (req, res) => {
    const { limit } = req.query as unknown as { limit: number };
    res.json(await service.listRuns(currentUserId(req), pathParam(req, 'id'), limit));
  }),
);
