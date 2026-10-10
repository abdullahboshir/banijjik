import type { PermissionCache } from "../application/ports/permission-cache.js";
import type { GrantMap } from "../domain/grant-map.js";

export interface TwoTierPermissionCacheOptions {
  /** The in-process LRU: answers most checks without a network call. */
  readonly memory: PermissionCache;
  /** The cache shared between instances (Redis). */
  readonly shared: PermissionCache;
}

/**
 * Memory in front of the shared cache (ADR-088, ADR-090). A hit in memory never touches Redis; a
 * hit in Redis fills memory. A write goes to both. Both tiers key on the same versioned key, so
 * neither can serve a value older than the data the request saw.
 */
export class TwoTierPermissionCache implements PermissionCache {
  constructor(private readonly options: TwoTierPermissionCacheOptions) {}

  async get(key: string): Promise<GrantMap | undefined> {
    const { memory, shared } = this.options;
    const fromMemory = await memory.get(key);
    if (fromMemory !== undefined) return fromMemory;
    const fromShared = await shared.get(key);
    if (fromShared !== undefined) await memory.set(key, fromShared);
    return fromShared;
  }

  async set(key: string, value: GrantMap): Promise<void> {
    await this.options.memory.set(key, value);
    await this.options.shared.set(key, value);
  }
}
