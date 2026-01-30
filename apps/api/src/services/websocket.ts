import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { logger } from '../utils/logger.js';
import type { Report } from '@ice-activity-map/database';

let io: Server | null = null;

export interface ReportEvent {
  type: 'new_report' | 'report_updated' | 'report_verified' | 'report_flagged';
  report: Report;
}

export function initializeWebSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST']
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  io.on('connection', (socket: Socket) => {
    logger.info('WebSocket client connected', {
      id: socket.id,
      ip: socket.handshake.address
    });

    // Allow clients to subscribe to specific regions
    socket.on('subscribe:region', (bounds: { south: number; west: number; north: number; east: number }) => {
      const roomName = `region:${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;
      socket.join(roomName);
      logger.debug('Client subscribed to region', { id: socket.id, bounds });
    });

    // Allow clients to unsubscribe from regions
    socket.on('unsubscribe:region', (bounds: { south: number; west: number; north: number; east: number }) => {
      const roomName = `region:${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;
      socket.leave(roomName);
      logger.debug('Client unsubscribed from region', { id: socket.id, bounds });
    });

    // Subscribe to specific activity types
    socket.on('subscribe:activity', (activityType: string) => {
      socket.join(`activity:${activityType}`);
      logger.debug('Client subscribed to activity type', { id: socket.id, activityType });
    });

    socket.on('disconnect', (reason) => {
      logger.info('WebSocket client disconnected', {
        id: socket.id,
        reason
      });
    });

    socket.on('error', (error) => {
      logger.error('WebSocket error', {
        id: socket.id,
        error: error.message
      });
    });
  });

  logger.info('WebSocket server initialized');
  return io;
}

export function getIO(): Server | null {
  return io;
}

// Emit a new report event to all connected clients
export function emitNewReport(report: Report): void {
  if (!io) {
    logger.warn('WebSocket not initialized, cannot emit new report');
    return;
  }

  const event: ReportEvent = {
    type: 'new_report',
    report
  };

  // Emit to all clients
  io.emit('report:new', event);

  // Also emit to activity-specific room
  io.to(`activity:${report.activityType}`).emit('report:activity', event);

  // Emit to region-specific rooms if report has coordinates
  if (report.latitude && report.longitude) {
    // Get all rooms and find matching region subscriptions
    const rooms = io.sockets.adapter.rooms;
    rooms.forEach((_, roomName) => {
      if (roomName.startsWith('region:')) {
        const [south, west, north, east] = roomName.replace('region:', '').split(',').map(Number);
        if (
          report.latitude! >= south &&
          report.latitude! <= north &&
          report.longitude! >= west &&
          report.longitude! <= east
        ) {
          io!.to(roomName).emit('report:region', event);
        }
      }
    });
  }

  logger.debug('Emitted new report event', { reportId: report.id });
}

// Emit a report update event
export function emitReportUpdated(report: Report): void {
  if (!io) {
    logger.warn('WebSocket not initialized, cannot emit report update');
    return;
  }

  const event: ReportEvent = {
    type: 'report_updated',
    report
  };

  io.emit('report:updated', event);
  logger.debug('Emitted report update event', { reportId: report.id });
}

// Emit a report verification event
export function emitReportVerified(report: Report): void {
  if (!io) {
    logger.warn('WebSocket not initialized, cannot emit verification');
    return;
  }

  const event: ReportEvent = {
    type: 'report_verified',
    report
  };

  io.emit('report:verified', event);
  logger.debug('Emitted report verified event', { reportId: report.id });
}

// Get connection stats
export function getConnectionStats(): { connected: number; rooms: number } {
  if (!io) {
    return { connected: 0, rooms: 0 };
  }

  return {
    connected: io.sockets.sockets.size,
    rooms: io.sockets.adapter.rooms.size
  };
}
