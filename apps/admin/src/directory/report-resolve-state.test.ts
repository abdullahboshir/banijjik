import { DIRECTORY_API_MESSAGE_KEYS } from "@banijjik/contracts/directory";
import { describe, expect, it } from "vitest";
import { ApiError } from "../lib/api/api-error";
import { isStaleReportError, reportAgeOf, resolveOutcomeOptions } from "./report-resolve-state";

function apiError(status: number, messageKey: string): ApiError {
  return new ApiError({ status, code: "CONFLICT", messageKey });
}

describe("report resolve state", () => {
  it("offers only dismiss and warn without the second permissions", () => {
    expect(resolveOutcomeOptions({ canHide: false, canBlockAccounts: false })).toEqual([
      "DISMISSED",
      "WARNED",
    ]);
  });

  it("offers hiding only with the hide permission", () => {
    expect(resolveOutcomeOptions({ canHide: true, canBlockAccounts: false })).toEqual([
      "DISMISSED",
      "WARNED",
      "LISTING_HIDDEN",
    ]);
  });

  it("offers blocking only with the account block permission", () => {
    expect(resolveOutcomeOptions({ canHide: false, canBlockAccounts: true })).toEqual([
      "DISMISSED",
      "WARNED",
      "ACCOUNT_BLOCKED",
    ]);
  });

  it("offers every outcome with both permissions", () => {
    expect(resolveOutcomeOptions({ canHide: true, canBlockAccounts: true })).toHaveLength(4);
  });

  it("recognises the stale report error by its message key", () => {
    expect(isStaleReportError(apiError(409, DIRECTORY_API_MESSAGE_KEYS.reportStale))).toBe(true);
    expect(isStaleReportError(apiError(409, DIRECTORY_API_MESSAGE_KEYS.reportCannotHide))).toBe(
      false,
    );
    expect(isStaleReportError(new Error("boom"))).toBe(false);
  });

  it("reports the age of the oldest report in the largest whole unit", () => {
    const now = new Date("2026-10-24T12:00:00.000Z");
    expect(reportAgeOf("2026-10-24T11:59:50.000Z", now)).toEqual({ unit: "minutes", count: 1 });
    expect(reportAgeOf("2026-10-24T11:15:00.000Z", now)).toEqual({ unit: "minutes", count: 45 });
    expect(reportAgeOf("2026-10-24T07:00:00.000Z", now)).toEqual({ unit: "hours", count: 5 });
    expect(reportAgeOf("2026-10-21T11:00:00.000Z", now)).toEqual({ unit: "days", count: 3 });
  });
});
