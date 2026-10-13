import { describe, expect, it } from "vitest";
import { maskIdentifier } from "./mask-identifier.js";

describe("maskIdentifier", () => {
  it("keeps the first letter and the domain of an email", () => {
    expect(maskIdentifier({ email: "rahim@example.com" })).toBe("r***@example.com");
  });

  it("keeps only the last four digits of a phone number", () => {
    expect(maskIdentifier({ phoneE164: "+8801712345678" })).toBe("**********5678");
  });

  it("prefers the email when both exist and never leaks the local part", () => {
    const masked = maskIdentifier({ email: "owner@shop.bd", phoneE164: "+8801712345678" });

    expect(masked).toBe("o***@shop.bd");
    expect(masked).not.toContain("wner");
  });

  it("shows only the mask for an account with neither", () => {
    expect(maskIdentifier({})).toBe("***");
  });
});
