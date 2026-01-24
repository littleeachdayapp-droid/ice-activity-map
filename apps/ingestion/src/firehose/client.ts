import { cborDecodeMulti } from '@atproto/common';
import { SEARCH_KEYWORDS } from '../bluesky/search.js';

export interface FirehosePost {
  uri: string;
  cid: string;
  text: string;
  authorDid: string;
  createdAt: string;
}

export interface FirehoseOptions {
  service?: string;
  onPost: (post: FirehosePost) => Promise<void>;
  onError?: (error: Error) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

const FIREHOSE_SERVICE = 'wss://bsky.network';

/**
 * Simple firehose client that filters for posts matching our keywords
 * Note: This is a simplified implementation. For production, consider using
 * the @atproto/sync package or a dedicated firehose consumer library.
 */
export class FirehoseClient {
  private ws: WebSocket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private shouldReconnect = true;
  private options: FirehoseOptions;
  private keywordPatterns: RegExp[];

  constructor(options: FirehoseOptions) {
    this.options = options;
    // Pre-compile keyword patterns for efficient matching
    this.keywordPatterns = SEARCH_KEYWORDS.map((kw: string) => new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  }

  /**
   * Check if text matches any of our keywords
   */
  private matchesKeywords(text: string): boolean {
    return this.keywordPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Connect to the firehose
   */
  async connect(): Promise<void> {
    if (this.ws) {
      return;
    }

    const url = `${this.options.service || FIREHOSE_SERVICE}/xrpc/com.atproto.sync.subscribeRepos`;

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('[Firehose] Connected to', url);
        this.options.onConnect?.();
      };

      this.ws.onmessage = async (event) => {
        try {
          await this.handleMessage(event.data);
        } catch (error) {
          console.error('[Firehose] Error handling message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[Firehose] WebSocket error:', error);
        this.options.onError?.(new Error('WebSocket error'));
      };

      this.ws.onclose = () => {
        console.log('[Firehose] Disconnected');
        this.ws = null;
        this.options.onDisconnect?.();

        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }
      };
    } catch (error) {
      console.error('[Firehose] Failed to connect:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Handle incoming firehose message
   */
  private async handleMessage(data: ArrayBuffer | Blob): Promise<void> {
    let buffer: ArrayBuffer;

    if (data instanceof Blob) {
      buffer = await data.arrayBuffer();
    } else {
      buffer = data;
    }

    const uint8 = new Uint8Array(buffer);

    try {
      // Decode CBOR message (header + body)
      const decoded = cborDecodeMulti(uint8) as [{ op: number; t: string }, unknown];

      if (!decoded || decoded.length < 2) {
        return;
      }

      const [header, body] = decoded;

      // We only care about commit messages
      if (header.t !== '#commit' || !body || typeof body !== 'object') {
        return;
      }

      const commit = body as {
        repo: string;
        ops: Array<{ action: string; path: string; cid?: unknown }>;
        blocks?: Uint8Array;
      };

      // Filter for post creates
      for (const op of commit.ops || []) {
        if (op.action === 'create' && op.path.startsWith('app.bsky.feed.post/')) {
          // Extract record from blocks (simplified - real impl needs CAR parsing)
          // For now, we'll use a simplified approach
          if (commit.blocks) {
            await this.processPostOp(commit.repo, op.path, commit.blocks);
          }
        }
      }
    } catch {
      // Silently ignore decode errors - many messages won't be posts
    }
  }

  /**
   * Process a post operation
   */
  private async processPostOp(repo: string, path: string, blocks: Uint8Array): Promise<void> {
    try {
      // Try to extract text from blocks (simplified approach)
      const text = this.extractTextFromBlocks(blocks);

      if (text && this.matchesKeywords(text)) {
        const rkey = path.split('/')[1];
        const uri = `at://${repo}/${path}`;

        const post: FirehosePost = {
          uri,
          cid: rkey,
          text,
          authorDid: repo,
          createdAt: new Date().toISOString()
        };

        await this.options.onPost(post);
      }
    } catch {
      // Ignore extraction errors
    }
  }

  /**
   * Simple text extraction from CBOR blocks
   * This is a simplified approach - production should use proper CAR parsing
   */
  private extractTextFromBlocks(blocks: Uint8Array): string | null {
    // Look for text field in the binary data
    // The "text" key in CBOR would be followed by the actual text
    const str = new TextDecoder().decode(blocks);

    // Simple heuristic: find quoted strings that look like post content
    const textMatch = str.match(/"text"\s*:\s*"([^"]+)"/);
    if (textMatch) {
      return textMatch[1];
    }

    // Alternative: look for text after "text" marker in CBOR
    const textIndex = str.indexOf('text');
    if (textIndex !== -1) {
      // Extract following content (simplified)
      const following = str.slice(textIndex + 4, textIndex + 1000);
      // Look for readable content
      const readable = following.match(/[\x20-\x7E\u00A0-\uFFFF]{10,500}/);
      if (readable) {
        return readable[0];
      }
    }

    return null;
  }

  /**
   * Schedule reconnection
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      return;
    }

    const delay = 5000 + Math.random() * 5000; // 5-10 seconds
    console.log(`[Firehose] Reconnecting in ${Math.round(delay / 1000)}s...`);

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, delay);
  }

  /**
   * Disconnect from the firehose
   */
  disconnect(): void {
    this.shouldReconnect = false;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
