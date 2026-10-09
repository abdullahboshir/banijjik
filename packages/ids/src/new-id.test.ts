import { afterEach, describe, expect, it, vi } from "vitest";
import { UUID_V7_PATTERN } from "./is-uuid-v7.js";
import { newId } from "./new-id.js";

const SAMPLE_COUNT = 10_000;

function timestampOf(id: string): number {
  return Number.parseInt(id.replaceAll("-", "").slice(0, 12), 16);
}

describe("newId", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a canonical lowercase UUID v7 string", () => {
    for (let sample = 0; sample < 1_000; sample += 1) {
      expect(newId()).toMatch(UUID_V7_PATTERN);
    }
  });

  it("sets version nibble 7 and variant bits 10", () => {
    const id = newId();
    expect(id[14]).toBe("7");
    expect(Number.parseInt(id[19] ?? "", 16) & 0b1100).toBe(0b1000);
  });

  it("embeds the creation time in milliseconds", () => {
    const before = Date.now();
    const id = newId();
    expect(Math.abs(timestampOf(id) - before)).toBeLessThanOrEqual(1);
  });

  it("sorts strictly ascending when many IDs are made in the same millisecond", () => {
    const ids = Array.from({ length: SAMPLE_COUNT }, () => newId());
    for (let index = 1; index < ids.length; index += 1) {
      expect(ids[index]! > ids[index - 1]!).toBe(true);
    }
  });

  it("never repeats an ID", () => {
    const ids = new Set(Array.from({ length: SAMPLE_COUNT }, () => newId()));
    expect(ids.size).toBe(SAMPLE_COUNT);
  });

  it("keeps sorting after the previous ID when the clock goes backwards", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2040-01-01T00:00:10Z"));
    const first = newId();
    vi.setSystemTime(new Date("2040-01-01T00:00:05Z"));
    const second = newId();
    expect(second > first).toBe(true);
  });
});
