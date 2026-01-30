import { query } from '@ice-activity-map/database';

const TTL_DAYS = 7;

/**
 * Two-level deduplication cache:
 * L1: In-memory Set (fast, lost on restart)
 * L2: PostgreSQL ingestion_cache table (persistent, 7-day TTL)
 */
export class PersistentDedup {
  private memoryCache = new Set<string>();
  private pendingInserts: Array<{ sourceType: string; sourceId: string }> = [];
  private dbEnabled: boolean;

  constructor(dbEnabled: boolean) {
    this.dbEnabled = dbEnabled;
  }

  /**
   * Check if a post has been seen before. Returns true if already seen.
   */
  async hasSeen(sourceType: string, sourceId: string): Promise<boolean> {
    const key = `${sourceType}:${sourceId}`;

    // L1: memory check
    if (this.memoryCache.has(key)) {
      return true;
    }

    // L2: DB check
    if (this.dbEnabled) {
      try {
        const result = await query<{ source_id: string }>(
          'SELECT source_id FROM ingestion_cache WHERE source_type = $1 AND source_id = $2',
          [sourceType, sourceId]
        );
        if (result.rows.length > 0) {
          this.memoryCache.add(key);
          return true;
        }
      } catch {
        // DB unavailable — fall through to not-seen
      }
    }

    return false;
  }

  /**
   * Mark a post as seen. Buffers DB inserts for batch flush.
   */
  markSeen(sourceType: string, sourceId: string): void {
    const key = `${sourceType}:${sourceId}`;
    this.memoryCache.add(key);
    if (this.dbEnabled) {
      this.pendingInserts.push({ sourceType, sourceId });
    }
  }

  /**
   * Flush pending inserts to DB in a single batch.
   */
  async flush(): Promise<number> {
    if (!this.dbEnabled || this.pendingInserts.length === 0) return 0;

    const batch = this.pendingInserts.splice(0);
    try {
      // Build batch insert with ON CONFLICT DO NOTHING
      const values = batch
        .map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`)
        .join(', ');
      const params = batch.flatMap((b) => [b.sourceType, b.sourceId]);
      await query(
        `INSERT INTO ingestion_cache (source_type, source_id) VALUES ${values} ON CONFLICT DO NOTHING`,
        params
      );
      return batch.length;
    } catch (error) {
      console.error('[Dedup] Batch insert failed:', error);
      // Re-queue failed items
      this.pendingInserts.push(...batch);
      return 0;
    }
  }

  /**
   * Remove entries older than TTL_DAYS.
   */
  async cleanup(): Promise<number> {
    if (!this.dbEnabled) return 0;
    try {
      const result = await query(
        `DELETE FROM ingestion_cache WHERE first_seen_at < NOW() - INTERVAL '${TTL_DAYS} days'`
      );
      return result.rowCount ?? 0;
    } catch (error) {
      console.error('[Dedup] Cleanup failed:', error);
      return 0;
    }
  }

  get memoryCacheSize(): number {
    return this.memoryCache.size;
  }
}
