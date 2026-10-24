import { HOST_CACHE_TTL_MS } from "../config/storefront-config";

export interface HostResolverOptions {
  /** Asks the API which business a host belongs to. `undefined` = unknown host. Throws when the API fails. */
  readonly fetchOrganizationId: (host: string) => Promise<string | undefined>;
  readonly now: () => number;
  readonly ttlMs: number;
}

export interface HostResolver {
  resolve: (host: string) => Promise<string | undefined>;
}

interface CachedAnswer {
  readonly organizationId: string | undefined;
  readonly expiresAt: number;
}

/**
 * Remembers each host's answer for a minute, misses included, so a stranger hammering unknown hosts
 * does not reach the API on every request. A failed lookup is not cached: the next request asks again.
 */
export function createHostResolver(options: HostResolverOptions): HostResolver {
  const cache = new Map<string, CachedAnswer>();

  function readFresh(key: string): CachedAnswer | undefined {
    const answer = cache.get(key);
    if (answer === undefined) return undefined;
    if (answer.expiresAt > options.now()) return answer;
    cache.delete(key);
    return undefined;
  }

  async function resolve(host: string): Promise<string | undefined> {
    const key = host.trim().toLowerCase();
    const fresh = readFresh(key);
    if (fresh !== undefined) return fresh.organizationId;
    let organizationId: string | undefined;
    try {
      organizationId = await options.fetchOrganizationId(key);
    } catch {
      // The API could not answer: serve "site not found" for this request only, and ask again next time.
      return undefined;
    }
    cache.set(key, { organizationId, expiresAt: options.now() + options.ttlMs });
    return organizationId;
  }

  return { resolve };
}

/** Production resolver: one shared cache for the Node process, a 60 s lifetime (M.6 decision 9). */
export function createSystemHostResolver(
  fetchOrganizationId: (host: string) => Promise<string | undefined>,
): HostResolver {
  return createHostResolver({
    fetchOrganizationId,
    now: () => Date.now(),
    ttlMs: HOST_CACHE_TTL_MS,
  });
}
