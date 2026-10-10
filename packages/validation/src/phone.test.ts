import { describe, expect, it } from "vitest";
import { normalizePhoneToE164, phoneE164Schema } from "./phone.js";

describe("normalizePhoneToE164", () => {
  it.each([
    ["01712345678", "+8801712345678"],
    ["8801712345678", "+8801712345678"],
    ["+8801712345678", "+8801712345678"],
    ["+880 1712-345678", "+8801712345678"],
    ["017 1234 5678", "+8801712345678"],
    ["+14155552671", "+14155552671"],
  ])("turns %s into %s", (input, expected) => {
    expect(normalizePhoneToE164(input)).toBe(expected);
  });

  it.each([
    ["a 10-digit Bangladesh number without the leading zero", "1712345678"],
    ["letters", "01712abc678"],
    ["an empty string", ""],
    ["an unknown operator digit", "01212345678"],
    ["too few digits after the plus sign", "+1234567"],
    ["too many digits after the plus sign", "+1234567890123456"],
    ["a plus sign followed by a zero", "+0171234567"],
  ])("rejects %s", (_description, input) => {
    expect(normalizePhoneToE164(input)).toBeUndefined();
  });
});

describe("phoneE164Schema", () => {
  it("parses a local number into E.164", () => {
    expect(phoneE164Schema.parse("01712345678")).toBe("+8801712345678");
  });

  it("reports an invalid_format issue for a bad number", () => {
    const result = phoneE164Schema.safeParse("12345");

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.code).toBe("invalid_format");
  });
});
