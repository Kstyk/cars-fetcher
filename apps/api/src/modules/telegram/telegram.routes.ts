import { Router } from 'express';
import { asyncHandler } from '../../lib/async-handler.js';
import { authenticate, currentUserId } from '../../middleware/authenticate.js';
import { getTelegramLinkStatus, unlinkTelegram } from './telegram-link.service.js';

export const telegramRouter = Router();

telegramRouter.use(authenticate);

telegramRouter.get(
  '/status',
  asyncHandler(async (req, res) => {
    res.json(await getTelegramLinkStatus(currentUserId(req)));
  }),
);

telegramRouter.post(
  '/unlink',
  asyncHandler(async (req, res) => {
    await unlinkTelegram(currentUserId(req));
    res.status(204).send();
  }),
);
