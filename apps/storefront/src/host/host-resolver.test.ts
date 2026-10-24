import { describe, expect, it, vi } from "vitest";
import { createHostResolver } from "./host-resolver";

const ONE_MINUTE_MS = 60_000;
const ORGANIZATION_ID = "0195f3a0-0000-7000-8000-000000000001";

function clockAt(start: number) {
  let current = start;
  return {
    now: () => current,
    advance: (milliseconds: number) => {
      current += milliseconds;
    },
  };
}

describe("host resolver", () => {
  it("resolves a host once per minute and caches a miss", async () => {
    const clock = clockAt(1_000);
    const fetchOrganizationId = vi.fn(async (host: string) =>
      host === "shop.sites.example.com" ? ORGANIZATION_ID : undefined,
    );
    const resolver = createHostResolver({
      fetchOrganizationId,
      now: clock.now,
      ttlMs: ONE_MINUTE_MS,
    });

    expect(await resolver.resolve("shop.sites.example.com")).toBe(ORGANIZATION_ID);
    expect(await resolver.resolve("Shop.sites.example.com")).toBe(ORGANIZATION_ID);
    expect(await resolver.resolve("nobody.sites.example.com")).toBeUndefined();
    expect(await resolver.resolve("nobody.sites.example.com")).toBeUndefined();
    expect(fetchOrganizationId).toHaveBeenCalledTimes(2);

    clock.advance(ONE_MINUTE_MS);
    await resolver.resolve("nobody.sites.example.com");
    expect(fetchOrganizationId).toHaveBeenCalledTimes(3);
  });

  it("does not cache a failed lookup, so the next request asks the API again", async () => {
    const clock = clockAt(0);
    const fetchOrganizationId = vi
      .fn<(host: string) => Promise<string | undefined>>()
      .mockRejectedValueOnce(new Error("API down"))
      .mockResolvedValueOnce(ORGANIZATION_ID);
    const resolver = createHostResolver({
      fetchOrganizationId,
      now: clock.now,
      ttlMs: ONE_MINUTE_MS,
    });

    expect(await resolver.resolve("shop.sites.example.com")).toBeUndefined();
    expect(await resolver.resolve("shop.sites.example.com")).toBe(ORGANIZATION_ID);
    expect(fetchOrganizationId).toHaveBeenCalledTimes(2);
  });
});
