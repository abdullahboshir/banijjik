import { describe, expect, it } from "vitest";
import { emailSchema } from "./email.js";

describe("emailSchema", () => {
  it("trims and lower-cases the address", () => {
    expect(emailSchema.parse("  Rahim@Example.COM ")).toBe("rahim@example.com");
  });

  it.each(["no-at-sign", "two@@example.com", "spaced out@example.com", "a@b", ""])(
    "rejects %j",
    (input) => {
      expect(emailSchema.safeParse(input).success).toBe(false);
    },
  );

  it("rejects an address longer than 254 characters", () => {
    const tooLong = `${"a".repeat(250)}@example.com`;

    expect(emailSchema.safeParse(tooLong).success).toBe(false);
  });
});
