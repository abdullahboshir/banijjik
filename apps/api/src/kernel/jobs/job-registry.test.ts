import { describe, expect, it } from "vitest";
import { JobRegistry } from "./job-registry.js";

describe("JobRegistry", () => {
  it("registers, lists and seals", () => {
    const registry = new JobRegistry();
    const job = {
      jobKey: "booking.expireHolds",
      everyMinutes: 1,
      run: async () => undefined,
    };
    registry.register(job);
    expect(registry.find("booking.expireHolds")).toBe(job);
    expect(registry.all()).toHaveLength(1);
    registry.seal();
    expect(() =>
      registry.register({
        jobKey: "booking.markNoShows",
        everyMinutes: 5,
        run: async () => undefined,
      }),
    ).toThrow();
  });

  it("refuses a duplicate key", () => {
    const registry = new JobRegistry();
    registry.register({
      jobKey: "booking.expireHolds",
      everyMinutes: 1,
      run: async () => undefined,
    });
    expect(() =>
      registry.register({
        jobKey: "booking.expireHolds",
        everyMinutes: 1,
        run: async () => undefined,
      }),
    ).toThrow();
  });
});
