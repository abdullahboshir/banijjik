import { describe, expect, it } from "vitest";
import { parseTenantQuery, tenantListHref, tenantsApiPath } from "./tenant-query";

describe("parseTenantQuery", () => {
  it("reads status, search text and page from the URL", () => {
    expect(parseTenantQuery({ status: "SUSPENDED", q: " acme ", page: "3" })).toEqual({
      status: "SUSPENDED",
      q: "acme",
      page: 3,
    });
  });

  it("ignores anything unreadable instead of failing", () => {
    expect(parseTenantQuery({ status: "NOPE", q: "   ", page: "-2" })).toEqual({
      status: undefined,
      q: undefined,
      page: 1,
    });
  });

  it("takes the first value of a repeated parameter", () => {
    expect(parseTenantQuery({ q: ["one", "two"] }).q).toBe("one");
  });
});

describe("tenant list paths", () => {
  it("leaves no trace of defaults in the page URL", () => {
    expect(tenantListHref({ status: undefined, q: undefined, page: 1 })).toBe("/tenants");
    expect(tenantListHref({ status: "ACTIVE", q: "ac me", page: 2 })).toBe(
      "/tenants?status=ACTIVE&q=ac+me&page=2",
    );
  });

  it("asks the API for one page of at most 100 rows", () => {
    expect(tenantsApiPath({ status: "ACTIVE", q: "acme", page: 2 })).toBe(
      "/platform/organizations?page=2&limit=20&status=ACTIVE&q=acme",
    );
  });
});
