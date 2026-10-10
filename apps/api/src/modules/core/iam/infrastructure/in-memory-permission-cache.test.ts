import { describe, expect, it } from "vitest";
import { MutableClock } from "../../../../test-support/mutable-clock.js";
import type { GrantMap } from "../domain/grant-map.js";
import { InMemoryPermissionCache } from "./in-memory-permission-cache.js";

function aGrantMap(label: string): GrantMap {
  return { allLocations: new Set([label]), byLocation: new Map() };
}

describe("InMemoryPermissionCache", () => {
  it("returns what was stored and undefined for an unknown key", async () => {
    const cache = new InMemoryPermissionCache({ clock: new MutableClock() });
    const value = aGrantMap("a");

    await cache.set("k1", value);

    expect(await cache.get("k1")).toBe(value);
    expect(await cache.get("other")).toBeUndefined();
  });

  it("forgets an entry after its time to live", async () => {
    const clock = new MutableClock();
    const cache = new InMemoryPermissionCache({ clock, ttlMilliseconds: 60_000 });
    await cache.set("k1", aGrantMap("a"));

    clock.advanceSeconds(59);
    const stillThere = await cache.get("k1");
    clock.advanceSeconds(2);
    const expired = await cache.get("k1");

    expect(stillThere).toBeDefined();
    expect(expired).toBeUndefined();
  });

  it("evicts the least recently used entry when it is full", async () => {
    const cache = new InMemoryPermissionCache({ clock: new MutableClock(), maxEntries: 2 });
    await cache.set("k1", aGrantMap("1"));
    await cache.set("k2", aGrantMap("2"));

    await cache.get("k1");
    await cache.set("k3", aGrantMap("3"));

    expect(await cache.get("k2")).toBeUndefined();
    expect(await cache.get("k1")).toBeDefined();
    expect(await cache.get("k3")).toBeDefined();
  });

  it("never grows beyond its limit", async () => {
    const cache = new InMemoryPermissionCache({ clock: new MutableClock(), maxEntries: 3 });

    for (let index = 0; index < 10; index += 1) await cache.set(`k${index}`, aGrantMap("x"));

    expect(await cache.get("k0")).toBeUndefined();
    expect(await cache.get("k6")).toBeUndefined();
    expect(await cache.get("k9")).toBeDefined();
  });
});
