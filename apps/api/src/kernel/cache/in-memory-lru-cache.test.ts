import { describe, expect, it } from "vitest";
import { MutableClock } from "../../test-support/mutable-clock.js";
import { InMemoryLruCache } from "./in-memory-lru-cache.js";

describe("InMemoryLruCache", () => {
  it("returns what was stored and undefined for an unknown key", () => {
    const cache = new InMemoryLruCache<string>({ clock: new MutableClock() });

    cache.set("k1", "a");

    expect(cache.get("k1")).toBe("a");
    expect(cache.get("other")).toBeUndefined();
  });

  it("forgets an entry after its time to live", () => {
    const clock = new MutableClock();
    const cache = new InMemoryLruCache<string>({ clock, ttlMilliseconds: 60_000 });
    cache.set("k1", "a");

    clock.advanceSeconds(59);
    const stillThere = cache.get("k1");
    clock.advanceSeconds(2);

    expect(stillThere).toBe("a");
    expect(cache.get("k1")).toBeUndefined();
  });

  it("evicts the least recently used entry when it is full", () => {
    const cache = new InMemoryLruCache<string>({ clock: new MutableClock(), maxEntries: 2 });
    cache.set("k1", "1");
    cache.set("k2", "2");

    cache.get("k1");
    cache.set("k3", "3");

    expect(cache.get("k2")).toBeUndefined();
    expect(cache.get("k1")).toBe("1");
    expect(cache.get("k3")).toBe("3");
  });
});
