import { getLogger } from "../../../../kernel/logger/index.js";
import type { RedisClient } from "../../../../kernel/redis/index.js";
import type { PermissionCache } from "../application/ports/permission-cache.js";
import type { GrantMap } from "../domain/grant-map.js";

export const REDIS_TTL_MILLISECONDS = 10 * 60 * 1000;

/** A GrantMap as JSON: a Set becomes an array and a Map becomes an array of pairs. */
interface StoredGrantMap {
  readonly allLocations: readonly string[];
  readonly byLocation: readonly (readonly [string, readonly string[]])[];
}

export function serializeGrantMap(grantMap: GrantMap): string {
  const stored: StoredGrantMap = {
    allLocations: [...grantMap.allLocations],
    byLocation: [...grantMap.byLocation].map(([locationId, keys]) => [locationId, [...keys]]),
  };
  return JSON.stringify(stored);
}

export function deserializeGrantMap(text: string): GrantMap {
  // Safe: only this class writes these keys, and it writes the StoredGrantMap shape (key includes the catalogue hash).
  const stored = JSON.parse(text) as StoredGrantMap;
  return {
    allLocations: new Set(stored.allLocations),
    byLocation: new Map(stored.byLocation.map(([locationId, keys]) => [locationId, new Set(keys)])),
  };
}

export interface RedisPermissionCacheOptions {
  readonly client: RedisClient;
  readonly ttlMilliseconds?: number;
}

/**
 * The permission cache shared between API instances (ADR-088). The key carries every version that
 * could make a value stale, so nothing is ever invalidated here. Redis is an accelerator only: any
 * Redis error is logged at warn and treated as a miss (or a skipped write), so an outage slows a
 * permission check by one database lookup and never fails or changes its answer.
 */
export class RedisPermissionCache implements PermissionCache {
  private readonly ttlMilliseconds: number;

  constructor(private readonly options: RedisPermissionCacheOptions) {
    this.ttlMilliseconds = options.ttlMilliseconds ?? REDIS_TTL_MILLISECONDS;
  }

  async get(key: string): Promise<GrantMap | undefined> {
    try {
      const text = await this.options.client.get(key);
      return text === null ? undefined : deserializeGrantMap(text);
    } catch (error) {
      this.warn("get", error);
      return undefined;
    }
  }

  async set(key: string, value: GrantMap): Promise<void> {
    try {
      await this.options.client.set(key, serializeGrantMap(value), "PX", this.ttlMilliseconds);
    } catch (error) {
      this.warn("set", error);
    }
  }

  private warn(operation: "get" | "set", error: unknown): void {
    // Name only: a client message can contain the connection URL.
    const errorName = error instanceof Error ? error.name : "UnknownError";
    getLogger().warn(
      { event: "permission_cache.redis_error", operation, errorName },
      "redis permission cache unavailable, treated as a miss",
    );
  }
}
