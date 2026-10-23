import { describe, expect, it } from "vitest";
import { parsePaymentsQuery, paymentsApiQuery } from "./payment-query";

describe("parsePaymentsQuery", () => {
  it("defaults to page 1, 50 limit and undefined filters", () => {
    const query = parsePaymentsQuery({});
    expect(query).toEqual({
      page: 1,
      limit: 50,
      method: undefined,
      direction: undefined,
      locationId: undefined,
      from: undefined,
      to: undefined,
    });
  });

  it("parses valid method, direction, location, date and page filters", () => {
    const query = parsePaymentsQuery({
      method: "BKASH",
      direction: "IN",
      locationId: "loc-123",
      from: "2026-10-01",
      to: "2026-10-31",
      page: "3",
    });
    expect(query).toEqual({
      page: 3,
      limit: 50,
      method: "BKASH",
      direction: "IN",
      locationId: "loc-123",
      from: "2026-10-01",
      to: "2026-10-31",
    });
  });

  it("ignores unknown methods or directions", () => {
    const query = parsePaymentsQuery({
      method: "UNKNOWN_METHOD",
      direction: "UNKNOWN_DIRECTION",
      page: "-5",
    });
    expect(query.method).toBeUndefined();
    expect(query.direction).toBeUndefined();
    expect(query.page).toBe(1);
  });

  it("builds API query string correctly", () => {
    const queryString = paymentsApiQuery({
      page: 2,
      limit: 50,
      method: "CASH",
      direction: "REFUND",
      locationId: "loc-1",
      from: "2026-10-01",
      to: "2026-10-15",
    });
    expect(queryString).toBe(
      "page=2&limit=50&method=CASH&direction=REFUND&locationId=loc-1&from=2026-10-01&to=2026-10-15",
    );
  });
});
