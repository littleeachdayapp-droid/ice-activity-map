import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import reportsRouter from './routes/reports.js';
import subscriptionsRouter from './routes/subscriptions.js';
import verificationsRouter from './routes/verifications.js';
import moderationRouter from './routes/moderation.js';
import statsRouter from './routes/stats.js';
import emailSubscriptionsRouter from './routes/email-subscriptions.js';
import { logger } from './utils/logger.js';
import { requestLogger } from './middleware/requestLogger.js';
import { testConnection } from '@ice-activity-map/database';
import { swaggerSpec } from './swagger.js';
import {
  subscriptionLimiter,
  statsLimiter
} from './middleware/rateLimiter.js';

export function createApp() {
  const app = express();

  // Security middleware
  app.use(helmet());

  // CORS
  app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'X-Admin-Key']
  }));

  // Body parser
  app.use(express.json({ limit: '10kb' }));

  if (process.env.NODE_ENV !== 'test') {
    app.use(requestLogger);
  }

  // Health check
  app.get('/health', async (_req, res) => {
    const dbHealthy = await testConnection();
    res.json({
      status: dbHealthy ? 'healthy' : 'degraded',
      database: dbHealthy ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    });
  });

  // API Documentation
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'ICE Activity Map API Docs'
  }));

  // OpenAPI JSON spec
  app.get('/api/docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  // Routes with granular rate limiting
  // Reports have their own per-method limiters defined in the router
  app.use('/api/reports', reportsRouter);
  app.use('/api/reports', verificationsRouter);

  // Subscriptions - lower limit to prevent abuse
  app.use('/api/subscriptions', subscriptionLimiter, subscriptionsRouter);
  app.use('/api/email-subscriptions', subscriptionLimiter, emailSubscriptionsRouter);

  // Moderation - has mixed public/admin routes with per-route limiters
  app.use('/api/moderation', moderationRouter);

  // Stats - moderate limit since it's a heavier query
  app.use('/api/stats', statsLimiter, statsRouter);

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Error handler
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error('Unhandled error', {
      error: err.message,
      stack: err.stack
    });
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
