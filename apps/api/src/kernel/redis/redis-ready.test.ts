import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createRedisTestScope,
  describeWithRedis,
  UNREACHABLE_REDIS_URL,
  type RedisTestScope,
} from "../../test-support/test-redis.js";
import { createCacheRedisClient } from "./redis-client.js";
import { isRedisReady } from "./redis-ready.js";

describeWithRedis("isRedisReady with a live Redis", (redisUrl) => {
  let scope: RedisTestScope;
  beforeEach(() => {
    scope = createRedisTestScope(redisUrl);
  });
  afterEach(() => scope.dispose());

  it("is true when Redis answers PING", async () => {
    expect(await isRedisReady(scope.client)).toBe(true);
  });
});

describe("isRedisReady without Redis", () => {
  it("is false when Redis cannot be reached", async () => {
    const client = createCacheRedisClient(UNREACHABLE_REDIS_URL);

    const ready = await isRedisReady(client, 500);
    client.disconnect();

    expect(ready).toBe(false);
  });
});
