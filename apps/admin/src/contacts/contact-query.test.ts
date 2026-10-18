import { describe, expect, it } from "vitest";
import { contactListHref, contactsApiPath, parseContactQuery } from "./contact-query";

describe("parseContactQuery", () => {
  it("reads the role, status, search text and page from the URL", () => {
    expect(
      parseContactQuery({ role: "RELATED", status: "ARCHIVED", q: "  রহিম ", page: "3" }),
    ).toEqual({ role: "RELATED", status: "ARCHIVED", q: "রহিম", page: 3 });
  });

  it("ignores anything unreadable instead of failing", () => {
    expect(parseContactQuery({ role: "WIZARD", status: "DELETED", q: "  ", page: "-2" })).toEqual({
      role: undefined,
      status: "ACTIVE",
      q: undefined,
      page: 1,
    });
    expect(parseContactQuery({ page: ["2", "5"], q: ["a", "b"] })).toMatchObject({
      page: 2,
      q: "a",
    });
  });
});

describe("contactListHref", () => {
  it("leaves the defaults out of the URL", () => {
    const base = { role: undefined, status: "ACTIVE" as const, q: undefined, page: 1 };

    expect(contactListHref("/acme/contacts", base)).toBe("/acme/contacts");
    expect(
      contactListHref("/acme/contacts", {
        ...base,
        role: "SUPPLIER",
        status: "ARCHIVED",
        q: "bd",
        page: 2,
      }),
    ).toBe("/acme/contacts?role=SUPPLIER&status=ARCHIVED&q=bd&page=2");
  });
});

describe("contactsApiPath", () => {
  it("asks for one page of at most 20, with the filters", () => {
    const path = contactsApiPath("org-1", {
      role: "CUSTOMER",
      status: "ACTIVE",
      q: "017",
      page: 2,
    });

    expect(path).toBe("/orgs/org-1/contacts?page=2&limit=20&status=ACTIVE&role=CUSTOMER&q=017");
  });
});
