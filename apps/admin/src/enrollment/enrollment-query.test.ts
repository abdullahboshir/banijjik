import { describe, expect, it } from "vitest";
import { enrollmentsQueryString, parseEnrollmentsQuery } from "./enrollment-query";

const PLAN_ID = "01900000-0000-7000-8000-000000000010";

describe("parseEnrollmentsQuery", () => {
  it("defaults to the first page of 25 with no filter", () => {
    expect(parseEnrollmentsQuery({})).toEqual({
      page: 1,
      limit: 25,
      status: undefined,
      offeringId: undefined,
      overdue: false,
    });
  });

  it("reads a valid status, plan, overdue flag and page", () => {
    const query = parseEnrollmentsQuery({
      status: "ACTIVE",
      offeringId: PLAN_ID,
      overdue: "true",
      page: "3",
    });
    expect(query).toMatchObject({ status: "ACTIVE", offeringId: PLAN_ID, overdue: true, page: 3 });
  });

  it("ignores an unknown status, a malformed plan and a negative page", () => {
    const query = parseEnrollmentsQuery({ status: "NOPE", offeringId: "x", page: "-4" });
    expect(query.status).toBeUndefined();
    expect(query.offeringId).toBeUndefined();
    expect(query.page).toBe(1);
  });

  it("builds the API query string from the filters", () => {
    const text = enrollmentsQueryString(
      parseEnrollmentsQuery({ status: "OVERDUE", offeringId: PLAN_ID, overdue: "true" }),
    );
    expect(text).toBe(`page=1&limit=25&status=OVERDUE&offeringId=${PLAN_ID}&overdue=true`);
  });
});
