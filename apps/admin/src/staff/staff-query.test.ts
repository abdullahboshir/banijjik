import { describe, expect, it } from "vitest";
import { membersApiPath, parseStaffQuery, staffListHref } from "./staff-query";

describe("parseStaffQuery", () => {
  it("reads status, search and page from the URL", () => {
    expect(parseStaffQuery({ status: "SUSPENDED", q: " রহিম ", page: "3" })).toEqual({
      status: "SUSPENDED",
      q: "রহিম",
      page: 3,
    });
  });

  it("ignores values it cannot read instead of failing", () => {
    expect(parseStaffQuery({ status: "NOPE", q: "  ", page: "-2" })).toEqual({
      status: undefined,
      q: undefined,
      page: 1,
    });
  });
});

describe("staffListHref", () => {
  it("leaves no trace of defaults in the address", () => {
    expect(
      staffListHref("/acme/settings/staff", { status: undefined, q: undefined, page: 1 }),
    ).toBe("/acme/settings/staff");
    expect(staffListHref("/acme/settings/staff", { status: "ACTIVE", q: "ক", page: 2 })).toBe(
      "/acme/settings/staff?status=ACTIVE&q=%E0%A6%95&page=2",
    );
  });
});

describe("membersApiPath", () => {
  it("asks the API for one page of 20 with the same filters", () => {
    expect(membersApiPath("org-1", { status: "ACTIVE", q: undefined, page: 2 })).toBe(
      "/orgs/org-1/members?page=2&limit=20&status=ACTIVE",
    );
  });
});
