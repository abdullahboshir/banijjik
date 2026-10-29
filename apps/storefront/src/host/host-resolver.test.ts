import { describe, expect, it, vi } from "vitest";
import { createHostResolver } from "./host-resolver";

const ORGANIZATION_ID = "0195f3a0-0000-7000-8000-000000000001";
const HOST_RESOLUTION = {
  organizationId: ORGANIZATION_ID,
  generation: 0,
  canonicalHostname: "shop.sites.example.com",
  publishedWebsiteVersionId: "0195f3a0-0000-7000-8000-000000000002",
};
const NEGATIVE_CACHE_TTL_MS = 30_000;

function clockAt(start = 1_000) {
  let current = start;
  return {
    now: () => current,
    advance: (milliseconds: number) => {
      current += milliseconds;
    },
  };
}

describe("storefront host resolver", () => {
  it("normalizes valid hosts and rejects malformed input before lookup", async () => {
    const fetchResolution = vi.fn(async () => HOST_RESOLUTION);
    const resolver = createHostResolver({ fetchResolution, now: () => 0 });

    await expect(resolver.resolve("Shop.Sites.Example.com.")).resolves.toEqual(HOST_RESOLUTION);
    await expect(resolver.resolve("shop.sites.example.com:443")).resolves.toBeUndefined();
    await expect(resolver.resolve("shop.sites.example.com/path")).resolves.toBeUndefined();
    await expect(resolver.resolve("192.0.2.3")).resolves.toBeUndefined();
    expect(fetchResolution).toHaveBeenCalledTimes(1);
    expect(fetchResolution).toHaveBeenCalledWith("shop.sites.example.com");
  });

  it("strips a port only for localhost development hosts", async () => {
    const fetchResolution = vi.fn(async () => HOST_RESOLUTION);
    const resolver = createHostResolver({ fetchResolution, now: () => 0 });

    await resolver.resolve("shop.localhost:3102");

    expect(fetchResolution).toHaveBeenCalledWith("shop.localhost");
  });

  it("caches unknown hosts for at most 30 seconds and never caches positive eligibility", async () => {
    const clock = clockAt();
    const fetchResolution = vi
      .fn<(hostname: string) => Promise<typeof HOST_RESOLUTION | undefined>>()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValue(HOST_RESOLUTION);
    const resolver = createHostResolver({ fetchResolution, now: clock.now });

    await resolver.resolve("missing.sites.example.com");
    await resolver.resolve("MISSING.sites.example.com");
    await resolver.resolve("shop.sites.example.com");
    await resolver.resolve("shop.sites.example.com");
    expect(fetchResolution).toHaveBeenCalledTimes(3);

    clock.advance(NEGATIVE_CACHE_TTL_MS);
    await resolver.resolve("missing.sites.example.com");
    expect(fetchResolution).toHaveBeenCalledTimes(4);
  });

  it("bounds its LRU at 2,000 entries", async () => {
    const fetchResolution = vi.fn(async () => undefined);
    const resolver = createHostResolver({ fetchResolution, now: () => 0 });

    for (let index = 0; index < 1_101; index += 1) {
      await resolver.resolve(`host-${index}.sites.example.com`);
    }
    await resolver.resolve("host-0.sites.example.com");

    expect(fetchResolution).toHaveBeenCalledTimes(1_102);
  });

  it("propagates authoritative lookup failures so the proxy can return 503", async () => {
    const resolver = createHostResolver({
      fetchResolution: vi.fn(async () => {
        throw new Error("API unavailable");
      }),
      now: () => 0,
    });

    await expect(resolver.resolve("shop.sites.example.com")).rejects.toThrow("API unavailable");
    await expect(resolver.resolve("shop.sites.example.com")).rejects.toThrow("API unavailable");
  });
});
