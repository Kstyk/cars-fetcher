import { Router } from 'express';
import { asyncHandler } from '../../lib/async-handler.js';
import { authenticate, pathParam, requireRole } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { fetchVehicleHistory, getVehicleHistoryStatus } from './vehicle-history/vehicle-history.service.js';
import { lookupVin } from './vin.service.js';
import { vinParam } from './vin.schemas.js';

export const vinRouter = Router();

vinRouter.use(authenticate);

vinRouter.get(
  '/history/available',
  asyncHandler(async (_req, res) => {
    res.json(getVehicleHistoryStatus());
  }),
);

// Costs real money per call (AutoDNA/carVertical) - admin only, same
// reasoning as the knowledge base's LLM generation, and never triggered by
// the free `GET /:vin` decode above.
vinRouter.get(
  '/:vin/history',
  requireRole('admin'),
  validate(vinParam, 'params'),
  asyncHandler(async (req, res) => {
    res.json(await fetchVehicleHistory(pathParam(req, 'vin')));
  }),
);

vinRouter.get(
  '/:vin',
  validate(vinParam, 'params'),
  asyncHandler(async (req, res) => {
    res.json(await lookupVin(pathParam(req, 'vin')));
  }),
);
