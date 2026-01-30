import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create mock function
const mockQueryFn = vi.fn();

// Mock pg module before importing
vi.mock('../client.js', () => ({
  query: (...args: unknown[]) => mockQueryFn(...args),
  getPool: vi.fn(),
  closePool: vi.fn(),
  testConnection: vi.fn().mockResolvedValue(true)
}));

// Import after mocking
const reportsModule = await import('./reports.js');
const { getReports, getReportById, createReport, getReportBySourceId } = reportsModule;

describe('Reports Repository', () => {
  beforeEach(() => {
    mockQueryFn.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getReports', () => {
    it('should return reports with pagination', async () => {
      // First call is COUNT query, second is SELECT query
      mockQueryFn
        .mockResolvedValueOnce({
          rows: [{ count: '1' }]
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: '1',
              source_type: 'bluesky',
              source_id: 'bsky://1',
              activity_type: 'raid',
              description: 'Test report',
              city: 'Los Angeles',
              state: 'California',
              latitude: 34.05,
              longitude: -118.24,
              author_handle: 'user1',
              author_display_name: 'User One',
              status: 'approved',
              confirm_count: 0,
              dispute_count: 0,
              reported_at: new Date('2024-01-20'),
              created_at: new Date('2024-01-20'),
              updated_at: new Date('2024-01-20')
            }
          ]
        });

      const result = await getReports({}, { limit: 10, offset: 0 });

      expect(result.reports).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.reports[0].id).toBe('1');
      expect(result.reports[0].activityType).toBe('raid');
    });

    it('should handle empty results', async () => {
      // First call is COUNT, second is SELECT
      mockQueryFn
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await getReports({}, { limit: 10, offset: 0 });

      expect(result.reports).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('getReportById', () => {
    it('should return report when found', async () => {
      mockQueryFn.mockResolvedValueOnce({
        rows: [{
          id: '123',
          source_type: 'manual',
          source_id: null,
          activity_type: 'checkpoint',
          description: 'Test',
          city: 'NYC',
          state: 'New York',
          latitude: 40.7,
          longitude: -74.0,
          author_handle: 'user',
          author_display_name: 'User',
          status: 'pending',
          confirm_count: 0,
          dispute_count: 0,
          reported_at: new Date('2024-01-20'),
          created_at: new Date('2024-01-20'),
          updated_at: new Date('2024-01-20')
        }]
      });

      const result = await getReportById('123');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('123');
      expect(result?.activityType).toBe('checkpoint');
    });

    it('should return null when not found', async () => {
      mockQueryFn.mockResolvedValueOnce({ rows: [] });

      const result = await getReportById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('createReport', () => {
    it('should create a new report and return it', async () => {
      const reportedAt = new Date('2024-01-20');
      const createdAt = new Date('2024-01-20');

      mockQueryFn.mockResolvedValueOnce({
        rows: [{
          id: 'new-1',
          source_type: 'user_submitted',
          source_id: null,
          activity_type: 'raid',
          description: 'ICE raid observed',
          city: 'Chicago',
          state: 'Illinois',
          latitude: null,
          longitude: null,
          author_handle: 'reporter1',
          author_display_name: null,
          status: 'pending',
          confirm_count: 0,
          dispute_count: 0,
          reported_at: reportedAt,
          created_at: createdAt,
          updated_at: createdAt
        }]
      });

      const result = await createReport({
        sourceType: 'user_submitted',
        activityType: 'raid',
        description: 'ICE raid observed',
        city: 'Chicago',
        state: 'Illinois',
        authorHandle: 'reporter1',
        reportedAt: new Date('2024-01-20')
      });

      expect(result.id).toBe('new-1');
      expect(result.activityType).toBe('raid');
      expect(result.status).toBe('pending');
      expect(result.city).toBe('Chicago');
    });
  });

  describe('getReportBySourceId', () => {
    it('should find report by source type and id', async () => {
      mockQueryFn.mockResolvedValueOnce({
        rows: [{
          id: '1',
          source_type: 'bluesky',
          source_id: 'bsky://123',
          activity_type: 'raid',
          description: 'Test',
          city: 'LA',
          state: 'CA',
          latitude: 34.0,
          longitude: -118.0,
          author_handle: 'user',
          author_display_name: 'User',
          status: 'approved',
          confirm_count: 0,
          dispute_count: 0,
          reported_at: new Date('2024-01-20'),
          created_at: new Date('2024-01-20'),
          updated_at: new Date('2024-01-20')
        }]
      });

      const result = await getReportBySourceId('bluesky', 'bsky://123');

      expect(result).not.toBeNull();
      expect(result?.sourceId).toBe('bsky://123');
      expect(result?.sourceType).toBe('bluesky');
    });

    it('should return null when source not found', async () => {
      mockQueryFn.mockResolvedValueOnce({ rows: [] });

      const result = await getReportBySourceId('bluesky', 'nonexistent');

      expect(result).toBeNull();
    });
  });
});
