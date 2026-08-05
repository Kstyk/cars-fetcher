import { Router } from 'express';
import { asyncHandler } from '../../lib/async-handler.js';
import {
  authenticate,
  currentUserId,
  pathParam,
} from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import {
  favoriteInputSchema,
  listingIdParam,
  listingQuerySchema,
  type ListingQuery,
} from './listings.schemas.js';
import * as service from './listings.service.js';

export const listingsRouter = Router();

listingsRouter.use(authenticate);

listingsRouter.get(
  '/',
  validate(listingQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    res.json(
      await service.searchListings(
        currentUserId(req),
        req.query as unknown as ListingQuery,
      ),
    );
  }),
);

listingsRouter.get(
  '/cities',
  asyncHandler(async (req, res) => {
    res.json(await service.listCities(currentUserId(req)));
  }),
);

listingsRouter.get(
  '/stats',
  asyncHandler(async (req, res) => {
    res.json(await service.getStats(currentUserId(req)));
  }),
);

listingsRouter.get(
  '/:id',
  validate(listingIdParam, 'params'),
  asyncHandler(async (req, res) => {
    res.json(await service.getListing(currentUserId(req), pathParam(req, 'id')));
  }),
);

listingsRouter.put(
  '/:id/favorite',
  validate(listingIdParam, 'params'),
  validate(favoriteInputSchema),
  asyncHandler(async (req, res) => {
    res.json(
      await service.addFavorite(currentUserId(req), pathParam(req, 'id'), req.body),
    );
  }),
);

listingsRouter.delete(
  '/:id/favorite',
  validate(listingIdParam, 'params'),
  asyncHandler(async (req, res) => {
    await service.removeFavorite(currentUserId(req), pathParam(req, 'id'));
    res.status(204).send();
  }),
);

/* ----------------------------- favourites list ---------------------------- */

export const favoritesRouter = Router();
favoritesRouter.use(authenticate);

favoritesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await service.listFavorites(currentUserId(req)));
  }),
);
