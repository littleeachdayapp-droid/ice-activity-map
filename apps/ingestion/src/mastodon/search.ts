// Mastodon API client for searching public posts

export interface MastodonPost {
  id: string;
  uri: string;
  url: string;
  content: string;
  plainText: string;
  createdAt: string;
  authorHandle: string;
  authorDisplayName: string;
  instance: string;
}

interface MastodonStatus {
  id: string;
  uri: string;
  url: string;
  content: string;
  created_at: string;
  account: {
    acct: string;
    display_name: string;
    username: string;
    url: string;
  };
}

interface SearchResponse {
  statuses: MastodonStatus[];
}

// Popular Mastodon instances with active communities
const MASTODON_INSTANCES = [
  'mastodon.social',
  'mstdn.social',
  'mas.to',
  'mastodon.online',
  'techhub.social'
];

const SEARCH_KEYWORDS = [
  'ICE raid',
  'ICE checkpoint',
  'ICE arrest',
  'immigration enforcement',
  'ICE agents',
  'immigration raid',
  'deportation raid'
];

// Remove HTML tags from content
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p>/gi, '')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n+/g, ' ')
    .trim();
}

function extractInstance(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return 'unknown';
  }
}

function statusToPost(status: MastodonStatus): MastodonPost {
  return {
    id: status.id,
    uri: status.uri,
    url: status.url,
    content: status.content,
    plainText: stripHtml(status.content),
    createdAt: status.created_at,
    authorHandle: status.account.acct,
    authorDisplayName: status.account.display_name || status.account.username,
    instance: extractInstance(status.account.url)
  };
}

async function searchInstance(instance: string, keyword: string): Promise<MastodonPost[]> {
  const posts: MastodonPost[] = [];

  try {
    const url = `https://${instance}/api/v2/search?q=${encodeURIComponent(keyword)}&type=statuses&limit=20`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'ICE-Activity-Map/1.0'
      }
    });

    if (!response.ok) {
      console.warn(`[Mastodon] ${instance} search failed: ${response.status}`);
      return posts;
    }

    const data = await response.json() as SearchResponse;

    for (const status of data.statuses) {
      posts.push(statusToPost(status));
    }
  } catch (error) {
    console.warn(`[Mastodon] Error searching ${instance}:`, (error as Error).message);
  }

  return posts;
}

export async function searchAllInstances(): Promise<MastodonPost[]> {
  const allPosts: MastodonPost[] = [];
  const seenUris = new Set<string>();

  // Search each instance with each keyword
  for (const instance of MASTODON_INSTANCES) {
    for (const keyword of SEARCH_KEYWORDS) {
      const posts = await searchInstance(instance, keyword);

      for (const post of posts) {
        if (!seenUris.has(post.uri)) {
          seenUris.add(post.uri);
          allPosts.push(post);
        }
      }

      // Small delay between requests to be respectful
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Sort by creation time, newest first
  allPosts.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return allPosts;
}

export function formatPostForLog(post: MastodonPost): string {
  const timestamp = new Date(post.createdAt).toLocaleString();
  return `
[Mastodon] @${post.authorHandle}@${post.instance} at ${timestamp}
${post.plainText.substring(0, 280)}${post.plainText.length > 280 ? '...' : ''}
URL: ${post.url}`;
}
