import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

// Mock the database module
vi.mock('@ice-activity-map/database', () => ({
  testConnection: vi.fn().mockResolvedValue(true),
  query: vi.fn().mockImplementation((sql: string) => {
    // Mock different queries based on SQL content
    if (sql.includes('COUNT(*)') && sql.includes('GROUP BY activity_type')) {
      return Promise.resolve({
        rows: [
          { activity_type: 'raid', count: '10' },
          { activity_type: 'checkpoint', count: '5' },
          { activity_type: 'arrest', count: '3' }
        ]
      });
    }
    if (sql.includes('COUNT(*)') && sql.includes('GROUP BY state')) {
      return Promise.resolve({
        rows: [
          { state: 'California', count: '8' },
          { state: 'Texas', count: '5' }
        ]
      });
    }
    if (sql.includes('DATE(reported_at)')) {
      return Promise.resolve({
        rows: [
          { date: '2024-01-20', count: '5' },
          { date: '2024-01-21', count: '3' }
        ]
      });
    }
    if (sql.includes('ORDER BY reported_at DESC')) {
      return Promise.resolve({
        rows: [
          {
            id: '1',
            activity_type: 'raid',
            city: 'Los Angeles',
            state: 'California',
            reported_at: new Date()
          }
        ]
      });
    }
    // Default count query
    return Promise.resolve({ rows: [{ count: '18' }] });
  }),
  closePool: vi.fn()
}));

describe('Stats API', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = 'test';
    app = createApp();
  });

  describe('GET /api/stats', () => {
    it('should return statistics', async () => {
      const response = await request(app)
        .get('/api/stats')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('totalReports');
      expect(response.body).toHaveProperty('last7Days');
      expect(response.body).toHaveProperty('last30Days');
      expect(response.body).toHaveProperty('byActivityType');
      expect(response.body).toHaveProperty('topStates');
      expect(response.body).toHaveProperty('timeline');
      expect(response.body).toHaveProperty('recentActivity');
    });

    it('should return activity type breakdown as array', async () => {
      const response = await request(app)
        .get('/api/stats')
        .expect(200);

      expect(Array.isArray(response.body.byActivityType)).toBe(true);
      if (response.body.byActivityType.length > 0) {
        expect(response.body.byActivityType[0]).toHaveProperty('type');
        expect(response.body.byActivityType[0]).toHaveProperty('count');
      }
    });

    it('should return top states as array', async () => {
      const response = await request(app)
        .get('/api/stats')
        .expect(200);

      expect(Array.isArray(response.body.topStates)).toBe(true);
    });

    it('should return timeline data', async () => {
      const response = await request(app)
        .get('/api/stats')
        .expect(200);

      expect(Array.isArray(response.body.timeline)).toBe(true);
    });

    it('should return numeric values for counts', async () => {
      const response = await request(app)
        .get('/api/stats')
        .expect(200);

      expect(typeof response.body.totalReports).toBe('number');
      expect(typeof response.body.last7Days).toBe('number');
      expect(typeof response.body.last30Days).toBe('number');
    });
  });
});
