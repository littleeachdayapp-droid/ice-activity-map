import { XMLParser } from "fast-xml-parser";

export const NEWS_KEYWORDS = [
  // ICE-specific
  "ICE raid",
  "ICE arrests",
  "ICE detention",
  "ICE operation",
  "ICE enforcement",
  "ICE agents",
  "ICE sweep",
  "ICE apprehension",
  // Immigration enforcement
  "immigration raid",
  "immigration enforcement",
  "immigration sweep",
  "deportation raid",
  "workplace raid immigration",
  // CBP/Border Patrol
  "CBP checkpoint",
  "border patrol checkpoint",
  "immigration checkpoint",
  // Location-specific high-activity areas
  "ICE California",
  "ICE Texas",
  "ICE Florida",
  "ICE New York",
  "ICE Chicago",
];

export interface GoogleNewsArticle {
  guid: string;
  title: string;
  link: string;
  pubDate: string;
  source: string;
  description: string;
}

interface RssItem {
  guid: string | { "#text": string };
  title: string;
  link: string;
  pubDate: string;
  source?: string | { "#text": string };
  description?: string;
}

interface RssResponse {
  rss?: {
    channel?: {
      item?: RssItem | RssItem[];
    };
  };
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
});

/**
 * Build Google News RSS URL for a search query
 */
function buildRssUrl(query: string): string {
  const encodedQuery = encodeURIComponent(query);
  return `https://news.google.com/rss/search?q=${encodedQuery}&hl=en-US&gl=US&ceid=US:en`;
}

/**
 * Extract source name from title (format: "Article Title - Source Name")
 */
function extractSource(title: string): string {
  const parts = title.split(" - ");
  if (parts.length > 1) {
    return parts[parts.length - 1].trim();
  }
  return "Unknown";
}

/**
 * Extract clean title without source suffix
 */
function extractCleanTitle(title: string): string {
  const parts = title.split(" - ");
  if (parts.length > 1) {
    return parts.slice(0, -1).join(" - ").trim();
  }
  return title;
}

/**
 * Check if article is within the last 72 hours
 * ICE tends to stay in one area for a while, so older data is still relevant
 */
function isWithin72Hours(pubDate: string): boolean {
  const articleDate = new Date(pubDate);
  const now = new Date();
  const hoursDiff = (now.getTime() - articleDate.getTime()) / (1000 * 60 * 60);
  return hoursDiff <= 72;
}

/**
 * Fetch and parse Google News RSS for a single query
 */
async function fetchRss(query: string): Promise<GoogleNewsArticle[]> {
  const url = buildRssUrl(query);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "ICEActivityMap/1.0",
      },
    });

    if (!response.ok) {
      console.error(`[Google News] HTTP ${response.status} for query: ${query}`);
      return [];
    }

    const xml = await response.text();
    const parsed: RssResponse = parser.parse(xml);

    const items = parsed?.rss?.channel?.item;
    if (!items) {
      return [];
    }

    // Handle single item vs array
    const itemArray = Array.isArray(items) ? items : [items];

    return itemArray
      .filter((item) => isWithin72Hours(item.pubDate))
      .map((item) => {
        // Handle guid which can be string or object
        const guid = typeof item.guid === "string" ? item.guid : item.guid?.["#text"] || item.link;
        // Handle source which can be string or object
        const source = typeof item.source === "string"
          ? item.source
          : item.source?.["#text"] || extractSource(item.title);

        return {
          guid,
          title: extractCleanTitle(item.title),
          link: item.link,
          pubDate: item.pubDate,
          source,
          description: item.description || "",
        };
      });
  } catch (error) {
    console.error(`[Google News] Fetch error for query "${query}":`, error);
    return [];
  }
}

/**
 * Search Google News RSS for all configured keywords
 * Deduplicates by guid and returns sorted by date (newest first)
 */
export async function searchGoogleNews(): Promise<GoogleNewsArticle[]> {
  const seenGuids = new Set<string>();
  const allArticles: GoogleNewsArticle[] = [];

  for (const keyword of NEWS_KEYWORDS) {
    try {
      console.log(`[Google News] Searching for: "${keyword}"`);
      const articles = await fetchRss(keyword);

      for (const article of articles) {
        if (!seenGuids.has(article.guid)) {
          seenGuids.add(article.guid);
          allArticles.push(article);
        }
      }

      // Delay between queries to be respectful
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`[Google News] Failed to search for "${keyword}":`, error);
    }
  }

  // Sort by publication date, newest first
  allArticles.sort(
    (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
  );

  return allArticles;
}
