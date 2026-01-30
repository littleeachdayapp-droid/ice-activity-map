import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

// Mock the database module
vi.mock('@ice-activity-map/database', () => ({
  testConnection: vi.fn().mockResolvedValue(true),
  getPendingFlags: vi.fn().mockResolvedValue({
    flags: [
      {
        id: '1',
        reportId: '1',
        reason: 'spam',
        status: 'pending',
        createdAt: new Date()
      }
    ],
    total: 1
  }),
  updateReportStatus: vi.fn().mockResolvedValue({
    id: '1',
    status: 'approved'
  }),
  getModerationLog: vi.fn().mockResolvedValue([
    {
      id: '1',
      reportId: '1',
      action: 'status_change',
      previousStatus: 'pending',
      newStatus: 'approved',
      moderatorId: 'admin',
      createdAt: new Date()
    }
  ]),
  closePool: vi.fn()
}));

describe('Moderation API', () => {
  let app: ReturnType<typeof createApp>;
  const ADMIN_KEY = 'test-admin-key';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = 'test';
    process.env.ADMIN_API_KEY = ADMIN_KEY;
    app = createApp();
  });

  describe('GET /api/moderation/queue', () => {
    it('should require admin key', async () => {
      const response = await request(app)
        .get('/api/moderation/queue')
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject invalid admin key', async () => {
      const response = await request(app)
        .get('/api/moderation/queue')
        .set('X-Admin-Key', 'wrong-key')
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });

    it('should return queue with valid admin key', async () => {
      const response = await request(app)
        .get('/api/moderation/queue')
        .set('X-Admin-Key', ADMIN_KEY)
        .expect(200);

      expect(response.body).toHaveProperty('flags');
      expect(Array.isArray(response.body.flags)).toBe(true);
    });
  });

  describe('POST /api/moderation/reports/:id/status', () => {
    it('should require admin key', async () => {
      const response = await request(app)
        .post('/api/moderation/reports/1/status')
        .send({ status: 'approved' })
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject invalid status', async () => {
      const response = await request(app)
        .post('/api/moderation/reports/1/status')
        .set('X-Admin-Key', ADMIN_KEY)
        .send({ status: 'invalid' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/moderation/log', () => {
    it('should require admin key', async () => {
      await request(app)
        .get('/api/moderation/log')
        .expect(403);
    });

    it('should return moderation log with valid admin key', async () => {
      const response = await request(app)
        .get('/api/moderation/log')
        .set('X-Admin-Key', ADMIN_KEY)
        .expect(200);

      expect(response.body).toHaveProperty('log');
      expect(Array.isArray(response.body.log)).toBe(true);
    });
  });
});
