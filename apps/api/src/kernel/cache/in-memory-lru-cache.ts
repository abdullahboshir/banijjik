import type { Clock } from "../time/index.js";

export const DEFAULT_MAX_ENTRIES = 10_000;
export const DEFAULT_TTL_MILLISECONDS = 10 * 60 * 1000;

export interface InMemoryLruCacheOptions {
  readonly clock: Clock;
  readonly maxEntries?: number;
  readonly ttlMilliseconds?: number;
}

interface CacheEntry<Value> {
  readonly value: Value;
  readonly expiresAtMilliseconds: number;
}

/**
 * A bounded least-recently-used cache with a TTL, on a plain Map (its iteration order is
 * insertion order, so the first key is always the least recently used one). Shared by the
 * permission cache (iam) and the config cache (entitlement).
 */
export class InMemoryLruCache<Value> {
  private readonly entries = new Map<string, CacheEntry<Value>>();
  private readonly maxEntries: number;
  private readonly ttlMilliseconds: number;

  constructor(private readonly options: InMemoryLruCacheOptions) {
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.ttlMilliseconds = options.ttlMilliseconds ?? DEFAULT_TTL_MILLISECONDS;
  }

  get(key: string): Value | undefined {
    const entry = this.entries.get(key);
    if (entry === undefined) return undefined;
    this.entries.delete(key);
    if (entry.expiresAtMilliseconds <= this.options.clock.now().getTime()) return undefined;
    // Re-inserting moves the key to the most recently used end.
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: Value): void {
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
