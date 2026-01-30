// Reddit API client for searching public posts

export interface RedditPost {
  id: string;
  uri: string;
  url: string;
  title: string;
  selftext: string;
  fullText: string;
  createdAt: string;
  authorHandle: string;
  subreddit: string;
  score: number;
  numComments: number;
}

interface RedditListing {
  kind: string;
  data: {
    children: Array<{
      kind: string;
      data: {
        id: string;
        name: string;
        title: string;
        selftext: string;
        author: string;
        subreddit: string;
        subreddit_name_prefixed: string;
        permalink: string;
        url: string;
        created_utc: number;
        score: number;
        num_comments: number;
        is_self: boolean;
      };
    }>;
  };
}

// Subreddits that might have ICE-related reports
const SUBREDDITS = [
  'immigration',
  'LosAngeles',
  'sanfrancisco',
  'chicago',
  'nyc',
  'houston',
  'Miami',
  'phoenix',
  'denver',
  'seattle',
  'sandiego',
  'news',
  'localNews'
];

const SEARCH_KEYWORDS = [
  'ICE raid',
  'ICE checkpoint',
  'immigration enforcement',
  'ICE agents',
  'deportation'
];

function listingToPost(item: RedditListing['data']['children'][0]['data']): RedditPost {
  const fullText = item.title + (item.selftext ? '\n\n' + item.selftext : '');

  return {
    id: item.id,
    uri: `reddit:${item.name}`,
    url: `https://reddit.com${item.permalink}`,
    title: item.title,
    selftext: item.selftext || '',
    fullText,
    createdAt: new Date(item.created_utc * 1000).toISOString(),
    authorHandle: item.author,
    subreddit: item.subreddit,
    score: item.score,
    numComments: item.num_comments
  };
}

async function searchSubreddit(subreddit: string, keyword: string): Promise<RedditPost[]> {
  const posts: RedditPost[] = [];

  try {
    const url = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(keyword)}&restrict_sr=1&sort=new&limit=25&t=week`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'ICE-Activity-Map/1.0 (Educational project)'
      }
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.warn(`[Reddit] Rate limited on r/${subreddit}`);
      } else {
        console.warn(`[Reddit] r/${subreddit} search failed: ${response.status}`);
      }
      return posts;
    }

    const data = await response.json() as RedditListing;

    for (const child of data.data.children) {
      if (child.kind === 't3') {
        posts.push(listingToPost(child.data));
      }
    }
  } catch (error) {
    console.warn(`[Reddit] Error searching r/${subreddit}:`, (error as Error).message);
  }

  return posts;
}

async function searchAll(keyword: string): Promise<RedditPost[]> {
  const posts: RedditPost[] = [];

  try {
    const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(keyword)}&sort=new&limit=50&t=week`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'ICE-Activity-Map/1.0 (Educational project)'
      }
    });

    if (!response.ok) {
      console.warn(`[Reddit] Global search failed: ${response.status}`);
      return posts;
    }

    const data = await response.json() as RedditListing;

    for (const child of data.data.children) {
      if (child.kind === 't3') {
        posts.push(listingToPost(child.data));
      }
    }
  } catch (error) {
    console.warn(`[Reddit] Error in global search:`, (error as Error).message);
  }

  return posts;
}

export async function searchReddit(): Promise<RedditPost[]> {
  const allPosts: RedditPost[] = [];
  const seenIds = new Set<string>();

  // First, do a global search for each keyword
  for (const keyword of SEARCH_KEYWORDS) {
    const posts = await searchAll(keyword);

    for (const post of posts) {
      if (!seenIds.has(post.id)) {
        seenIds.add(post.id);
        allPosts.push(post);
      }
    }

    // Respectful delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Then search specific subreddits for ICE-related content
  for (const subreddit of SUBREDDITS) {
    for (const keyword of ['ICE raid', 'ICE checkpoint']) {
      const posts = await searchSubreddit(subreddit, keyword);

      for (const post of posts) {
        if (!seenIds.has(post.id)) {
          seenIds.add(post.id);
          allPosts.push(post);
        }
      }

      // Respectful delay
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Sort by creation time, newest first
  allPosts.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return allPosts;
}

export function formatPostForLog(post: RedditPost): string {
  const timestamp = new Date(post.createdAt).toLocaleString();
  return `
[Reddit] r/${post.subreddit} by u/${post.authorHandle} at ${timestamp}
Title: ${post.title}
${post.selftext ? post.selftext.substring(0, 200) + (post.selftext.length > 200 ? '...' : '') : '(link post)'}
Score: ${post.score} | Comments: ${post.numComments}
URL: ${post.url}`;
}
