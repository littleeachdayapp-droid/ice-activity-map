import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { testConnection } from '@ice-activity-map/database';
import reportsRouter from './routes/reports.js';
import subscriptionsRouter from './routes/subscriptions.js';
import verificationsRouter from './routes/verifications.js';
import moderationRouter from './routes/moderation.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'X-Admin-Key']
}));
app.use(express.json());

// Health check
app.get('/health', async (_req, res) => {
  const dbHealthy = await testConnection();
  res.json({
    status: dbHealthy ? 'healthy' : 'degraded',
    database: dbHealthy ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/api/reports', reportsRouter);
app.use('/api/reports', verificationsRouter); // Nested under reports
app.use('/api/subscriptions', subscriptionsRouter);
app.use('/api/moderation', moderationRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║       ICE Activity Map API Server                ║
╠══════════════════════════════════════════════════╣
║  Port: ${String(PORT).padEnd(41)}║
║                                                  ║
║  Public Endpoints:                               ║
║    GET  /health                                  ║
║    GET  /api/reports                             ║
║    GET  /api/reports/:id                         ║
║    POST /api/reports                             ║
║    POST /api/reports/:id/verify                  ║
║    POST /api/reports/:id/flag                    ║
║    POST /api/subscriptions                       ║
║    GET  /api/subscriptions/vapid-public-key      ║
║                                                  ║
║  Admin Endpoints (X-Admin-Key header):           ║
║    GET  /api/moderation/queue                    ║
║    POST /api/moderation/reports/:id/status       ║
║    GET  /api/moderation/log                      ║
╚══════════════════════════════════════════════════╝
`);
});
