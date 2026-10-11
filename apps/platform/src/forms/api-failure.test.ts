import { ApiError } from "@banijjik/web-client";
import { describe, expect, it } from "vitest";
import { failureOf } from "./api-failure";

const knowsEverything = (): boolean => true;
const knowsNothing = (): boolean => false;

function refusal(fields: Partial<ConstructorParameters<typeof ApiError>[0]> = {}): ApiError {
  return new ApiError({
    status: 422,
    code: "BUSINESS_RULE",
    messageKey: "errors.package_in_use",
    ...fields,
  });
}

describe("failureOf", () => {
  it("keeps the message key of an API refusal that the catalog knows", () => {
    expect(failureOf(refusal(), knowsEverything)).toEqual({
      messageKey: "errors.package_in_use",
      gaps: [],
    });
  });

  it("falls back to the generic error for a key the catalog does not know", () => {
    expect(failureOf(refusal(), knowsNothing).messageKey).toBe("errors.internal");
  });

  it("reads which dependency a package misses", () => {
    const error = refusal({
      messageKey: "errors.package_not_closed",
      details: {
        gaps: [{ moduleKey: "pos", missingDependency: "sales" }, "junk", { moduleKey: 1 }],
      },
    });
    expect(failureOf(error, knowsEverything).gaps).toEqual([
      { moduleKey: "pos", missingDependency: "sales" },
    ]);
  });

  it("shows the wait of a rate limit in minutes", () => {
    const error = refusal({ status: 429, code: "RATE_LIMITED", retryAfterSeconds: 90 });
    expect(failureOf(error, knowsEverything)).toMatchObject({
      messageKey: "auth.rateLimited",
      values: { minutes: 2 },
    });
  });

  it("turns anything that is not an ApiError into the generic error", () => {
    expect(failureOf(new TypeError("boom"), knowsEverything).messageKey).toBe("errors.internal");
  });
});
