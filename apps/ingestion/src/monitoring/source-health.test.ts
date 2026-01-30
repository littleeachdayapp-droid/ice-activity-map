import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SourceHealthTracker } from './source-health';

describe('SourceHealthTracker', () => {
  let tracker: SourceHealthTracker;

  beforeEach(() => {
    tracker = new SourceHealthTracker();
  });

  describe('recordSuccess / recordFailure', () => {
    it('should track success metrics', () => {
      tracker.recordSuccess('bluesky', 150);
      const m = tracker.getMetrics('bluesky');
      expect(m).toBeDefined();
      expect(m!.totalSuccesses).toBe(1);
      expect(m!.consecutiveFailures).toBe(0);
      expect(m!.lastResponseTimeMs).toBe(150);
      expect(m!.lastSuccess).toBeInstanceOf(Date);
    });

    it('should track failure metrics', () => {
      tracker.recordFailure('reddit');
      const m = tracker.getMetrics('reddit');
      expect(m!.totalFailures).toBe(1);
      expect(m!.consecutiveFailures).toBe(1);
      expect(m!.lastFailure).toBeInstanceOf(Date);
    });

    it('should reset consecutive failures on success', () => {
      tracker.recordFailure('bluesky');
      tracker.recordFailure('bluesky');
      tracker.recordSuccess('bluesky', 100);
      const m = tracker.getMetrics('bluesky');
      expect(m!.consecutiveFailures).toBe(0);
      expect(m!.totalFailures).toBe(2);
      expect(m!.totalSuccesses).toBe(1);
    });
  });

  describe('shouldSkip', () => {
    it('should return false for unknown sources', () => {
      expect(tracker.shouldSkip('unknown')).toBe(false);
    });

    it('should return false when failures are below threshold', () => {
      for (let i = 0; i < 4; i++) tracker.recordFailure('bluesky');
      expect(tracker.shouldSkip('bluesky')).toBe(false);
    });

    it('should return true after 5+ consecutive failures (within backoff window)', () => {
      for (let i = 0; i < 5; i++) tracker.recordFailure('bluesky');
      // Just failed, so elapsed ~0 which is < 60s backoff
      expect(tracker.shouldSkip('bluesky')).toBe(true);
    });

    it('should use exponential backoff timing', () => {
      vi.useFakeTimers();
      try {
        // 5 failures → backoff = 2^0 * 60s = 60s
        for (let i = 0; i < 5; i++) tracker.recordFailure('bluesky');
        expect(tracker.shouldSkip('bluesky')).toBe(true);

        // Advance 61 seconds — should no longer skip
        vi.advanceTimersByTime(61_000);
        expect(tracker.shouldSkip('bluesky')).toBe(false);

        // 6th failure → backoff = 2^1 * 60s = 120s
        tracker.recordFailure('bluesky');
        expect(tracker.shouldSkip('bluesky')).toBe(true);

        vi.advanceTimersByTime(61_000); // only 61s — still in 120s window
        expect(tracker.shouldSkip('bluesky')).toBe(true);

        vi.advanceTimersByTime(60_000); // now 121s total
        expect(tracker.shouldSkip('bluesky')).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('getSummary', () => {
    it('should return "no data" when empty', () => {
      expect(tracker.getSummary()).toBe('no data');
    });

    it('should show OK for healthy sources', () => {
      tracker.recordSuccess('bluesky', 100);
      expect(tracker.getSummary()).toBe('bluesky:OK');
    });

    it('should show WARN for sources with some failures', () => {
      tracker.recordFailure('reddit');
      expect(tracker.getSummary()).toBe('reddit:WARN(1)');
    });

    it('should show BACKOFF for sources at threshold', () => {
      for (let i = 0; i < 5; i++) tracker.recordFailure('reddit');
      expect(tracker.getSummary()).toBe('reddit:BACKOFF(5)');
    });

    it('should show multiple sources', () => {
      tracker.recordSuccess('bluesky', 100);
      tracker.recordFailure('reddit');
      const summary = tracker.getSummary();
      expect(summary).toContain('bluesky:OK');
      expect(summary).toContain('reddit:WARN(1)');
    });
  });
});
