import { describe, expect, it } from "vitest";
import { operatorListHref, operatorsApiPath, parseOperatorQuery } from "./operator-query";

describe("parseOperatorQuery", () => {
  it("reads the status filter and the page", () => {
    expect(parseOperatorQuery({ status: "DISABLED", page: "3" })).toEqual({
      status: "DISABLED",
      page: 3,
    });
  });

  it("ignores an unknown status and a page below 1", () => {
    expect(parseOperatorQuery({ status: "LOCKED", page: "0" })).toEqual({
      status: undefined,
      page: 1,
    });
  });

  it("takes the first value of a repeated parameter", () => {
    expect(parseOperatorQuery({ status: ["ACTIVE", "DISABLED"] }).status).toBe("ACTIVE");
  });
});

describe("operator list paths", () => {
  it("leaves no trace of defaults in the page URL", () => {
    expect(operatorListHref({ status: undefined, page: 1 })).toBe("/operators");
    expect(operatorListHref({ status: "ACTIVE", page: 2 })).toBe("/operators?status=ACTIVE&page=2");
  });

  it("asks the API for one page of at most 100 rows", () => {
    expect(operatorsApiPath({ status: "DISABLED", page: 2 })).toBe(
      "/platform/operators?page=2&limit=20&status=DISABLED",
    );
  });
});
