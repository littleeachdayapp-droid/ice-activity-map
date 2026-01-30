import "dotenv/config";
import { searchAllKeywords, type BlueskyPost } from "./bluesky/search.js";
import { searchAllInstances, type MastodonPost } from "./mastodon/search.js";
import { searchReddit, type RedditPost } from "./reddit/search.js";
import { searchGoogleNews, type GoogleNewsArticle } from "./google-news/search.js";
import { extractLocation, detectActivityType } from "./location/extractor.js";
import { geocode, geocodeCityState } from "./geocoding/nominatim.js";
import { createReport, getReportBySourceId, testConnection } from "@ice-activity-map/database";
import { checkRelevance, checkNewsRelevance } from "./filters/relevance.js";
import { classifySource } from "./filters/news-sources.js";
import { PersistentDedup } from "./dedup/persistent-cache.js";
import { SourceHealthTracker } from "./monitoring/source-health.js";

const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || "60000", 10);
const ENABLE_DB = process.env.ENABLE_DB !== "false";

// Enable/disable specific sources
const ENABLE_BLUESKY = process.env.ENABLE_BLUESKY !== "false";
const ENABLE_MASTODON = process.env.ENABLE_MASTODON !== "false";
const ENABLE_REDDIT = process.env.ENABLE_REDDIT !== "false";
const ENABLE_GOOGLE_NEWS = process.env.ENABLE_GOOGLE_NEWS !== "false";

// Persistent dedup (L1 memory + L2 DB)
const dedup = new PersistentDedup(ENABLE_DB);

// Source health tracking
const health = new SourceHealthTracker();

// Daily cleanup interval for dedup cache
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

type SourceType = "bluesky" | "mastodon" | "reddit" | "google_news";
type Category = "social" | "news";

interface NormalizedPost {
  sourceType: SourceType;
  sourceId: string;
  text: string;
  authorHandle: string;
  authorDisplayName: string | null;
  createdAt: string;
  url: string;
  category: Category;
}

interface ProcessedPost {
  post: NormalizedPost;
  location: {
    city: string | null;
    state: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  activityType: ReturnType<typeof detectActivityType>;
  saved: boolean;
}

// Normalize posts from different sources
function normalizeBlueskyPost(post: BlueskyPost): NormalizedPost {
  return {
    sourceType: "bluesky",
    sourceId: post.uri,
    text: post.text,
    authorHandle: post.authorHandle,
    authorDisplayName: post.authorDisplayName,
    createdAt: post.createdAt,
    url: `https://bsky.app/profile/${post.authorHandle}/post/${post.uri.split("/").pop()}`,
    category: "social"
  };
}

function normalizeMastodonPost(post: MastodonPost): NormalizedPost {
  return {
    sourceType: "mastodon",
    sourceId: post.uri,
    text: post.plainText,
    authorHandle: `${post.authorHandle}@${post.instance}`,
    authorDisplayName: post.authorDisplayName,
    createdAt: post.createdAt,
    url: post.url,
    category: "social"
  };
}

function normalizeRedditPost(post: RedditPost): NormalizedPost {
  return {
    sourceType: "reddit",
    sourceId: post.uri,
    text: post.fullText,
    authorHandle: `u/${post.authorHandle}`,
    authorDisplayName: null,
    createdAt: post.createdAt,
    url: post.url,
    category: "social"
  };
}

function normalizeGoogleNewsArticle(article: GoogleNewsArticle): NormalizedPost {
  return {
    sourceType: "google_news",
    sourceId: article.guid,
    text: `${article.title}\n\n${article.description}`,
    authorHandle: article.source,
    authorDisplayName: article.source,
    createdAt: article.pubDate,
    url: article.link,
    category: "news"
  };
}

async function processPost(post: NormalizedPost, metadata?: Record<string, unknown>): Promise<ProcessedPost> {
  const extractedLocation = extractLocation(post.text);
  const activityType = detectActivityType(post.text);

  let city: string | null = null;
  let state: string | null = null;
  let latitude: number | null = null;
  let longitude: number | null = null;

  if (extractedLocation) {
    city = extractedLocation.city;
    state = extractedLocation.state;

    if (city && state) {
      const geocoded = await geocodeCityState(city, state);
      if (geocoded) {
        latitude = geocoded.latitude;
        longitude = geocoded.longitude;
        city = geocoded.city || city;
        state = geocoded.state || state;
      }
    } else if (city) {
      const geocoded = await geocode(`${city}, USA`);
      if (geocoded) {
        latitude = geocoded.latitude;
        longitude = geocoded.longitude;
        city = geocoded.city || city;
        state = geocoded.state || state;
      }
    }
  }

  let saved = false;
  if (ENABLE_DB && (latitude !== null || city !== null)) {
    try {
      const existing = await getReportBySourceId(post.sourceType, post.sourceId);
      if (!existing) {
        await createReport({
          sourceType: post.sourceType,
          sourceId: post.sourceId,
          activityType,
          description: post.text,
          city: city ?? undefined,
          state: state ?? undefined,
          latitude: latitude ?? undefined,
          longitude: longitude ?? undefined,
          authorHandle: post.authorHandle,
          authorDisplayName: post.authorDisplayName ?? undefined,
          metadata,
          reportedAt: new Date(post.createdAt)
        });
        saved = true;
      }
    } catch (error) {
      console.error(`[DB] Error saving ${post.sourceType} report:`, error);
    }
  }

  return {
    post,
    location: { city, state, latitude, longitude },
    activityType,
    saved
  };
}

function formatProcessedPost(processed: ProcessedPost): string {
  const { post, location, activityType, saved } = processed;
  const timestamp = new Date(post.createdAt).toLocaleString();
  const locationStr = location.city && location.state
    ? `${location.city}, ${location.state}`
    : location.city || location.state || "Unknown location";
  const coordsStr = location.latitude && location.longitude
    ? ` (${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)})`
    : "";
  const savedStr = saved ? " [SAVED]" : "";
  const sourceIcon = {
    bluesky: "🦋",
    mastodon: "🐘",
    reddit: "🔴",
    google_news: "📰"
  }[post.sourceType];

  return `
────────────────────────────────────────
${sourceIcon} [${post.sourceType.toUpperCase()}] [${activityType.toUpperCase()}] ${locationStr}${coordsStr}${savedStr}
Author: ${post.authorHandle} (${post.authorDisplayName || "No display name"})
Time: ${timestamp}
Text: ${post.text.substring(0, 280)}${post.text.length > 280 ? "..." : ""}
URL: ${post.url}
────────────────────────────────────────`;
}

async function pollSource(
  name: string,
  enabled: boolean,
  fetchFn: () => Promise<NormalizedPost[]>
): Promise<NormalizedPost[]> {
  if (!enabled) return [];

  if (health.shouldSkip(name)) {
    console.log(`[${name}] Skipped (backoff after repeated failures)`);
    return [];
  }

  console.log(`[${name}] Starting search...`);
  const start = Date.now();
  try {
    const posts = await fetchFn();
    health.recordSuccess(name, Date.now() - start);
    console.log(`[${name}] Found ${posts.length} posts`);
    return posts;
  } catch (error) {
    health.recordFailure(name);
    console.error(`[${name}] Search error:`, error);
    return [];
  }
}

async function pollAllSources(): Promise<void> {
  console.log(`\n[Poll] Starting multi-source search at ${new Date().toISOString()}`);

  // Fetch from all sources in parallel using Promise.allSettled for error isolation
  const results = await Promise.allSettled([
    pollSource("Bluesky", ENABLE_BLUESKY, async () =>
      (await searchAllKeywords()).map(normalizeBlueskyPost)
    ),
    pollSource("Mastodon", ENABLE_MASTODON, async () =>
      (await searchAllInstances()).map(normalizeMastodonPost)
    ),
    pollSource("Reddit", ENABLE_REDDIT, async () =>
      (await searchReddit()).map(normalizeRedditPost)
    ),
    pollSource("Google News", ENABLE_GOOGLE_NEWS, async () =>
      (await searchGoogleNews()).map(normalizeGoogleNewsArticle)
    ),
  ]);

  const allPosts = results.flatMap((r) =>
    r.status === "fulfilled" ? r.value : []
  );

  // Pipeline counters
  const totalFound = allPosts.length;
  let dedupSkipped = 0;
  let filteredOut = 0;
  let savedCount = 0;
  let needsReviewCount = 0;
  const sourceCounts: Record<SourceType, number> = { bluesky: 0, mastodon: 0, reddit: 0, google_news: 0 };

  for (const post of allPosts) {
    // Persistent dedup check
    if (await dedup.hasSeen(post.sourceType, post.sourceId)) {
      dedupSkipped++;
      continue;
    }
    dedup.markSeen(post.sourceType, post.sourceId);

    // Relevance filtering with confidence tiering
    let isRelevant = false;
    let filterReason = "";
    let needsReview = false;
    let confidence: string = "low";

    if (post.category === "news") {
      // News source reliability check
      const sourceTier = classifySource(post.authorHandle);
      if (sourceTier === "blocked") {
        filteredOut++;
        console.log(`[Skip] [${post.sourceType}] Blocked source: "${post.authorHandle}"`);
        continue;
      }
      const newsRelevance = checkNewsRelevance(post.text, "", post.authorHandle);
      isRelevant = newsRelevance.isRelevant;
      filterReason = newsRelevance.reason;
    } else {
      const socialRelevance = checkRelevance(post.text);
      confidence = socialRelevance.confidence;

      if (socialRelevance.isRelevant) {
        isRelevant = true;
      } else if (confidence === "low" && socialRelevance.score >= 2) {
        // Low confidence but some signal → process but flag
        isRelevant = true;
        needsReview = true;
      }
      filterReason = socialRelevance.reason;
    }

    if (!isRelevant) {
      filteredOut++;
      console.log(`[Skip] [${post.sourceType}] Filtered: "${post.text.substring(0, 60)}..." - ${filterReason}`);
      continue;
    }

    const metadata: Record<string, unknown> = {};
    if (needsReview) {
      metadata.needs_review = true;
      metadata.filter_confidence = confidence;
      needsReviewCount++;
    }

    const processed = await processPost(post, Object.keys(metadata).length > 0 ? metadata : undefined);
    console.log(formatProcessedPost(processed));

    if (processed.saved) {
      savedCount++;
      sourceCounts[post.sourceType]++;
    }
  }

  // Flush dedup batch inserts
  await dedup.flush();

  // Pipeline metrics summary
  const newPosts = totalFound - dedupSkipped;
  const sourceBreakdown = [
    ENABLE_BLUESKY && `B:${sourceCounts.bluesky}`,
    ENABLE_MASTODON && `M:${sourceCounts.mastodon}`,
    ENABLE_REDDIT && `R:${sourceCounts.reddit}`,
    ENABLE_GOOGLE_NEWS && `N:${sourceCounts.google_news}`,
  ].filter(Boolean).join(" ");

  const reviewStr = needsReviewCount > 0 ? ` (${needsReviewCount} needs_review)` : "";
  console.log(
    `[Metrics] Sources: ${sourceBreakdown} | Pipeline: ${totalFound} found → ${dedupSkipped} dedup → ${filteredOut} filtered → ${savedCount} saved${reviewStr} | Health: ${health.getSummary()}`
  );
}

async function main(): Promise<void> {
  const enabledSources = [
    ENABLE_BLUESKY && "Bluesky",
    ENABLE_MASTODON && "Mastodon",
    ENABLE_REDDIT && "Reddit",
    ENABLE_GOOGLE_NEWS && "Google News"
  ].filter(Boolean).join(", ") || "None";

  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║   ICE Activity Map - Multi-Source Ingestion      ║");
  console.log("╠══════════════════════════════════════════════════╣");
  console.log(`║  Poll interval: ${String(POLL_INTERVAL_MS / 1000).padEnd(6)}seconds               ║`);
  console.log(`║  Database: ${ENABLE_DB ? "enabled " : "disabled"}                         ║`);
  console.log(`║  Sources: ${enabledSources.padEnd(38)}║`);

  if (ENABLE_DB) {
    const dbConnected = await testConnection();
    console.log(`║  DB connection: ${dbConnected ? "OK     " : "FAILED "}                      ║`);
    if (!dbConnected) {
      console.log("║  ⚠ Running without database persistence          ║");
    }
  }

  console.log("╚══════════════════════════════════════════════════╝");
  console.log("");

  // Initial poll
  await pollAllSources();

  // Set up recurring polling
  setInterval(pollAllSources, POLL_INTERVAL_MS);

  // Daily dedup cache cleanup
  setInterval(async () => {
    const cleaned = await dedup.cleanup();
    if (cleaned > 0) {
      console.log(`[Dedup] Cleaned up ${cleaned} expired cache entries`);
    }
  }, CLEANUP_INTERVAL_MS);

  console.log(`\n[Service] Polling every ${POLL_INTERVAL_MS / 1000} seconds...`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
