import { describe, expect, it } from "vitest";
import { alignBucketStart, bucketStartsCovering } from "./buckets.js";

describe("bucketStartsCovering", () => {
  it("covers every 5-minute bucket of a 30-minute service", () => {
    const startsAt = new Date("2026-10-20T10:00:00.000Z");
    const endsAt = new Date("2026-10-20T10:30:00.000Z");
    const buckets = bucketStartsCovering(startsAt, endsAt);
    expect(buckets).toHaveLength(6);
    expect(buckets[0]?.toISOString()).toBe("2026-10-20T10:00:00.000Z");
    expect(buckets[5]?.toISOString()).toBe("2026-10-20T10:25:00.000Z");
  });

  it("aligns a mid-bucket start down", () => {
    expect(alignBucketStart(new Date("2026-10-20T10:07:00.000Z")).toISOString()).toBe(
      "2026-10-20T10:05:00.000Z",
    );
  });
});
