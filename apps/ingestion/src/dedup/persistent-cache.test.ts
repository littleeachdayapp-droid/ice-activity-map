import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PersistentDedup } from './persistent-cache';

// Mock the database module
vi.mock('@ice-activity-map/database', () => ({
  query: vi.fn(),
}));

import { query } from '@ice-activity-map/database';
const mockQuery = vi.mocked(query);

describe('PersistentDedup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('memory-only mode (dbEnabled=false)', () => {
    it('should return false for unseen items', async () => {
      const dedup = new PersistentDedup(false);
      expect(await dedup.hasSeen('bluesky', '123')).toBe(false);
    });

    it('should return true after markSeen', async () => {
      const dedup = new PersistentDedup(false);
      dedup.markSeen('bluesky', '123');
      expect(await dedup.hasSeen('bluesky', '123')).toBe(true);
    });

    it('should distinguish different source types', async () => {
      const dedup = new PersistentDedup(false);
      dedup.markSeen('bluesky', '123');
      expect(await dedup.hasSeen('reddit', '123')).toBe(false);
    });
  });

  describe('flush', () => {
    it('should return 0 with no pending inserts', async () => {
      const dedup = new PersistentDedup(false);
      expect(await dedup.flush()).toBe(0);
    });

    it('should return 0 when dbEnabled=false even with markSeen calls', async () => {
      const dedup = new PersistentDedup(false);
      dedup.markSeen('bluesky', '1');
      expect(await dedup.flush()).toBe(0);
    });

    it('should batch insert when dbEnabled=true', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 2 } as any);
      const dedup = new PersistentDedup(true);
      dedup.markSeen('bluesky', '1');
      dedup.markSeen('reddit', '2');
      const count = await dedup.flush();
      expect(count).toBe(2);
      expect(mockQuery).toHaveBeenCalledOnce();
    });
  });

  describe('memoryCacheSize', () => {
    it('should track memory cache size correctly', () => {
      const dedup = new PersistentDedup(false);
      expect(dedup.memoryCacheSize).toBe(0);
      dedup.markSeen('bluesky', '1');
      expect(dedup.memoryCacheSize).toBe(1);
      dedup.markSeen('reddit', '2');
      expect(dedup.memoryCacheSize).toBe(2);
      // Duplicate should not increase size
      dedup.markSeen('bluesky', '1');
      expect(dedup.memoryCacheSize).toBe(2);
    });
  });

  describe('hasSeen with DB', () => {
    it('should check DB when memory misses and dbEnabled=true', async () => {
      mockQuery.mockResolvedValue({ rows: [{ source_id: '1' }], rowCount: 1 } as any);
      const dedup = new PersistentDedup(true);
      expect(await dedup.hasSeen('bluesky', '1')).toBe(true);
      expect(mockQuery).toHaveBeenCalledOnce();
    });

    it('should return false when DB has no match', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);
      const dedup = new PersistentDedup(true);
      expect(await dedup.hasSeen('bluesky', '1')).toBe(false);
    });

    it('should fall through to false when DB query throws', async () => {
      mockQuery.mockRejectedValue(new Error('connection refused'));
      const dedup = new PersistentDedup(true);
      expect(await dedup.hasSeen('bluesky', '1')).toBe(false);
    });
  });
});
