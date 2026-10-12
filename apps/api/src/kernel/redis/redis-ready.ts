import { isDatabaseReady } from "../db/index.js";
import type { Readiness } from "../http/index.js";
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

/**
 * The API role's /ready check: only the platform database decides. Redis is an accelerator here
 * (ADR-088: the permission cache and the rate limits degrade without it), so an outage is reported
 * as `redis: "degraded"` and the instance stays in the load balancer (review M11).
 */
export function createApiReadinessCheck(client: RedisClient): () => Promise<Readiness> {
  return async () => {
    const [isDatabaseUp, isRedisUp] = await Promise.all([isDatabaseReady(), isRedisReady(client)]);
    return { isReady: isDatabaseUp, details: { redis: isRedisUp ? "ok" : "degraded" } };
  };
}
