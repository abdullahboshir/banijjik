import { ERROR_CODE } from "@banijjik/contracts";
import { describe, expect, it } from "vitest";
import { ApiError } from "../lib/api/api-error";
import { failureOfAssignmentError } from "./assignment-errors";

const ROWS = [
  { roleId: "r1", locationId: "l1" },
  { roleId: "r2", locationId: "l1" },
];

function apiError(
  code: ApiError["code"],
  status: number,
  details?: Record<string, unknown>,
): ApiError {
  return new ApiError({ status, code, messageKey: "errors.internal", details });
}

describe("failureOfAssignmentError", () => {
  it("puts a field error from the API on the row and field its path names", () => {
    const failure = failureOfAssignmentError(
      apiError(ERROR_CODE.VALIDATION_ERROR, 400, {
        fields: [{ path: "assignments.1.locationId", messageKey: "validation.invalid_value" }],
      }),
      ROWS,
    );
    expect(failure.rowErrors).toEqual({ 1: { locationId: "validation.invalid_value" } });
    expect(failure.formMessageKey).toBeUndefined();
  });

  it("shows ROLE_NOT_GRANTABLE on the row that uses the refused role", () => {
    const failure = failureOfAssignmentError(
      apiError(ERROR_CODE.BUSINESS_RULE, 422, { ruleKey: "ROLE_NOT_GRANTABLE", roleId: "r2" }),
      ROWS,
    );
    expect(failure.rowErrors).toEqual({ 1: { roleId: "errors.role_not_grantable" } });
  });

  it("reports a stale version as a conflict, with no row error", () => {
    const failure = failureOfAssignmentError(apiError(ERROR_CODE.CONFLICT, 409), ROWS);
    expect(failure).toEqual({ rowErrors: {}, isConflict: true });
  });

  it("falls back to a message under the form for an error that belongs to no row", () => {
    const failure = failureOfAssignmentError(apiError(ERROR_CODE.INTERNAL, 500), ROWS);
    expect(failure.formMessageKey).toBe("errors.internal");
  });
});
