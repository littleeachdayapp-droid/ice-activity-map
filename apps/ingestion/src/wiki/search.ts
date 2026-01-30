import { createHash } from "crypto";

const WIKI_RAW_URL =
  "https://wiki.icelist.is/index.php?title=ICE_List:News&action=raw";

const MAX_AGE_DAYS = parseInt(process.env.WIKI_MAX_AGE_DAYS || "7", 10);

export interface WikiArticle {
  id: string;
  title: string;
  url: string;
  date: string;
  state: string;
  description: string;
}

/**
 * Parse MediaWiki markup into WikiArticle entries.
 * Entries look like:
 *   * **YYYY-MM-DD:** [[Article Title](URL)] — CITY, STATE — Description
 * Under headings like: ### Alabama
 */
const ENTRY_RE =
  /\*\s*\*\*(\d{4}-\d{2}-\d{2}):\*\*\s*\[\[([^\]|]+)\|?[^\]]*\]\]\s*[—–-]\s*(.*)/;

const HEADING_RE = /^###\s+(.+)/;

export function parseWikiMarkup(raw: string): WikiArticle[] {
  const lines = raw.split("\n");
  let currentState = "Unknown";
  const seen = new Set<string>();
  const articles: WikiArticle[] = [];

  for (const line of lines) {
    const headingMatch = line.match(HEADING_RE);
    if (headingMatch) {
      currentState = headingMatch[1].trim();
      continue;
    }

    const entryMatch = line.match(ENTRY_RE);
    if (!entryMatch) continue;

    const [, date, titleOrUrl, rest] = entryMatch;

    // The [[...]] may contain a URL or a title; extract URL from the match
    let url = "";
    let title = "";
    const urlMatch = titleOrUrl.match(/https?:\/\/\S+/);
    if (urlMatch) {
      url = urlMatch[0];
      title = rest.split(/[—–-]/)[0]?.trim() || url;
    } else {
      // Title is in the bracket, URL might be in the rest
      title = titleOrUrl.trim();
      const restUrlMatch = rest.match(/https?:\/\/\S+/);
      url = restUrlMatch ? restUrlMatch[0] : "";
    }

    // Also try extracting URL from markdown link syntax [text](url)
    if (!url) {
      const mdLink = line.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/);
      if (mdLink) {
        title = title || mdLink[1];
        url = mdLink[2];
      }
    }

    if (!url) continue;

    // Dedup by URL within single fetch
    if (seen.has(url)) continue;
    seen.add(url);

    const description = rest.trim();
    const id = generateId(date, url);

    articles.push({ id, title, url, date, state: currentState, description });
  }

  return articles;
}

function generateId(date: string, url: string): string {
  const hash = createHash("sha256").update(url).digest("hex").slice(0, 12);
  return `wiki-${date}-${hash}`;
}

function isWithinMaxAge(dateStr: string, maxDays: number): boolean {
  const entryDate = new Date(dateStr + "T00:00:00Z");
  const now = new Date();
  const diffMs = now.getTime() - entryDate.getTime();
  return diffMs <= maxDays * 24 * 60 * 60 * 1000 && diffMs >= 0;
}

/**
 * Fetch and parse ICE List wiki news entries, filtered to recent items.
 */
export async function searchWiki(): Promise<WikiArticle[]> {
  const response = await fetch(WIKI_RAW_URL, {
    headers: { "User-Agent": "ICEActivityMap/1.0" },
  });

  if (!response.ok) {
    throw new Error(`Wiki fetch failed: HTTP ${response.status}`);
  }

  const raw = await response.text();
  const articles = parseWikiMarkup(raw);

  return articles.filter((a) => isWithinMaxAge(a.date, MAX_AGE_DAYS));
}
