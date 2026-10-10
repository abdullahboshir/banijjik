import type { Clock } from "../../../../kernel/time/index.js";
import type { PermissionCache } from "../application/ports/permission-cache.js";
import type { GrantMap } from "../domain/grant-map.js";

export const DEFAULT_MAX_ENTRIES = 10_000;
export const DEFAULT_TTL_MILLISECONDS = 10 * 60 * 1000;

export interface InMemoryPermissionCacheOptions {
  readonly clock: Clock;
  readonly maxEntries?: number;
  readonly ttlMilliseconds?: number;
}

interface CacheEntry {
  readonly value: GrantMap;
  readonly expiresAtMilliseconds: number;
}

/**
 * A bounded least-recently-used cache with a TTL, on a plain Map (its iteration order is
 * insertion order, so the first key is always the least recently used one).
 */
export class InMemoryPermissionCache implements PermissionCache {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly maxEntries: number;
  private readonly ttlMilliseconds: number;

  constructor(private readonly options: InMemoryPermissionCacheOptions) {
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.ttlMilliseconds = options.ttlMilliseconds ?? DEFAULT_TTL_MILLISECONDS;
  }

  async get(key: string): Promise<GrantMap | undefined> {
    const entry = this.entries.get(key);
    if (entry === undefined) return undefined;
    this.entries.delete(key);
    if (entry.expiresAtMilliseconds <= this.options.clock.now().getTime()) return undefined;
    // Re-inserting moves the key to the most recently used end.
    this.entries.set(key, entry);
    return entry.value;
  }

  async set(key: string, value: GrantMap): Promise<void> {
    this.entries.delete(key);
    this.entries.set(key, {
      value,
      expiresAtMilliseconds: this.options.clock.now().getTime() + this.ttlMilliseconds,
    });
    this.evictOldest();
  }

  private evictOldest(): void {
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (oldest.done === true) return;
      this.entries.delete(oldest.value);
    }
  }
}
