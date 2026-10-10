import { describe, expect, it } from "vitest";
import { formatPhoneForDisplay } from "./format-phone.js";

describe("formatPhoneForDisplay", () => {
  it("shows an E.164 Bangladeshi mobile number in the local style", () => {
    expect(formatPhoneForDisplay("+8801712345678")).toBe("01712-345678");
  });

  it("formats a local number the same way", () => {
    expect(formatPhoneForDisplay("01712345678")).toBe("01712-345678");
  });

  it("returns unrecognised input unchanged", () => {
    expect(formatPhoneForDisplay("+14155550123")).toBe("+14155550123");
  });
});
