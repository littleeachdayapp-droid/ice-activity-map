type SourceName = string;

interface SourceMetrics {
  lastSuccess: Date | null;
  lastFailure: Date | null;
  consecutiveFailures: number;
  totalSuccesses: number;
  totalFailures: number;
  lastResponseTimeMs: number | null;
}

const MAX_CONSECUTIVE_FAILURES = 5;
const BACKOFF_BASE_MS = 60_000; // 1 minute

export class SourceHealthTracker {
  private metrics = new Map<SourceName, SourceMetrics>();

  private getOrCreate(source: SourceName): SourceMetrics {
    let m = this.metrics.get(source);
    if (!m) {
      m = {
        lastSuccess: null,
        lastFailure: null,
        consecutiveFailures: 0,
        totalSuccesses: 0,
        totalFailures: 0,
        lastResponseTimeMs: null,
      };
      this.metrics.set(source, m);
    }
    return m;
  }

  recordSuccess(source: SourceName, responseTimeMs: number): void {
    const m = this.getOrCreate(source);
    m.lastSuccess = new Date();
    m.consecutiveFailures = 0;
    m.totalSuccesses++;
    m.lastResponseTimeMs = responseTimeMs;
  }

  recordFailure(source: SourceName): void {
    const m = this.getOrCreate(source);
    m.lastFailure = new Date();
    m.consecutiveFailures++;
    m.totalFailures++;
  }

  /**
   * Returns true if the source should be skipped due to repeated failures.
   * Uses exponential backoff: skip for 2^(failures - MAX) * base ms.
   */
  shouldSkip(source: SourceName): boolean {
    const m = this.metrics.get(source);
    if (!m || m.consecutiveFailures < MAX_CONSECUTIVE_FAILURES) return false;

    if (!m.lastFailure) return false;

    const backoffExponent = m.consecutiveFailures - MAX_CONSECUTIVE_FAILURES;
    const backoffMs = Math.min(
      BACKOFF_BASE_MS * Math.pow(2, backoffExponent),
      30 * 60_000 // cap at 30 minutes
    );
    const elapsed = Date.now() - m.lastFailure.getTime();
    return elapsed < backoffMs;
  }

  /**
   * Returns a one-line health summary for logging.
   */
  getSummary(): string {
    if (this.metrics.size === 0) return 'no data';

    const parts: string[] = [];
    for (const [source, m] of this.metrics) {
      if (m.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        parts.push(`${source}:BACKOFF(${m.consecutiveFailures})`);
      } else if (m.consecutiveFailures > 0) {
        parts.push(`${source}:WARN(${m.consecutiveFailures})`);
      } else {
        parts.push(`${source}:OK`);
      }
    }
    return parts.join(' ');
  }

  getMetrics(source: SourceName): SourceMetrics | undefined {
    return this.metrics.get(source);
  }
}
