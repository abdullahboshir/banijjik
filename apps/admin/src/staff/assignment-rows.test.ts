import { describe, expect, it } from "vitest";
import { DUPLICATE_ROW_KEY, emptyRow, toAssignmentRequests, validateRows } from "./assignment-rows";

describe("validateRows", () => {
  it("asks for a role and, with several locations, for a location", () => {
    expect(validateRows([emptyRow(false)], false)).toEqual({
      0: { roleId: "validation.required", locationId: "validation.required" },
    });
  });

  it("does not ask for a location in a one-location business", () => {
    expect(validateRows([{ roleId: "r1", locationId: "" }], true)).toEqual({});
  });

  it("marks the row that repeats the same role at the same location", () => {
    const rows = [
      { roleId: "r1", locationId: "l1" },
      { roleId: "r1", locationId: "l1" },
      { roleId: "r1", locationId: "l2" },
    ];
    expect(validateRows(rows, false)).toEqual({ 1: { roleId: DUPLICATE_ROW_KEY } });
  });
});

describe("toAssignmentRequests", () => {
  it("sends ALL for every row of a one-location business", () => {
    expect(toAssignmentRequests([{ roleId: "r1", locationId: "" }], true)).toEqual([
      { roleId: "r1", locationId: "ALL" },
    ]);
  });
});
