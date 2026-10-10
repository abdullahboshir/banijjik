import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCacheRedisClient, type RedisClient } from "../../../../kernel/redis/index.js";
import { MutableClock } from "../../../../test-support/mutable-clock.js";
import { installTestLogger } from "../../../../test-support/test-databases.js";
import type { LogCapture } from "../../../../test-support/log-capture.js";
import {
  createRedisTestScope,
  describeWithRedis,
  UNREACHABLE_REDIS_URL,
  type RedisTestScope,
} from "../../../../test-support/test-redis.js";
import type { PermissionCache } from "../application/ports/permission-cache.js";
import type { GrantMap } from "../domain/grant-map.js";
import { InMemoryPermissionCache } from "./in-memory-permission-cache.js";
import { RedisPermissionCache } from "./redis-permission-cache.js";
import { TwoTierPermissionCache } from "./two-tier-permission-cache.js";

const grantMap: GrantMap = {
  allLocations: new Set(["iam.role.read", "iam.role.create"]),
  byLocation: new Map([["location-1", new Set(["organization.location.read"])]]),
};

let logs: LogCapture;

beforeEach(() => {
  logs = installTestLogger();
});

describeWithRedis("RedisPermissionCache", (redisUrl) => {
  let scope: RedisTestScope;

  beforeEach(() => {
    scope = createRedisTestScope(redisUrl);
  });

  afterEach(() => scope.dispose());

  it("round-trips a grant map with its sets and maps and expires it with a time to live", async () => {
    const key = `${scope.prefix}:perm:one`;
    const cache = new RedisPermissionCache({ client: scope.client, ttlMilliseconds: 5000 });

    await cache.set(key, grantMap);
    const found = await cache.get(key);

    expect(found).toEqual(grantMap);
    expect(await cache.get(`${scope.prefix}:perm:other`)).toBeUndefined();
    const remaining = await scope.client.pttl(key);
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(5000);
  });
});

describe("RedisPermissionCache when Redis fails", () => {
  let client: RedisClient;

  beforeEach(() => {
    client = createCacheRedisClient(UNREACHABLE_REDIS_URL);
  });

  afterEach(() => {
    client.disconnect();
  });

  it("treats a Redis error as a miss and logs one warning without the connection URL", async () => {
    const cache = new RedisPermissionCache({ client });

    const found = await cache.get("perm:any");
    await cache.set("perm:any", grantMap);

    expect(found).toBeUndefined();
    const warnings = logs
      .lines()
      .filter((line) => line["event"] === "permission_cache.redis_error");
    expect(warnings.map((line) => line["operation"])).toEqual(["get", "set"]);
    expect(warnings.every((line) => line["level"] === 40)).toBe(true);
    expect(logs.text()).not.toContain(UNREACHABLE_REDIS_URL);
  });
});

describe("TwoTierPermissionCache", () => {
  function recordingShared(): PermissionCache & { gets: number; sets: number } {
    const stored = new Map<string, GrantMap>();
    return {
      gets: 0,
      sets: 0,
      async get(key) {
        this.gets += 1;
        return stored.get(key);
      },
      async set(key, value) {
        this.sets += 1;
        stored.set(key, value);
      },
    };
  }

  it("answers from memory on a hit without touching the shared tier", async () => {
    const shared = recordingShared();
    const cache = new TwoTierPermissionCache({
      memory: new InMemoryPermissionCache({ clock: new MutableClock() }),
      shared,
    });
    await cache.set("k", grantMap);
    shared.gets = 0;

    const found = await cache.get("k");

    expect(found).toEqual(grantMap);
    expect(shared.gets).toBe(0);
    expect(shared.sets).toBe(1);
  });

  it("fills memory from the shared tier on a miss, so the next read stays local", async () => {
    const shared = recordingShared();
    await shared.set("k", grantMap);
    const cache = new TwoTierPermissionCache({
      memory: new InMemoryPermissionCache({ clock: new MutableClock() }),
      shared,
    });

    await cache.get("k");
    shared.gets = 0;
    const second = await cache.get("k");

    expect(second).toEqual(grantMap);
    expect(shared.gets).toBe(0);
    vi.restoreAllMocks();
  });
});
