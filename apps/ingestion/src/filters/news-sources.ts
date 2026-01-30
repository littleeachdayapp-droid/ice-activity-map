/**
 * News source reliability classification.
 * Trusted sources get relaxed filtering; blocked sources are skipped entirely.
 */

const TRUSTED_SOURCES = new Set([
  // Wire services
  'associated press', 'ap news', 'reuters',
  // National
  'npr', 'pbs', 'abc news', 'cbs news', 'nbc news',
  // Spanish-language
  'univision', 'telemundo', 'noticias telemundo',
  // Regional / investigative
  'propublica', 'the texas tribune', 'la times', 'los angeles times',
  'miami herald', 'houston chronicle', 'arizona republic',
  'san antonio express-news', 'el paso times',
]);

const BLOCKED_SOURCES = new Set([
  // Known unreliable / clickbait
  'infowars', 'natural news', 'the gateway pundit',
  'breitbart', 'daily stormer', 'oann', 'newsmax',
]);

export type SourceTier = 'trusted' | 'blocked' | 'unknown';

export function classifySource(sourceName: string): SourceTier {
  const lower = sourceName.toLowerCase().trim();
  if (BLOCKED_SOURCES.has(lower)) return 'blocked';
  const trustedArray = Array.from(TRUSTED_SOURCES);
  for (const trusted of trustedArray) {
    if (lower.includes(trusted) || trusted.includes(lower)) return 'trusted';
  }
  return 'unknown';
}
