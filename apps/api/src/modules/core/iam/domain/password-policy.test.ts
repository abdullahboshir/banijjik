import { describe, expect, it } from "vitest";
import { DomainRuleError } from "./errors.js";
import { assertPasswordAcceptable, normalizePassword } from "./password-policy.js";

const SUBJECT = { name: "Rahim Uddin", email: "rahim@example.com", phoneE164: "+8801712345678" };

interface ReportedField {
  readonly messageKey: string;
}

function messageKeyOf(password: string): string | undefined {
  try {
    assertPasswordAcceptable(password, SUBJECT);
  } catch (error) {
    if (!(error instanceof DomainRuleError)) throw error;
    const fields = error.details?.["fields"] as ReportedField[];
    return fields[0]?.messageKey;
  }
  return undefined;
}

describe("assertPasswordAcceptable", () => {
  it("rejects a password shorter than 8 characters", () => {
    expect(messageKeyOf("short1!")).toBe("validation.password_too_short");
  });

  it("accepts exactly 8 characters and exactly 128 characters", () => {
    expect(messageKeyOf("abcdefgh")).toBeUndefined();
    expect(messageKeyOf("a".repeat(128))).toBeUndefined();
  });

  it("rejects a password longer than 128 characters", () => {
    expect(messageKeyOf("a".repeat(129))).toBe("validation.password_too_long");
  });

  it("rejects the email, in any letter case", () => {
    expect(messageKeyOf("Rahim@Example.com")).toBe("validation.password_too_similar");
  });

  it("rejects the phone number in international and local form", () => {
    expect(messageKeyOf("+8801712345678")).toBe("validation.password_too_similar");
    expect(messageKeyOf("8801712345678")).toBe("validation.password_too_similar");
    expect(messageKeyOf("01712345678")).toBe("validation.password_too_similar");
  });

  it("rejects the name, in any letter case", () => {
    expect(messageKeyOf("RAHIM UDDIN")).toBe("validation.password_too_similar");
  });

  it("accepts a Bangla passphrase and counts characters, not bytes", () => {
    expect(messageKeyOf("আমারসোনারবাংলা")).toBeUndefined();
    expect(messageKeyOf("আমার")).toBe("validation.password_too_short");
  });

  it("asks for no digit, symbol or capital letter", () => {
    expect(messageKeyOf("only lowercase words here")).toBeUndefined();
  });
});

describe("normalizePassword", () => {
  it("gives the same text for composed and decomposed forms", () => {
    expect(normalizePassword("é")).toBe(normalizePassword("é"));
  });
});
