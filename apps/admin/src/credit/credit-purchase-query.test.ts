import { describe, expect, it } from "vitest";
import {
  creditPurchasesApiQuery,
  creditPurchasesHasNext,
  creditPurchasesHref,
  parseCreditPurchasesQuery,
} from "./credit-purchase-query";

describe("credit purchases query", () => {
  it("shows waiting purchases when no status is given", () => {
    expect(parseCreditPurchasesQuery({})).toEqual({
      status: "PENDING",
      q: undefined,
      page: 1,
    });
  });

  it("lifts the default with ALL and falls back to waiting for an unknown status", () => {
    expect(parseCreditPurchasesQuery({ status: "ALL" }).status).toBeUndefined();
    expect(parseCreditPurchasesQuery({ status: "BOGUS" }).status).toBe("PENDING");
    expect(parseCreditPurchasesQuery({ status: "VERIFIED" }).status).toBe("VERIFIED");
  });

  it("trims the search text, drops an empty one and floors the page", () => {
    expect(parseCreditPurchasesQuery({ q: "  trx1  ", page: "2.9" })).toMatchObject({
      q: "trx1",
      page: 2,
    });
    expect(parseCreditPurchasesQuery({ q: "   ", page: "0" })).toMatchObject({
      q: undefined,
      page: 1,
    });
  });

  it("builds the API query with the filters and a bounded page size", () => {
    const query = parseCreditPurchasesQuery({ status: "REJECTED", q: "ab", page: "3" });
    const params = new URLSearchParams(creditPurchasesApiQuery(query));
    expect(params.get("status")).toBe("REJECTED");
    expect(params.get("q")).toBe("ab");
    expect(params.get("page")).toBe("3");
    expect(params.get("limit")).toBe("50");
  });

  it("knows when another page follows", () => {
    const query = parseCreditPurchasesQuery({});
    expect(creditPurchasesHasNext(query, 50)).toBe(false);
    expect(creditPurchasesHasNext(query, 51)).toBe(true);
  });

  it("keeps every filter in a page link and leaves page 1 out", () => {
    const base = "/acme/credit/purchases";
    const first = parseCreditPurchasesQuery({ status: "ALL", q: "x" });
    expect(creditPurchasesHref(base, first)).toBe(`${base}?status=ALL&q=x`);
    expect(creditPurchasesHref(base, { ...first, page: 2 })).toBe(`${base}?status=ALL&q=x&page=2`);
  });
});
