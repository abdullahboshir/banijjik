import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCurrentSiteResolution = vi.hoisted(() => vi.fn());
vi.mock("./current-site", () => ({
  currentSiteResolution: mockCurrentSiteResolution,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => (name === "locale" ? { value: "bn" } : undefined),
  })),
}));

import { readPublic } from "../api/storefront-api";
import {
  buildPublicCacheKey,
  createPublicProjectionCache,
  publicProjectionCache,
  sortQueryDimensions,
} from "./public-cache";

const ORG_A = "0195f3a0-0000-7000-8000-000000000001";
const ORG_B = "0195f3a0-0000-7000-8000-000000000002";
const VERSION_1 = "0195f3a0-0000-7000-8000-000000000011";
const VERSION_2 = "0195f3a0-0000-7000-8000-000000000012";

function clockAt(start = 1_000) {
  let current = start;
  return {
    now: () => current,
    advance: (milliseconds: number) => {
      current += milliseconds;
    },
  };
}

describe("public cache key isolation", () => {
  it("yields isolated cache keys for identical paths across organizations, versions, locales and locations", () => {
    const baseInput = {
      organizationId: ORG_A,
      websiteVersionId: VERSION_1,
      locale: "bn",
      locationId: "loc-1",
      projection: "/site",
    };

    const baseKey = buildPublicCacheKey(baseInput);

    const differentOrgKey = buildPublicCacheKey({ ...baseInput, organizationId: ORG_B });
    const differentVerKey = buildPublicCacheKey({ ...baseInput, websiteVersionId: VERSION_2 });
    const differentLangKey = buildPublicCacheKey({ ...baseInput, locale: "en" });
    const differentLocKey = buildPublicCacheKey({ ...baseInput, locationId: "loc-2" });
    const allLocKey = buildPublicCacheKey({ ...baseInput, locationId: undefined });

    expect(differentOrgKey).not.toBe(baseKey);
    expect(differentVerKey).not.toBe(baseKey);
    expect(differentLangKey).not.toBe(baseKey);
    expect(differentLocKey).not.toBe(baseKey);
    expect(allLocKey).toContain(":loc:all:");
  });

  it("sorts query parameters deterministically", () => {
    const query1 = { z: "last", a: "first", m: "middle" };
    const query2 = { a: "first", m: "middle", z: "last" };

    const key1 = buildPublicCacheKey({
      organizationId: ORG_A,
      websiteVersionId: VERSION_1,
      locale: "bn",
      projection: "/pages/ABOUT",
      query: query1,
    });

    const key2 = buildPublicCacheKey({
      organizationId: ORG_A,
      websiteVersionId: VERSION_1,
      locale: "bn",
      projection: "/pages/ABOUT",
      query: query2,
    });

    expect(key1).toBe(key2);
    expect(sortQueryDimensions(query1)).toBe("a=first&m=middle&z=last");
  });
});

describe("public projection cache eviction and invalidation", () => {
  it("evicts within entry limits", () => {
    const cache = createPublicProjectionCache({ maxEntries: 2 });
    cache.set("key1", { name: "Page 1" }, { organizationId: ORG_A, websiteVersionId: VERSION_1 });
    cache.set("key2", { name: "Page 2" }, { organizationId: ORG_A, websiteVersionId: VERSION_1 });
    cache.set("key3", { name: "Page 3" }, { organizationId: ORG_A, websiteVersionId: VERSION_1 });

    expect(cache.size).toBe(2);
    expect(cache.get("key1")).toBeUndefined();
    expect(cache.get("key2")).toEqual({ name: "Page 2" });
    expect(cache.get("key3")).toEqual({ name: "Page 3" });
  });

  it("evicts within byte limits", () => {
    const cache = createPublicProjectionCache({ maxBytes: 150 });
    const payload = "x".repeat(60);

    cache.set("item1", payload, {
      organizationId: ORG_A,
      websiteVersionId: VERSION_1,
      byteSize: 60,
    });
    cache.set("item2", payload, {
      organizationId: ORG_A,
      websiteVersionId: VERSION_1,
      byteSize: 60,
    });
    cache.set("item3", payload, {
      organizationId: ORG_A,
      websiteVersionId: VERSION_1,
      byteSize: 60,
    });

    expect(cache.totalBytes).toBeLessThanOrEqual(150);
    expect(cache.get("item1")).toBeUndefined();
    expect(cache.get("item2")).toBe(payload);
    expect(cache.get("item3")).toBe(payload);
  });

  it("expires entries past TTL", () => {
    const clock = clockAt(1_000);
    const cache = createPublicProjectionCache({ ttlMs: 5_000, now: clock.now });

    cache.set(
      "ephemeral",
      { status: "ok" },
      { organizationId: ORG_A, websiteVersionId: VERSION_1 },
    );
    expect(cache.get("ephemeral")).toEqual({ status: "ok" });

    clock.advance(5_001);
    expect(cache.get("ephemeral")).toBeUndefined();
  });

  it("invalidates organization entries idempotently", () => {
    const cache = createPublicProjectionCache();
    cache.set("orgA-v1", { title: "A1" }, { organizationId: ORG_A, websiteVersionId: VERSION_1 });
    cache.set("orgA-v2", { title: "A2" }, { organizationId: ORG_A, websiteVersionId: VERSION_2 });
    cache.set("orgB-v1", { title: "B1" }, { organizationId: ORG_B, websiteVersionId: VERSION_1 });

    cache.invalidateOrganization(ORG_A, VERSION_1);
    expect(cache.get("orgA-v1")).toBeUndefined();
    expect(cache.get("orgA-v2")).toEqual({ title: "A2" });
    expect(cache.get("orgB-v1")).toEqual({ title: "B1" });

    // Repeated call is safe and idempotent
    cache.invalidateOrganization(ORG_A, VERSION_1);
    expect(cache.get("orgA-v1")).toBeUndefined();

    // Invalidate all versions for org A
    cache.invalidateOrganization(ORG_A);
    expect(cache.get("orgA-v2")).toBeUndefined();
    expect(cache.get("orgB-v1")).toEqual({ title: "B1" });
  });

  it("serves the current pointer on publication or rollback even before invalidation runs", () => {
    const cache = createPublicProjectionCache();

    const keyV1 = buildPublicCacheKey({
      organizationId: ORG_A,
      websiteVersionId: VERSION_1,
      locale: "bn",
      projection: "/site",
    });
    const keyV2 = buildPublicCacheKey({
      organizationId: ORG_A,
      websiteVersionId: VERSION_2,
      locale: "bn",
      projection: "/site",
    });

    cache.set(
      keyV1,
      { version: "v1-content" },
      { organizationId: ORG_A, websiteVersionId: VERSION_1 },
    );
    cache.set(
      keyV2,
      { version: "v2-content" },
      { organizationId: ORG_A, websiteVersionId: VERSION_2 },
    );

    expect(cache.get(keyV1)).toEqual({ version: "v1-content" });
    expect(cache.get(keyV2)).toEqual({ version: "v2-content" });
    expect(cache.get(keyV1)).toEqual({ version: "v1-content" });
  });
});

describe("readPublic caching behavior and P4-11 protection", () => {
  beforeEach(() => {
    publicProjectionCache.clear();
    mockCurrentSiteResolution.mockReset();
    vi.restoreAllMocks();
  });

  it("refuses to serve cached data when host resolution is missing or inactive (P4-11)", async () => {
    const key = buildPublicCacheKey({
      organizationId: ORG_A,
      websiteVersionId: VERSION_1,
      locale: "bn",
      projection: "/site",
    });
    publicProjectionCache.set(
      key,
      { cached: "should-never-be-served-without-active-host" },
      { organizationId: ORG_A, websiteVersionId: VERSION_1 },
    );

    mockCurrentSiteResolution.mockResolvedValue(undefined);
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "NOT_FOUND" } }), {
        status: 404,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", mockFetch);

    const result = await readPublic(`/orgs/${ORG_A}/site`);

    expect(result).toBeUndefined();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("never caches responses with Set-Cookie, private Cache-Control or upstream errors", async () => {
    mockCurrentSiteResolution.mockResolvedValue({
      organizationId: ORG_A,
      hostname: "shop.example.com",
      canonicalHostname: "shop.example.com",
      publishedWebsiteVersionId: VERSION_1,
      generation: 1,
    });

    // 1. Response carrying Set-Cookie is never cached
    const mockFetchWithCookie = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { title: "Uncacheable Cookie" } }), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "cache-control": "public, max-age=60",
          "set-cookie": "token=secret; Path=/",
        },
      }),
    );
    vi.stubGlobal("fetch", mockFetchWithCookie);

    const cookieResult = await readPublic<{ title: string }>(`/orgs/${ORG_A}/site`);
    expect(cookieResult?.title).toBe("Uncacheable Cookie");
    expect(publicProjectionCache.size).toBe(0);

    // 2. Response with private Cache-Control is never cached
    const mockFetchPrivate = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { title: "Private Content" } }), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "cache-control": "private, no-store",
        },
      }),
    );
    vi.stubGlobal("fetch", mockFetchPrivate);

    const privateResult = await readPublic<{ title: string }>(`/orgs/${ORG_A}/site`);
    expect(privateResult?.title).toBe("Private Content");
    expect(publicProjectionCache.size).toBe(0);

    // 3. Upstream 404 is never cached
    const mockFetch404 = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "NOT_FOUND" } }), {
        status: 404,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", mockFetch404);

    const notFoundResult = await readPublic(`/orgs/${ORG_A}/site`);
    expect(notFoundResult).toBeUndefined();
    expect(publicProjectionCache.size).toBe(0);

    // 4. Valid public response IS cached and reused
    const mockFetchPublic = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { title: "Public Content" } }), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "cache-control": "public, max-age=60",
        },
      }),
    );
    vi.stubGlobal("fetch", mockFetchPublic);

    const publicResult1 = await readPublic<{ title: string }>(`/orgs/${ORG_A}/site`);
    expect(publicResult1?.title).toBe("Public Content");
    expect(publicProjectionCache.size).toBe(1);

    // Second call reads from cache without hitting fetch
    const publicResult2 = await readPublic<{ title: string }>(`/orgs/${ORG_A}/site`);
    expect(publicResult2?.title).toBe("Public Content");
    expect(mockFetchPublic).toHaveBeenCalledTimes(1);
  });
});
