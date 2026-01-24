import { useState, useEffect, useCallback } from 'react';
import { Report, FilterState } from '../types/report';
import { mockReports } from '../data/mockReports';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();

      if (filters.activityTypes.length > 0) {
        params.set('activityTypes', filters.activityTypes.join(','));
      }

      if (filters.timeRange !== 'all') {
        params.set('timeRange', filters.timeRange);
      }

      params.set('limit', '500');

      const response = await fetch(`${API_URL}/api/reports?${params}`);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data: ApiResponse = await response.json();

      const mappedReports = data.reports
        .map(apiReportToReport)
        .filter((r): r is Report => r !== null);

      setReports(mappedReports);
      setUsingMockData(false);
    } catch (err) {
      console.warn('Failed to fetch from API, using mock data:', err);
      setUsingMockData(true);

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

  return { reports, loading, error, usingMockData, refetch: fetchReports };
}
