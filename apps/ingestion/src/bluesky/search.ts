import { getAgent, withRetry, ensureAuthenticated } from "./client.js";

export const SEARCH_KEYWORDS = [
  // English
  "ICE raid",
  "immigration raid",
  "border patrol",
  "ICE checkpoint",
  "immigration checkpoint",
  "ICE agents",
  "immigration enforcement",
  "deportation raid",
  // Spanish
  "redada",
  "la migra",
  "operativo migratorio",
  "retén migración",
  "agentes de inmigración",
];

export interface BlueskyPost {
  uri: string;
  cid: string;
  text: string;
  authorHandle: string;
  authorDisplayName: string;
  createdAt: string;
  indexedAt: string;
}

export interface SearchResult {
  posts: BlueskyPost[];
  cursor?: string;
}

export async function searchPosts(
  query: string,
  cursor?: string,
  limit: number = 25
): Promise<SearchResult> {
  await ensureAuthenticated();
  const agent = getAgent();

  const response = await withRetry(async () => {
    const result = await agent.app.bsky.feed.searchPosts({
      q: query,
      limit,
      cursor,
      sort: "latest",
    });
    return result;
  });

  const posts: BlueskyPost[] = response.data.posts.map((post) => ({
    uri: post.uri,
    cid: post.cid,
    text: (post.record as { text?: string }).text || "",
    authorHandle: post.author.handle,
    authorDisplayName: post.author.displayName || post.author.handle,
    createdAt: (post.record as { createdAt?: string }).createdAt || "",
    indexedAt: post.indexedAt,
  }));

  return {
    posts,
    cursor: response.data.cursor,
  };
}

export async function searchAllKeywords(): Promise<BlueskyPost[]> {
  const seenUris = new Set<string>();
  const allPosts: BlueskyPost[] = [];

  for (const keyword of SEARCH_KEYWORDS) {
    try {
      console.log(`[Search] Searching for: "${keyword}"`);
      const result = await searchPosts(keyword);

      for (const post of result.posts) {
        if (!seenUris.has(post.uri)) {
          seenUris.add(post.uri);
          allPosts.push(post);
        }
      }

      // Small delay between searches to be respectful of rate limits
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`[Search] Failed to search for "${keyword}":`, error);
    }
  }

  // Sort by creation time, newest first
  allPosts.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return allPosts;
}

export function formatPostForLog(post: BlueskyPost): string {
  const timestamp = new Date(post.createdAt).toLocaleString();
  const truncatedText =
    post.text.length > 200 ? post.text.slice(0, 200) + "..." : post.text;
  const cleanText = truncatedText.replace(/\n/g, " ");

  return [
    `----------------------------------------`,
    `Author: @${post.authorHandle} (${post.authorDisplayName})`,
    `Time: ${timestamp}`,
    `Text: ${cleanText}`,
    `URI: ${post.uri}`,
  ].join("\n");
}
