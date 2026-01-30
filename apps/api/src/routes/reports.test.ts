import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

// Mock the database module
vi.mock('@ice-activity-map/database', () => ({
  testConnection: vi.fn().mockResolvedValue(true),
  getReports: vi.fn().mockResolvedValue({
    reports: [
      {
        id: '123',
        sourceType: 'manual',
        sourceId: null,
        activityType: 'raid',
        description: 'Test report',
        city: 'Los Angeles',
        state: 'California',
        latitude: 34.0522,
        longitude: -118.2437,
        authorHandle: 'testuser',
        authorDisplayName: 'Test User',
        status: 'approved',
        reportedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ],
    total: 1
  }),
  getReportById: vi.fn().mockImplementation((id: string) => {
    if (id === '123') {
      return Promise.resolve({
        id: '123',
        sourceType: 'manual',
        activityType: 'raid',
        description: 'Test report',
        city: 'Los Angeles',
        state: 'California',
        latitude: 34.0522,
        longitude: -118.2437,
        authorHandle: 'testuser',
        authorDisplayName: 'Test User',
        status: 'approved',
        reportedAt: new Date(),
        createdAt: new Date()
      });
    }
    return Promise.resolve(null);
  }),
  createReport: vi.fn().mockResolvedValue({
    id: 'new-123',
    sourceType: 'manual',
    activityType: 'checkpoint',
    description: 'New test report',
    city: 'New York',
    state: 'New York',
    status: 'pending'
  }),
  closePool: vi.fn()
}));

describe('Reports API', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = 'test';
    app = createApp();
  });

  describe('GET /api/reports', () => {
    it('should return list of reports', async () => {
      const response = await request(app)
        .get('/api/reports')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('reports');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.reports)).toBe(true);
    });

    it('should accept query parameters', async () => {
      const response = await request(app)
        .get('/api/reports?limit=10&offset=0&activityTypes=raid,checkpoint')
        .expect(200);

      expect(response.body).toHaveProperty('reports');
    });
  });

  describe('GET /api/reports/:id', () => {
    it('should return a specific report', async () => {
      const response = await request(app)
        .get('/api/reports/123')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('id', '123');
      expect(response.body).toHaveProperty('activityType', 'raid');
    });

    it('should return 404 for non-existent report', async () => {
      const response = await request(app)
        .get('/api/reports/nonexistent')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/reports', () => {
    it('should create a new report', async () => {
      const newReport = {
        activityType: 'checkpoint',
        description: 'ICE checkpoint spotted',
        city: 'New York',
        state: 'New York',
        authorHandle: 'testuser'
      };

      const response = await request(app)
        .post('/api/reports')
        .send(newReport)
        .expect('Content-Type', /json/)
        .expect(201);

      expect(response.body).toHaveProperty('id');
    });

    it('should reject report without required fields', async () => {
      const response = await request(app)
        .post('/api/reports')
        .send({ description: 'Missing activity type' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject invalid activity type', async () => {
      const response = await request(app)
        .post('/api/reports')
        .send({
          activityType: 'invalid',
          description: 'Test',
          authorHandle: 'testuser'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('database');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('404 handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/unknown')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Not found');
    });
  });
});
