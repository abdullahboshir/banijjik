import { newId } from "@banijjik/ids";
import { describe, inject, it } from "vitest";
import { createQueueRedisClient, type RedisClient } from "../kernel/redis/index.js";

/** Nothing listens on port 1: a connection to it is refused at once, which is how tests simulate Redis being away. */
export const UNREACHABLE_REDIS_URL = "redis://127.0.0.1:1";

const DELETE_BATCH_SIZE = 100;
let hasWarned = false;

function warnOnce(): void {
  if (hasWarned) return;
  hasWarned = true;
  process.stderr.write(
    "WARNING: TEST_REDIS_URL is not set, so the Redis test suites are skipped (CI fails instead). " +
      "Run them with TEST_REDIS_URL=redis://127.0.0.1:6380 against the compose Redis.\n",
  );
}

/** The URL for tests that can also run without a real Redis (the answer must not depend on it). */
export function redisUrlOrUnreachable(): string {
  const redisUrl = inject("redisUrl");
  return redisUrl === "" ? UNREACHABLE_REDIS_URL : redisUrl;
}

/**
 * A suite that needs a real Redis. With TEST_REDIS_URL it runs. Without it, CI fails loudly (a
 * silent skip would hide a broken queue) and a developer machine skips with one warning.
 */
export function describeWithRedis(name: string, define: (redisUrl: string) => void): void {
  const redisUrl = inject("redisUrl");
  if (redisUrl !== "") {
    describe(name, () => define(redisUrl));
    return;
  }
  if (inject("isCi")) {
    describe(name, () => {
      it("needs TEST_REDIS_URL in CI", () => {
        throw new Error("TEST_REDIS_URL must be set in CI: the Redis suites may not be skipped");
      });
    });
    return;
  }
  warnOnce();
  describe.skip(name, () => define(""));
}

export interface RedisTestScope {
  readonly client: RedisClient;
  /** Key prefix of every key this scope's queues create. */
  readonly prefix: string;
  /** Deletes only the keys under `prefix`, then closes the client. Never touches other keys. */
  dispose(): Promise<void>;
}

/** Own client and own key prefix per test, so tests never see each other's jobs and never flush a shared Redis. */
export function createRedisTestScope(redisUrl: string): RedisTestScope {
  const client = createQueueRedisClient(redisUrl);
  const prefix = `test-${newId().replaceAll("-", "").slice(-12)}`;
  return {
    client,
    prefix,
    dispose: async () => {
      await deleteKeysWithPrefix(client, prefix);
      await client.quit();
    },
  };
}

export async function deleteKeysWithPrefix(client: RedisClient, prefix: string): Promise<void> {
  const keys = await client.keys(`${prefix}:*`);
  for (let start = 0; start < keys.length; start += DELETE_BATCH_SIZE) {
    await client.del(...keys.slice(start, start + DELETE_BATCH_SIZE));
  }
}
