import { describe, expect, it } from "vitest";
import {
  STATUS_TONE_TABLE,
  statusTone,
  type StatusRequestType,
  type StatusTone,
} from "./status-tone.js";

/** Rows copied by hand from docs/11 section 12, so the test fails if the table drifts. */
const DOC_ROWS: [StatusRequestType, StatusTone, string][] = [
  ["ORDER", "success", "DELIVERED"],
  ["ORDER", "success", "COMPLETED"],
  ["ORDER", "info", "CONFIRMED"],
  ["ORDER", "info", "PACKED"],
  ["ORDER", "info", "SHIPPED"],
  ["ORDER", "warning", "PLACED"],
  ["ORDER", "warning", "DELIVERY_FAILED"],
  ["ORDER", "danger", "CANCELLED"],
  ["ORDER", "danger", "RETURNED_TO_SENDER"],
  ["ORDER", "neutral", "DRAFT"],
  ["BOOKING", "success", "COMPLETED"],
  ["BOOKING", "success", "CHECKED_IN"],
  ["BOOKING", "info", "CONFIRMED"],
  ["BOOKING", "warning", "HELD"],
  ["BOOKING", "warning", "REQUESTED"],
  ["BOOKING", "danger", "CANCELLED"],
  ["BOOKING", "danger", "NO_SHOW"],
  ["ENROLLMENT", "success", "ACTIVE"],
  ["ENROLLMENT", "success", "COMPLETED"],
  ["ENROLLMENT", "warning", "PENDING"],
  ["ENROLLMENT", "warning", "FROZEN"],
  ["ENROLLMENT", "warning", "OVERDUE"],
  ["ENROLLMENT", "danger", "CANCELLED"],
  ["ENROLLMENT", "neutral", "EXPIRED"],
  ["PAYMENT", "success", "PAID"],
  ["PAYMENT", "warning", "PARTIAL"],
  ["PAYMENT", "warning", "UNPAID"],
  ["PAYMENT", "neutral", "REFUNDED"],
  ["PAYMENT", "neutral", "PARTIALLY_REFUNDED"],
  ["SALES_RETURN", "info", "ACTIVE"],
  ["SALES_RETURN", "neutral", "REVERSED"],
];

describe("statusTone", () => {
  it.each(DOC_ROWS)("%s %s is the tone of %s", (requestType, tone, status) => {
    expect(statusTone(requestType, status)).toBe(tone);
  });

  it("has no status beyond the ones the doc lists", () => {
    const tableSize = Object.values(STATUS_TONE_TABLE)
      .flatMap((byTone) => Object.values(byTone))
      .reduce((total, statuses) => total + statuses.length, 0);
    expect(tableSize).toBe(DOC_ROWS.length);
  });

  it("falls back to neutral for an unknown status", () => {
    expect(statusTone("ORDER", "SOMETHING_NEW")).toBe("neutral");
  });

  it("does not leak a status of one request type into another", () => {
    expect(statusTone("PAYMENT", "DELIVERED")).toBe("neutral");
  });
});
