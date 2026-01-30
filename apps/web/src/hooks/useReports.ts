import { useState, useEffect, useCallback, useRef } from 'react';
import { Report, FilterState } from '../types/report';
import { mockReports } from '../data/mockReports';
import { useSocket } from './useSocket';
import { api, isApiError, getErrorMessage } from '../utils/api';
import {
  cacheReports,
  getCachedReports,
  addReportToCache,
  isOfflineStorageSupported
} from '../utils/offlineStorage';

interface ApiReport {
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
}

interface ApiResponse {
  reports: ApiReport[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

function apiReportToReport(api: ApiReport): Report | null {
  // Skip reports without coordinates
  if (api.latitude === null || api.longitude === null) {
    return null;
  }

  return {
    id: api.id,
    activityType: api.activityType as Report['activityType'],
    location: {
      lat: api.latitude,
      lng: api.longitude,
      city: api.city || 'Unknown',
      state: api.state || ''
    },
    description: api.description,
    timestamp: new Date(api.reportedAt),
    author: api.authorDisplayName || api.authorHandle,
    status: api.status as Report['status']
  };
}

export function useReports(filters: FilterState) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingMockData, setUsingMockData] = useState(false);
  const [newReportCount, setNewReportCount] = useState(0);
  const filtersRef = useRef(filters);

  // Keep filters ref updated
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  // Handle new report from WebSocket
  const handleNewReport = useCallback((report: Report) => {
    const currentFilters = filtersRef.current;

    // Check if the report matches current filters
    if (!currentFilters.activityTypes.includes(report.activityType)) {
      return;
    }

    // Check time filter
    if (currentFilters.timeRange !== 'all') {
      const now = new Date();
      const hoursAgo = (now.getTime() - report.timestamp.getTime()) / (1000 * 60 * 60);
      const maxHours = {
        '24h': 24,
        '7d': 168,
        '30d': 720
      }[currentFilters.timeRange];

      if (hoursAgo > maxHours) {
        return;
      }
    }

    // Add to reports list
    setReports(prev => {
      // Check if already exists
      if (prev.some(r => r.id === report.id)) {
        return prev;
      }
      return [report, ...prev];
    });
    setNewReportCount(prev => prev + 1);

    // Also add to offline cache
    if (isOfflineStorageSupported()) {
      addReportToCache(report).catch(err => {
        console.warn('Failed to add report to cache:', err);
      });
    }
  }, []);

  // Handle report update from WebSocket
  const handleReportUpdated = useCallback((updatedReport: Report) => {
    setReports(prev =>
      prev.map(r => r.id === updatedReport.id ? updatedReport : r)
    );
  }, []);

  // Handle report verification from WebSocket
  const handleReportVerified = useCallback((verifiedReport: Report) => {
    setReports(prev =>
      prev.map(r => r.id === verifiedReport.id ? verifiedReport : r)
    );
  }, []);

  // Connect to WebSocket
  const { connected } = useSocket({
    onNewReport: handleNewReport,
    onReportUpdated: handleReportUpdated,
    onReportVerified: handleReportVerified,
    enabled: !usingMockData
  });

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNewReportCount(0);

    try {
      const params = new URLSearchParams();

      if (filters.activityTypes.length > 0) {
        params.set('activityTypes', filters.activityTypes.join(','));
      }

      if (filters.timeRange !== 'all') {
        params.set('timeRange', filters.timeRange);
      }

      params.set('limit', '500');

      // Use API utility with retry logic
      const data = await api.get<ApiResponse>(`/api/reports?${params}`, {
        retries: 3,
        retryDelay: 1000,
        timeout: 30000,
        onRetry: (attempt, error) => {
          console.log(`Retry attempt ${attempt} due to: ${error.message}`);
        }
      });

      const mappedReports = data.reports
        .map(apiReportToReport)
        .filter((r): r is Report => r !== null);

      setReports(mappedReports);
      setUsingMockData(false);
      setError(null);

      // Cache reports for offline use
      if (isOfflineStorageSupported()) {
        cacheReports(mappedReports).catch(err => {
          console.warn('Failed to cache reports:', err);
        });
      }
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      console.warn('Failed to fetch from API:', errorMessage);

      // Try to load from offline cache first
      if (isOfflineStorageSupported()) {
        try {
          const cachedReports = await getCachedReports();
          if (cachedReports.length > 0) {
            // Filter cached reports based on current filters
            const now = new Date();
            const filtered = cachedReports.filter(report => {
              if (!filters.activityTypes.includes(report.activityType)) {
                return false;
              }

              if (filters.timeRange !== 'all') {
                const hoursAgo = (now.getTime() - report.timestamp.getTime()) / (1000 * 60 * 60);
                const maxHours = {
                  '24h': 24,
                  '7d': 168,
                  '30d': 720
                }[filters.timeRange];

                if (hoursAgo > maxHours) {
                  return false;
                }
              }

              return true;
            });

            setReports(filtered);
            setUsingMockData(false);
            setError(`Offline mode: Showing ${filtered.length} cached reports.`);
            setLoading(false);
            return;
          }
        } catch (cacheErr) {
          console.warn('Failed to load from cache:', cacheErr);
        }
      }

      // Fall back to mock data if no cached reports
      setUsingMockData(true);
      if (isApiError(err) && err.retryable) {
        setError(`Connection issue: ${errorMessage}. Showing demo data.`);
      }

      // Fall back to mock data with client-side filtering
      const now = new Date();
      const filtered = mockReports.filter(report => {
        if (!filters.activityTypes.includes(report.activityType)) {
          return false;
        }

        if (filters.timeRange !== 'all') {
          const hoursAgo = (now.getTime() - report.timestamp.getTime()) / (1000 * 60 * 60);
          const maxHours = {
            '24h': 24,
            '7d': 168,
            '30d': 720
          }[filters.timeRange];

          if (hoursAgo > maxHours) {
            return false;
          }
        }

        return true;
      });

      setReports(filtered);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  return {
    reports,
    loading,
    error,
    usingMockData,
    refetch: fetchReports,
    connected,
    newReportCount
  };
}
