import { AtpAgent } from "@atproto/api";

const BLUESKY_SERVICE = "https://bsky.social";

let agent: AtpAgent | null = null;
let isAuthenticated = false;

export function getAgent(): AtpAgent {
  if (!agent) {
    agent = new AtpAgent({ service: BLUESKY_SERVICE });
  }
  return agent;
}

export async function ensureAuthenticated(): Promise<void> {
  if (isAuthenticated) return;

  const identifier = process.env.BLUESKY_IDENTIFIER;
  const password = process.env.BLUESKY_PASSWORD;

  if (!identifier || !password) {
    throw new Error(
      "Bluesky authentication required. Set BLUESKY_IDENTIFIER and BLUESKY_PASSWORD in .env"
    );
  }

  const agent = getAgent();
  console.log(`[Auth] Logging in as ${identifier}...`);

  await agent.login({ identifier, password });
  isAuthenticated = true;
  console.log("[Auth] Successfully authenticated with Bluesky");
}

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 5,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries, baseDelayMs, maxDelayMs } = {
    ...DEFAULT_RETRY_OPTIONS,
    ...options,
  };

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxRetries) {
        break;
      }

      const isRateLimit =
        lastError.message.includes("429") ||
        lastError.message.toLowerCase().includes("rate limit");

      const delay = Math.min(
        baseDelayMs * Math.pow(2, attempt) * (isRateLimit ? 2 : 1),
        maxDelayMs
      );

      const jitter = Math.random() * 0.3 * delay;
      const totalDelay = Math.round(delay + jitter);

      console.log(
        `[Retry] Attempt ${attempt + 1}/${maxRetries} failed: ${lastError.message}. Retrying in ${totalDelay}ms...`
      );

      await sleep(totalDelay);
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
