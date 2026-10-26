import { ERROR_CODE } from "@banijjik/contracts";
import { SMS_RULE_KEY } from "@banijjik/contracts/sms";
import { ApiError } from "@banijjik/web-client";
import { describe, expect, it } from "vitest";
import { saveFailureOf } from "./sms-gateway-form";

describe("a refused save of the default gateway", () => {
  it("asks for a reload on a stale version", () => {
    const failure = saveFailureOf(
      new ApiError({ status: 409, code: ERROR_CODE.CONFLICT, messageKey: "errors.conflict" }),
    );

    expect(failure).toBe("conflict");
  });

  it("names the missing step of an enabled provider", () => {
    const failure = saveFailureOf(
      new ApiError({
        status: 422,
        code: ERROR_CODE.BUSINESS_RULE,
        messageKey: "errors.business_rule",
        details: { ruleKey: SMS_RULE_KEY.GATEWAY_INCOMPLETE },
      }),
    );

    expect(failure).toBe("incomplete");
  });

  it("shows any other API message under the form, by its key", () => {
    const failure = saveFailureOf(
      new ApiError({ status: 403, code: ERROR_CODE.FORBIDDEN, messageKey: "errors.forbidden" }),
    );

    expect(failure).toEqual({ messageKey: "errors.forbidden" });
  });
});
