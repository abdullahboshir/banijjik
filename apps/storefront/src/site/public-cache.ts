import { PUBLIC_REVALIDATE_SECONDS } from "../config/storefront-config";

export const DEFAULT_PUBLIC_CACHE_MAX_ENTRIES = 500;
export const DEFAULT_PUBLIC_CACHE_MAX_BYTES = 8 * 1024 * 1024;
export const DEFAULT_PUBLIC_CACHE_TTL_MS = PUBLIC_REVALIDATE_SECONDS * 1_000;
export const PUBLIC_CACHE_SCHEMA_VERSION = "v1";

export interface PublicCacheKeyInput {
  readonly organizationId: string;
  readonly websiteVersionId: string;
  readonly locale: string;
  readonly locationId?: string | null | undefined;
  readonly projection: string;
  readonly query?:
    | Record<string, string | number | boolean | readonly string[] | undefined>
    | URLSearchParams
    | undefined;
}

function extractQueryEntries(
  query:
    Record<string, string | number | boolean | readonly string[] | undefined> | URLSearchParams,
): [string, string][] {
  if (query instanceof URLSearchParams) {
    return Array.from(query.entries());
  }
  const entries: [string, string][] = [];
  for (const [key, rawValue] of Object.entries(query)) {
    if (rawValue === undefined) continue;
    if (Array.isArray(rawValue)) {
      entries.push(...rawValue.map((item): [string, string] => [key, String(item)]));
    } else {
      entries.push([key, String(rawValue)]);
    }
  }
  return entries;
}

export function sortQueryDimensions(
  query?:
    | Record<string, string | number | boolean | readonly string[] | undefined>
    | URLSearchParams
    | undefined,
): string {
  if (query === undefined) return "";
  const entries = extractQueryEntries(query);
  if (entries.length === 0) return "";

  entries.sort((a, b) => {
    const keyCompare = a[0].localeCompare(b[0]);
    if (keyCompare !== 0) return keyCompare;
    return a[1].localeCompare(b[1]);
  });

  return entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
}

function normalizeProjectionPath(projection: string, organizationId: string): string {
  let normalized = projection.trim();
  const orgPrefix = `/orgs/${organizationId}`;
  if (normalized.startsWith(orgPrefix)) {
    normalized = normalized.slice(orgPrefix.length);
  }
  if (!normalized.startsWith("/")) {
    normalized = `/${normalized}`;
  }
  if (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

/**
 * Deterministically constructs isolated public cache keys partitioned by organizationId,
 * websiteVersionId, locale, locationId, projection path, and sorted query dimensions.
 */
export function buildPublicCacheKey(input: PublicCacheKeyInput): string {
  const org = input.organizationId.trim();
  const version = input.websiteVersionId.trim();
  const locale = input.locale.trim().toLowerCase();
  const location =
    input.locationId !== null && input.locationId !== undefined && input.locationId.trim() !== ""
      ? input.locationId.trim()
      : "all";
  const projection = normalizeProjectionPath(input.projection, org);
  const queryStr = sortQueryDimensions(input.query);

  const base = `org:${org}:ver:${version}:lang:${locale}:loc:${location}:proj:${projection}@${PUBLIC_CACHE_SCHEMA_VERSION}`;
  return queryStr === "" ? base : `${base}:q:${queryStr}`;
}

export interface PublicProjectionCacheOptions {
  readonly maxEntries?: number;
  readonly maxBytes?: number;
  readonly ttlMs?: number;
  readonly now?: () => number;
}

interface CacheEntry<T> {
  readonly value: T;
  readonly bytes: number;
  readonly expiresAt: number;
  readonly organizationId: string;
  readonly websiteVersionId: string;
}

function estimateByteSize(value: unknown): number {
  if (typeof value === "string") return Buffer.byteLength(value, "utf8");
  try {
    return Buffer.byteLength(JSON.stringify(value), "utf8");
  } catch {
    return 1_024;
  }
}

export interface PublicProjectionCache {
  get: <T>(key: string) => T | undefined;
  set: <T>(
    key: string,
    value: T,
    meta: {
      readonly organizationId: string;
      readonly websiteVersionId: string;
      readonly byteSize?: number;
    },
  ) => void;
  invalidateOrganization: (organizationId: string, websiteVersionId?: string) => void;
  clear: () => void;
  readonly size: number;
  readonly totalBytes: number;
}

class MemoryPublicProjectionCache implements PublicProjectionCache {
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private currentTotalBytes = 0;
  private readonly maxEntries: number;
  private readonly maxBytes: number;
  private readonly ttlMs: number;
  private readonly now: () => number;

  constructor(options: PublicProjectionCacheOptions = {}) {
    this.maxEntries = options.maxEntries ?? DEFAULT_PUBLIC_CACHE_MAX_ENTRIES;
    this.maxBytes = options.maxBytes ?? DEFAULT_PUBLIC_CACHE_MAX_BYTES;
    this.ttlMs = options.ttlMs ?? DEFAULT_PUBLIC_CACHE_TTL_MS;
    this.now = options.now ?? (() => Date.now());
  }

  get size(): number {
    return this.cache.size;
  }

  get totalBytes(): number {
    return this.currentTotalBytes;
  }

  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (entry === undefined) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.currentTotalBytes -= entry.bytes;
      this.cache.delete(key);
      return undefined;
    }
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value as T;
  }

  set<T>(
    key: string,
    value: T,
    meta: {
      readonly organizationId: string;
      readonly websiteVersionId: string;
      readonly byteSize?: number;
    },
  ): void {
    const bytes = meta.byteSize ?? estimateByteSize(value);
    if (bytes > this.maxBytes) return;

    const existing = this.cache.get(key);
    if (existing !== undefined) {
      this.currentTotalBytes -= existing.bytes;
      this.cache.delete(key);
    }

    const entry: CacheEntry<unknown> = {
      value,
      bytes,
      expiresAt: this.now() + this.ttlMs,
      organizationId: meta.organizationId,
      websiteVersionId: meta.websiteVersionId,
    };
    this.cache.set(key, entry);
    this.currentTotalBytes += bytes;
    this.enforceLimits();
  }

  invalidateOrganization(organizationId: string, websiteVersionId?: string): void {
    for (const [key, entry] of this.cache.entries()) {
      if (entry.organizationId !== organizationId) continue;
      if (websiteVersionId !== undefined && entry.websiteVersionId !== websiteVersionId) continue;
      this.currentTotalBytes -= entry.bytes;
      this.cache.delete(key);
    }
  }

  clear(): void {
    this.cache.clear();
    this.currentTotalBytes = 0;
  }

  private enforceLimits(): void {
    while (this.cache.size > this.maxEntries || this.currentTotalBytes > this.maxBytes) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey === undefined) break;
      const entry = this.cache.get(oldestKey);
      if (entry !== undefined) {
        this.currentTotalBytes -= entry.bytes;
      }
      this.cache.delete(oldestKey);
    }
  }
}

export function createPublicProjectionCache(
  options: PublicProjectionCacheOptions = {},
): PublicProjectionCache {
  return new MemoryPublicProjectionCache(options);
}

export const publicProjectionCache = createPublicProjectionCache();
