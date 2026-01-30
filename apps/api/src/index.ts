import 'dotenv/config';
import { createServer } from 'http';
import { createApp } from './app.js';
import { closePool } from '@ice-activity-map/database';
import { logger } from './utils/logger.js';
import { initializeWebSocket, getConnectionStats } from './services/websocket.js';

const PORT = process.env.PORT || 3001;
const app = createApp();

// Create HTTP server and attach Express
const httpServer = createServer(app);

// Initialize WebSocket server
const io = initializeWebSocket(httpServer);

// Add WebSocket stats to health endpoint
app.get('/ws/stats', (_req, res) => {
  res.json(getConnectionStats());
});

// Start server
const server = httpServer.listen(PORT, () => {
  logger.info('Server started', { port: PORT });
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
║    GET  /api/stats                               ║
║    POST /api/email-subscriptions                 ║
║                                                  ║
║  Admin Endpoints (X-Admin-Key header):           ║
║    GET  /api/moderation/queue                    ║
║    POST /api/moderation/reports/:id/status       ║
║    GET  /api/moderation/log                      ║
║                                                  ║
║  WebSocket: ws://localhost:${String(PORT).padEnd(24)}║
║    GET  /ws/stats                                ║
║                                                  ║
║  Documentation:                                  ║
║    GET  /api/docs                                ║
║    GET  /api/docs.json                           ║
╚══════════════════════════════════════════════════╝
`);
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  logger.info(`Received ${signal}, starting graceful shutdown`);

  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      await closePool();
      logger.info('Database connections closed');
    } catch (err) {
      logger.error('Error closing database', { error: (err as Error).message });
    }

    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcing shutdown');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
