import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/async-handler.js';
import {
  authenticate,
  currentUserId,
  pathParam,
} from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { paginationSchema } from '../../lib/pagination.js';
import * as service from './notifications.service.js';

const listQuerySchema = paginationSchema.extend({
  onlyUnread: z.coerce.boolean().default(false),
});

const preferencesSchema = z.object({
  emailEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
  notifyNewListing: z.boolean().optional(),
  notifyPriceDrop: z.boolean().optional(),
  notifyListingRemoved: z.boolean().optional(),
  notifyFetchFailed: z.boolean().optional(),
  priceDropThresholdPct: z.number().min(0).max(100).optional(),
  digestFrequency: z
    .enum(['instant', 'hourly', 'daily', 'weekly', 'off'])
    .optional(),
  quietHoursStart: z.number().int().min(0).max(23).nullable().optional(),
  quietHoursEnd: z.number().int().min(0).max(23).nullable().optional(),
  timezone: z.string().max(64).optional(),
});

const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);

notificationsRouter.get(
  '/',
  validate(listQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as z.infer<typeof listQuerySchema>;
    res.json(
      await service.listNotifications(currentUserId(req), query, query.onlyUnread),
    );
  }),
);

notificationsRouter.get(
  '/unread-count',
  asyncHandler(async (req, res) => {
    res.json({ count: await service.unreadCount(currentUserId(req)) });
  }),
);

notificationsRouter.post(
  '/read',
  validate(z.object({ ids: z.array(z.string().uuid()).min(1).max(200) })),
  asyncHandler(async (req, res) => {
    res.json({ updated: await service.markRead(currentUserId(req), req.body.ids) });
  }),
);

notificationsRouter.post(
  '/read-all',
  asyncHandler(async (req, res) => {
    res.json({ updated: await service.markAllRead(currentUserId(req)) });
  }),
);

notificationsRouter.delete(
  '/:id',
  validate(z.object({ id: z.string().uuid() }), 'params'),
  asyncHandler(async (req, res) => {
    await service.deleteNotification(currentUserId(req), pathParam(req, 'id'));
    res.status(204).send();
  }),
);

/* ------------------------------ preferences ------------------------------ */

notificationsRouter.get(
  '/preferences/me',
  asyncHandler(async (req, res) => {
    res.json(await service.getPreferences(currentUserId(req)));
  }),
);

notificationsRouter.patch(
  '/preferences/me',
  validate(preferencesSchema),
  asyncHandler(async (req, res) => {
    res.json(await service.updatePreferences(currentUserId(req), req.body));
  }),
);

/* ----------------------------- push devices ------------------------------ */

notificationsRouter.get(
  '/push/subscriptions',
  asyncHandler(async (req, res) => {
    res.json(await service.listPushSubscriptions(currentUserId(req)));
  }),
);

notificationsRouter.post(
  '/push/subscribe',
  validate(pushSubscriptionSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof pushSubscriptionSchema>;
    await service.registerPushSubscription(currentUserId(req), {
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      userAgent: req.get('user-agent') ?? undefined,
    });
    res.status(201).json({ ok: true });
  }),
);

notificationsRouter.post(
  '/push/unsubscribe',
  validate(z.object({ endpoint: z.string().url() })),
  asyncHandler(async (req, res) => {
    await service.removePushSubscription(currentUserId(req), req.body.endpoint);
    res.status(204).send();
  }),
);
