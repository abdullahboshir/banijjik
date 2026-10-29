import { describe, expect, it } from "vitest";
import {
  IDEMPOTENCY_KEY_HEADER,
  IDEMPOTENCY_MESSAGE_KEYS,
  IDEMPOTENCY_SCOPE_KIND,
  IDEMPOTENCY_STATUS,
} from "./idempotency-contracts.js";

describe("idempotency contracts", () => {
  it("scopes keys by organization, user, or storefront principal", () => {
    expect(Object.keys(IDEMPOTENCY_SCOPE_KIND)).toEqual(["ORGANIZATION", "USER", "STOREFRONT"]);
  });

  it("has the two record states of the claim flow", () => {
    expect(Object.keys(IDEMPOTENCY_STATUS)).toEqual(["IN_PROGRESS", "COMPLETED"]);
  });

  it("names the header exactly as 14-API.md does", () => {
    expect(IDEMPOTENCY_KEY_HEADER).toBe("Idempotency-Key");
  });

  it("has no duplicate message keys and uses only the errors and validation namespaces", () => {
    expect(new Set(IDEMPOTENCY_MESSAGE_KEYS).size).toBe(IDEMPOTENCY_MESSAGE_KEYS.length);
    for (const key of IDEMPOTENCY_MESSAGE_KEYS)
      expect(key).toMatch(/^(errors|validation)\.[a-z_]+$/);
  });
});
