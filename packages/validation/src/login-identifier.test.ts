import { describe, expect, it } from "vitest";
import { loginIdentifierSchema } from "./login-identifier.js";

describe("loginIdentifierSchema", () => {
  it("classifies something with an @ as an email and normalizes it", () => {
    expect(loginIdentifierSchema.parse(" Rahim@Example.com ")).toEqual({
      kind: "EMAIL",
      value: "rahim@example.com",
    });
  });

  it("classifies anything else as a phone number and returns E.164", () => {
    expect(loginIdentifierSchema.parse("01712-345678")).toEqual({
      kind: "PHONE",
      value: "+8801712345678",
    });
  });

  it("reports an invalid phone number on the identifier field", () => {
    const result = loginIdentifierSchema.safeParse("not a phone");

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.code).toBe("invalid_format");
  });

  it("reports an empty identifier as too small", () => {
    const result = loginIdentifierSchema.safeParse("   ");

    expect(result.error?.issues[0]?.code).toBe("too_small");
  });
});
