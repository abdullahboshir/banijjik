import { describe, expect, it } from "vitest";
import { reportDailyQuerySchema, reportHomeQuerySchema } from "./report-schemas.js";

describe("the daily report query", () => {
  it("a range of exactly 92 days is accepted and a 93-day range is refused", () => {
    expect(reportDailyQuerySchema.safeParse({ from: "2026-07-01", to: "2026-09-30" }).success).toBe(
      true,
    );
    expect(reportDailyQuerySchema.safeParse({ from: "2026-07-01", to: "2026-10-01" }).success).toBe(
      false,
    );
  });

  it("a range that ends before it starts is refused", () => {
    const result = reportDailyQuerySchema.safeParse({ from: "2026-10-02", to: "2026-10-01" });
    expect(result.success).toBe(false);
  });

  it("a day that does not exist in the calendar is refused", () => {
    expect(reportDailyQuerySchema.safeParse({ from: "2026-02-30", to: "2026-03-01" }).success).toBe(
      false,
    );
  });

  it("the page size is at most 100 and defaults to 20", () => {
    const defaults = reportDailyQuerySchema.parse({ from: "2026-10-01", to: "2026-10-07" });
    expect(defaults).toMatchObject({ page: 1, limit: 20 });
    expect(
      reportDailyQuerySchema.safeParse({ from: "2026-10-01", to: "2026-10-07", limit: 101 })
        .success,
    ).toBe(false);
  });

  it("an unknown query field is refused", () => {
    expect(
      reportDailyQuerySchema.safeParse({
        from: "2026-10-01",
        to: "2026-10-07",
        organizationId: "x",
      }).success,
    ).toBe(false);
  });
});

describe("the home query", () => {
  it("accepts no location and refuses a malformed one", () => {
    expect(reportHomeQuerySchema.safeParse({}).success).toBe(true);
    expect(reportHomeQuerySchema.safeParse({ location: "not-a-uuid" }).success).toBe(false);
  });
});
