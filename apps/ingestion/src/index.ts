import "dotenv/config";
import { searchAllKeywords, formatPostForLog, type BlueskyPost } from "./bluesky/search.js";
import { extractLocation, detectActivityType } from "./location/extractor.js";
import { geocode, geocodeCityState } from "./geocoding/nominatim.js";
import { createReport, getReportBySourceId, testConnection } from "@ice-activity-map/database";

const POLL_INTERVAL_MS = parseInt(
  process.env.POLL_INTERVAL_MS || "60000",
  10
);

const ENABLE_DB = process.env.ENABLE_DB !== "false";

const seenPostUris = new Set<string>();

interface ProcessedPost {
  post: BlueskyPost;
  location: {
    city: string | null;
    state: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  activityType: ReturnType<typeof detectActivityType>;
  saved: boolean;
}

async function processPost(post: BlueskyPost): Promise<ProcessedPost> {
  // Extract location from text
  const extractedLocation = extractLocation(post.text);
  const activityType = detectActivityType(post.text);

  let city: string | null = null;
  let state: string | null = null;
  let latitude: number | null = null;
  let longitude: number | null = null;

  if (extractedLocation) {
    city = extractedLocation.city;
    state = extractedLocation.state;

    // Geocode if we have location info
    if (city && state) {
      const geocoded = await geocodeCityState(city, state);
      if (geocoded) {
        latitude = geocoded.latitude;
        longitude = geocoded.longitude;
        // Update city/state if geocoding returned more accurate info
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

  // Save to database if enabled
  let saved = false;
  if (ENABLE_DB && (latitude !== null || city !== null)) {
    try {
      // Check if already exists
      const existing = await getReportBySourceId("bluesky", post.uri);
      if (!existing) {
        await createReport({
          sourceType: "bluesky",
          sourceId: post.uri,
          activityType,
          description: post.text,
          city: city ?? undefined,
          state: state ?? undefined,
          latitude: latitude ?? undefined,
          longitude: longitude ?? undefined,
          authorHandle: post.authorHandle,
          authorDisplayName: post.authorDisplayName,
          reportedAt: new Date(post.createdAt)
        });
        saved = true;
      }
    } catch (error) {
      console.error("[DB] Error saving report:", error);
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

  return `
────────────────────────────────────────
[${activityType.toUpperCase()}] ${locationStr}${coordsStr}${savedStr}
Author: @${post.authorHandle} (${post.authorDisplayName || "No display name"})
Time: ${timestamp}
Text: ${post.text.substring(0, 280)}${post.text.length > 280 ? "..." : ""}
────────────────────────────────────────`;
}

async function pollForPosts(): Promise<void> {
  console.log(`\n[Poll] Starting search at ${new Date().toISOString()}`);

  try {
    const posts = await searchAllKeywords();
    let newPostCount = 0;
    let savedCount = 0;

    for (const post of posts) {
      if (!seenPostUris.has(post.uri)) {
        seenPostUris.add(post.uri);
        newPostCount++;

        const processed = await processPost(post);
        console.log(formatProcessedPost(processed));

        if (processed.saved) {
          savedCount++;
        }
      }
    }

    if (newPostCount === 0) {
      console.log("[Poll] No new posts found");
    } else {
      console.log(`[Poll] Found ${newPostCount} new post(s), saved ${savedCount} to database`);
    }
  } catch (error) {
    console.error("[Poll] Error during search:", error);
  }
}

async function main(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║   ICE Activity Map - Bluesky Ingestion Service   ║");
  console.log("╠══════════════════════════════════════════════════╣");
  console.log(`║  Poll interval: ${String(POLL_INTERVAL_MS / 1000).padEnd(6)}seconds               ║`);
  console.log(`║  Database: ${ENABLE_DB ? "enabled " : "disabled"}                         ║`);

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
  await pollForPosts();

  // Set up recurring polling
  setInterval(pollForPosts, POLL_INTERVAL_MS);

  console.log(`\n[Service] Polling every ${POLL_INTERVAL_MS / 1000} seconds...`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
