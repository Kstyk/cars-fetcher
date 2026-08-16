import { Router } from 'express';
import { asyncHandler } from '../../lib/async-handler.js';
import { authenticate, currentUserId } from '../../middleware/authenticate.js';
import { getFilterUsageStats } from './usage-stats.service.js';

export const usageStatsRouter = Router();

usageStatsRouter.use(authenticate);

usageStatsRouter.get(
  '/filters',
  asyncHandler(async (req, res) => {
    res.json(await getFilterUsageStats(currentUserId(req)));
  }),
);
