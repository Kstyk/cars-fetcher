import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { filterGroupsRouter } from './modules/filters/filters.routes.js';
import {
  favoritesRouter,
  listingsRouter,
} from './modules/listings/listings.routes.js';
import { notificationsRouter } from './modules/notifications/notifications.routes.js';
import { taxonomyRouter } from './modules/taxonomy/taxonomy.routes.js';
import { listProviders } from './providers/registry.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req: { url?: string }) => req.url === '/api/health' },
    }),
  );

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), env: env.NODE_ENV });
  });

  app.get('/api/providers', (_req, res) => {
    res.json(listProviders());
  });

  app.use('/api/taxonomy', taxonomyRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/filter-groups', filterGroupsRouter);
  app.use('/api/listings', listingsRouter);
  app.use('/api/favorites', favoritesRouter);
  app.use('/api/notifications', notificationsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
