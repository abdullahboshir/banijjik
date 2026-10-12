import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createCacheRedisClient } from "../redis/index.js";
import {
  createRedisTestScope,
  describeWithRedis,
  UNREACHABLE_REDIS_URL,
  type RedisTestScope,
} from "../../test-support/test-redis.js";
import { RedisRateLimiter } from "./redis-rate-limiter.js";

const LIMIT = { bucket: "test.bucket", limit: 3, windowSeconds: 60 };
const MILLISECONDS_PER_SECOND = 1000;

describeWithRedis("RedisRateLimiter", (redisUrl) => {
  let scope: RedisTestScope;
  let limiter: RedisRateLimiter;

  beforeEach(() => {
    scope = createRedisTestScope(redisUrl);
    limiter = new RedisRateLimiter({ client: scope.client, keyPrefix: scope.prefix });
  });

  afterEach(() => scope.dispose());

  async function consumeTimes(key: string, times: number) {
    const decisions = [];
    for (let attempt = 1; attempt <= times; attempt += 1) {
      decisions.push(await limiter.consume({ ...LIMIT, key }));
    }
    return decisions;
  }

  it("allows up to the limit and then refuses with the seconds left in the window", async () => {
    const decisions = await consumeTimes("limit-case", 4);

    expect(decisions.map((decision) => decision.allowed)).toEqual([true, true, true, false]);
    expect(decisions[3]?.retryAfterSeconds).toBeGreaterThan(0);
    expect(decisions[3]?.retryAfterSeconds).toBeLessThanOrEqual(LIMIT.windowSeconds);
  });

  it("gives every counter a time to live, so abandoned counters clean themselves up", async () => {
    await consumeTimes("ttl-case", 2);

    const [storedKey] = await scope.client.keys(`${scope.prefix}:*`);
    const remaining = await scope.client.pttl(storedKey ?? "");

    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(LIMIT.windowSeconds * MILLISECONDS_PER_SECOND);
  });

  it("starts a fresh count once the window has passed", async () => {
    await consumeTimes("window-case", 4);
    const [storedKey] = await scope.client.keys(`${scope.prefix}:*`);
    await scope.client.pexpire(storedKey ?? "", 1);
    await new Promise((resolve) => setTimeout(resolve, 20));

    const decision = await limiter.consume({ ...LIMIT, key: "window-case" });

    expect(decision.allowed).toBe(true);
  });

  it("counts each key on its own", async () => {
    await consumeTimes("busy-key", 4);

    const decision = await limiter.consume({ ...LIMIT, key: "quiet-key" });

    expect(decision.allowed).toBe(true);
  });

  it("gives one attempt back on refund and never counts below zero", async () => {
    await consumeTimes("refund-case", 3);

    await limiter.refund({ ...LIMIT, key: "refund-case" });
    const afterRefund = await limiter.consume({ ...LIMIT, key: "refund-case" });
    const overLimit = await limiter.consume({ ...LIMIT, key: "refund-case" });
    await limiter.refund({ ...LIMIT, key: "never-counted" });
    const afterEmptyRefund = await consumeTimes("never-counted", LIMIT.limit + 1);

    expect(afterRefund.allowed).toBe(true);
    expect(overLimit.allowed).toBe(false);
    expect(afterEmptyRefund.map((decision) => decision.allowed)).toEqual([true, true, true, false]);
  });

  it("forgets a subject on reset", async () => {
    await consumeTimes("reset-case", 4);

    await limiter.reset({ bucket: LIMIT.bucket, key: "reset-case" });
    const decision = await limiter.consume({ ...LIMIT, key: "reset-case" });

    expect(decision.allowed).toBe(true);
  });

  it("lets exactly the limit through when requests arrive at the same time", async () => {
    const decisions = await Promise.all(
      Array.from({ length: 12 }, () => limiter.consume({ ...LIMIT, key: "concurrent-case" })),
    );

    expect(decisions.filter((decision) => decision.allowed)).toHaveLength(LIMIT.limit);
  });

  it("stores the key only as a hash", async () => {
    await limiter.consume({ ...LIMIT, key: "someone@example.com" });

    const storedKeys = await scope.client.keys(`${scope.prefix}:*`);

    expect(storedKeys.length).toBeGreaterThan(0);
    expect(storedKeys.join(" ")).not.toContain("someone@example.com");
  });
});

describe("RedisRateLimiter without Redis", () => {
  it("throws, so the caller decides what an unavailable limiter means", async () => {
    const client = createCacheRedisClient(UNREACHABLE_REDIS_URL);
    const limiter = new RedisRateLimiter({ client });

    const attempt = limiter.consume({ ...LIMIT, key: "anyone" });

    await expect(attempt).rejects.toThrow();
    client.disconnect();
  });
});
