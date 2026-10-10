import { Redis } from "ioredis";
import { getLogger } from "../logger/index.js";
import type { ShutdownTask } from "../lifecycle/shutdown.js";

export type RedisClient = Redis;

const CACHE_COMMAND_TIMEOUT_MS = 500;

/** Only the error class and code are logged: a client message can contain the connection URL. */
function logConnectionProblem(error: unknown): void {
  const errorName = error instanceof Error ? error.name : "UnknownError";
  // Safe: only the optional client `code` is read, and optional chaining covers null.
  const errorCode = (error as { code?: unknown } | null)?.code;
  getLogger().warn({ event: "redis.unavailable", errorName, errorCode }, "redis unavailable");
}

/** One line when Redis goes away and one when it returns, instead of one per reconnect attempt. */
function watchConnection(client: RedisClient): RedisClient {
  let isDown = false;
  client.on("error", (error: unknown) => {
    if (isDown) return;
    isDown = true;
    logConnectionProblem(error);
  });
  client.on("ready", () => {
    if (!isDown) return;
    isDown = false;
    getLogger().info({ event: "redis.recovered" }, "redis connection recovered");
  });
  return client;
}

/**
 * The client BullMQ uses (worker role). It waits for Redis forever instead of failing a command,
 * which BullMQ requires (`maxRetriesPerRequest: null`).
 */
export function createQueueRedisClient(url: string): RedisClient {
  return watchConnection(new Redis(url, { maxRetriesPerRequest: null }));
}

/**
 * The client of the permission cache (API role). A command fails at once while Redis is away and
 * after a short timeout while it is slow, so a Redis outage costs a database lookup, not a hang.
 */
export function createCacheRedisClient(url: string): RedisClient {
  return watchConnection(
    new Redis(url, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      commandTimeout: CACHE_COMMAND_TIMEOUT_MS,
    }),
  );
}

/** `quit` lets pending commands finish; a client that is not connected has nothing to wait for. */
export function createCloseRedisTask(client: RedisClient): ShutdownTask {
  return {
    name: "close-redis",
    run: async () => {
      if (client.status !== "ready") {
        client.disconnect();
        return;
      }
      await client.quit();
    },
  };
}
