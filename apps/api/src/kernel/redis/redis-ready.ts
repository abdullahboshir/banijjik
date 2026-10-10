import { isDatabaseReady } from "../db/index.js";
import { withTimeout } from "../time/index.js";
import type { RedisClient } from "./redis-client.js";

const DEFAULT_PING_TIMEOUT_MS = 2000;

async function ping(client: RedisClient): Promise<boolean> {
  return (await client.ping()) === "PONG";
}

/** True when Redis answers PING in time. Any failure, including no connection, is false. */
export async function isRedisReady(
  client: RedisClient,
  timeoutMs = DEFAULT_PING_TIMEOUT_MS,
): Promise<boolean> {
  try {
    return await withTimeout(ping(client), timeoutMs, () => new Error("redis ping timed out"));
  } catch {
    // Not-ready is the answer here; the ready handler logs the outcome.
    return false;
  }
}

/** The API's /ready check: the platform database and Redis must both answer. */
export function createApiReadinessCheck(client: RedisClient): () => Promise<boolean> {
  return async () => {
    const [isDatabaseUp, isRedisUp] = await Promise.all([isDatabaseReady(), isRedisReady(client)]);
    return isDatabaseUp && isRedisUp;
  };
}
