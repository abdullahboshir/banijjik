import { InMemoryLruCache, type InMemoryLruCacheOptions } from "../../../../kernel/cache/index.js";
import type { PermissionCache } from "../application/ports/permission-cache.js";
import type { GrantMap } from "../domain/grant-map.js";

export type InMemoryPermissionCacheOptions = InMemoryLruCacheOptions;

/** The permission cache in process memory: the kernel's LRU behind the async PermissionCache port. */
export class InMemoryPermissionCache implements PermissionCache {
  private readonly cache: InMemoryLruCache<GrantMap>;

  constructor(options: InMemoryPermissionCacheOptions) {
    this.cache = new InMemoryLruCache<GrantMap>(options);
  }

  async get(key: string): Promise<GrantMap | undefined> {
    return this.cache.get(key);
  }

  async set(key: string, value: GrantMap): Promise<void> {
    this.cache.set(key, value);
  }
}
