import { Router } from 'express';
import { asyncHandler } from '../../lib/async-handler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { getSellerProfile } from './sellers.service.js';
import { sellerProfileQuery } from './sellers.schemas.js';

export const sellersRouter = Router();

sellersRouter.use(authenticate);

sellersRouter.get(
  '/profile',
  validate(sellerProfileQuery, 'query'),
  asyncHandler(async (req, res) => {
    const { name } = req.query as unknown as { name: string };
    res.json(await getSellerProfile(name));
  }),
);
