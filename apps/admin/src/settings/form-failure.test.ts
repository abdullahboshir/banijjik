import { ERROR_CODE } from "@banijjik/contracts";
import { describe, expect, it } from "vitest";
import { ApiError } from "../lib/api/api-error";
import { failureOfApiError } from "./form-failure";

function refusal(code: ApiError["code"], status: number, messageKey = "errors.conflict"): ApiError {
  return new ApiError({ status, code, messageKey });
}

describe("failureOfApiError", () => {
  it("marks a stale version as a conflict", () => {
    const failure = failureOfApiError(refusal(ERROR_CODE.CONFLICT, 409), ["name"]);

    expect(failure.isConflict).toBe(true);
    expect(failure.isLimit).toBe(false);
  });

  it("marks a package limit as its own failure", () => {
    const failure = failureOfApiError(refusal(ERROR_CODE.LIMIT_REACHED, 422), ["name"]);

    expect(failure.isLimit).toBe(true);
    expect(failure.isConflict).toBe(false);
  });

  it("puts any other refusal under the form with the key the API sent", () => {
    const failure = failureOfApiError(
      refusal(ERROR_CODE.BUSINESS_RULE, 422, "errors.location_in_use"),
      ["name"],
    );

    expect(failure.formMessage?.messageKey).toBe("errors.location_in_use");
  });
});
