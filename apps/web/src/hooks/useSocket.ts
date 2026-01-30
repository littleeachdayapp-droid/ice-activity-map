import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Report } from '../types/report';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface ReportEvent {
  type: 'new_report' | 'report_updated' | 'report_verified' | 'report_flagged';
  report: {
    id: string;
    sourceType: string;
    sourceId: string | null;
    activityType: string;
    description: string;
    city: string | null;
    state: string | null;
    latitude: number | null;
    longitude: number | null;
    authorHandle: string;
    authorDisplayName: string | null;
    status: string;
    reportedAt: string;
    createdAt: string;
    updatedAt: string;
  };
}

function eventReportToReport(apiReport: ReportEvent['report']): Report | null {
  if (apiReport.latitude === null || apiReport.longitude === null) {
    return null;
  }

  return {
    id: apiReport.id,
    activityType: apiReport.activityType as Report['activityType'],
    location: {
      lat: apiReport.latitude,
      lng: apiReport.longitude,
      city: apiReport.city || 'Unknown',
      state: apiReport.state || ''
    },
    description: apiReport.description,
    timestamp: new Date(apiReport.reportedAt),
    author: apiReport.authorDisplayName || apiReport.authorHandle,
    status: apiReport.status as Report['status']
  };
}

interface UseSocketOptions {
  onNewReport?: (report: Report) => void;
  onReportUpdated?: (report: Report) => void;
  onReportVerified?: (report: Report) => void;
  enabled?: boolean;
}

export function useSocket(options: UseSocketOptions = {}) {
  const { onNewReport, onReportUpdated, onReportVerified, enabled = true } = options;
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Store callbacks in refs to avoid reconnection on callback changes
  const callbacksRef = useRef({ onNewReport, onReportUpdated, onReportVerified });
  useEffect(() => {
    callbacksRef.current = { onNewReport, onReportUpdated, onReportVerified };
  }, [onNewReport, onReportUpdated, onReportVerified]);

  useEffect(() => {
    if (!enabled) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setConnected(false);
      }
      return;
    }

    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('WebSocket connected');
      setConnected(true);
      setConnectionError(null);
    });

    socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      setConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.warn('WebSocket connection error:', error.message);
      setConnectionError(error.message);
      setConnected(false);
    });

    // Handle new report events
    socket.on('report:new', (event: ReportEvent) => {
      const report = eventReportToReport(event.report);
      if (report && callbacksRef.current.onNewReport) {
        callbacksRef.current.onNewReport(report);
      }
    });

    // Handle report update events
    socket.on('report:updated', (event: ReportEvent) => {
      const report = eventReportToReport(event.report);
      if (report && callbacksRef.current.onReportUpdated) {
        callbacksRef.current.onReportUpdated(report);
      }
    });

    // Handle report verification events
    socket.on('report:verified', (event: ReportEvent) => {
      const report = eventReportToReport(event.report);
      if (report && callbacksRef.current.onReportVerified) {
        callbacksRef.current.onReportVerified(report);
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled]);

  // Subscribe to a specific region
  const subscribeToRegion = useCallback((bounds: { south: number; west: number; north: number; east: number }) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('subscribe:region', bounds);
    }
  }, []);

  // Unsubscribe from a region
  const unsubscribeFromRegion = useCallback((bounds: { south: number; west: number; north: number; east: number }) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('unsubscribe:region', bounds);
    }
  }, []);

  // Subscribe to a specific activity type
  const subscribeToActivity = useCallback((activityType: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('subscribe:activity', activityType);
    }
  }, []);

  return {
    connected,
    connectionError,
    subscribeToRegion,
    unsubscribeFromRegion,
    subscribeToActivity
  };
}
