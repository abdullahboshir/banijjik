import { describe, expect, it } from "vitest";
import { isReturnWindowOpen } from "./sales-return-window.js";

describe("isReturnWindowOpen", () => {
  it("keeps the window open on the last day and closes it the day after", () => {
    const completed = "2026-10-20";
    expect(
      isReturnWindowOpen({
        completedBusinessDate: completed,
        todayBusinessDate: "2026-10-27",
        windowDays: 7,
      }),
    ).toBe(true);
    expect(
      isReturnWindowOpen({
        completedBusinessDate: completed,
        todayBusinessDate: "2026-10-28",
        windowDays: 7,
      }),
    ).toBe(false);
  });

  it("counts the organization-local date across a month boundary", () => {
    expect(
      isReturnWindowOpen({
        completedBusinessDate: "2026-10-28",
        todayBusinessDate: "2026-11-04",
        windowDays: 7,
      }),
    ).toBe(true);
  });

  it("allows only the completion day when the window is zero", () => {
    expect(
      isReturnWindowOpen({
        completedBusinessDate: "2026-10-25",
        todayBusinessDate: "2026-10-25",
        windowDays: 0,
      }),
    ).toBe(true);
    expect(
      isReturnWindowOpen({
        completedBusinessDate: "2026-10-25",
        todayBusinessDate: "2026-10-26",
        windowDays: 0,
      }),
    ).toBe(false);
  });
});
