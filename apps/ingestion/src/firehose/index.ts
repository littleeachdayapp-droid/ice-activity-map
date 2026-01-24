import "dotenv/config";
import { FirehoseClient, type FirehosePost } from "./client.js";
import { extractLocation, detectActivityType } from "../location/extractor.js";
import { geocode, geocodeCityState } from "../geocoding/nominatim.js";
import { createReport, getReportBySourceId, testConnection } from "@ice-activity-map/database";

const ENABLE_DB = process.env.ENABLE_DB !== "false";

const seenPostUris = new Set<string>();

async function processFirehosePost(post: FirehosePost): Promise<void> {
  // Deduplicate
  if (seenPostUris.has(post.uri)) {
    return;
  }
  seenPostUris.add(post.uri);

  // Limit seen set size
  if (seenPostUris.size > 10000) {
    const iterator = seenPostUris.values();
    for (let i = 0; i < 1000; i++) {
      const next = iterator.next();
      if (next.done) break;
      seenPostUris.delete(next.value);
    }
  }

  console.log(`\n[Firehose] New matching post from ${post.authorDid}`);
  console.log(`  Text: ${post.text.substring(0, 200)}${post.text.length > 200 ? "..." : ""}`);

  // Extract location and activity type
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

  const locationStr = city && state
    ? `${city}, ${state}`
    : city || state || "Unknown location";

  console.log(`  Activity: ${activityType.toUpperCase()}`);
  console.log(`  Location: ${locationStr}`);

  // Save to database
  if (ENABLE_DB && (latitude !== null || city !== null)) {
    try {
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
          authorHandle: post.authorDid,
          authorDisplayName: undefined,
          reportedAt: new Date(post.createdAt)
        });
        console.log(`  [SAVED to database]`);
      }
    } catch (error) {
      console.error("  [DB Error]:", error);
    }
  }
}

async function main(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║   ICE Activity Map - Firehose Ingestion Mode     ║");
  console.log("╠══════════════════════════════════════════════════╣");
  console.log(`║  Mode: Real-time firehose                        ║`);
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
  console.log("[Firehose] Starting real-time monitoring...");
  console.log("[Firehose] Filtering for ICE/immigration keywords");
  console.log("");

  const client = new FirehoseClient({
    onPost: processFirehosePost,
    onConnect: () => {
      console.log("[Firehose] ✓ Connected and listening for posts");
    },
    onDisconnect: () => {
      console.log("[Firehose] ✗ Disconnected, will reconnect...");
    },
    onError: (error) => {
      console.error("[Firehose] Error:", error.message);
    }
  });

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n[Firehose] Shutting down...");
    client.disconnect();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.log("\n[Firehose] Shutting down...");
    client.disconnect();
    process.exit(0);
  });

  await client.connect();
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
