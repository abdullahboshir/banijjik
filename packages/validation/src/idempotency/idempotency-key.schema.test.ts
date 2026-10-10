import { newId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import { idempotencyKeySchema } from "./idempotency-key.schema.js";

describe("idempotencyKeySchema", () => {
  it("accepts a UUID v7", () => {
    const key = newId();
    expect(idempotencyKeySchema.parse(key)).toBe(key);
  });

  it("accepts a UUID v4 and lowercases it", () => {
    const parsed = idempotencyKeySchema.parse("3F2504E0-4F89-41D3-9A0C-0305E82C3301");
    expect(parsed).toBe("3f2504e0-4f89-41d3-9a0c-0305e82c3301");
  });

  it("rejects anything that is not a UUID", () => {
    for (const bad of ["", "not-a-uuid", "12345", "3f2504e0-4f89-41d3-9a0c-0305e82c33"]) {
      expect(idempotencyKeySchema.safeParse(bad).success, bad).toBe(false);
    }
  });
});
