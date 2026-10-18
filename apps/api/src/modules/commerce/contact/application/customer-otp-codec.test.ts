import { describe, expect, it } from "vitest";
import {
  generateCustomerRefreshToken,
  generateOtpCode,
  hashCustomerRefreshToken,
  hashOtpCode,
  openOtpCode,
  sameHash,
  sealOtpCode,
} from "./customer-otp-codec.js";

const SECRET = "test-only-otp-secret-0123456789abcdef0123";
const PHONE = "+8801712345678";

describe("one-time codes", () => {
  it("are six digits, leading zeros kept", () => {
    for (let round = 0; round < 200; round += 1) {
      expect(generateOtpCode()).toMatch(/^[0-9]{6}$/);
    }
  });

  it("hash the same for the same phone and code, and differently for another phone or secret", () => {
    const hash = hashOtpCode(SECRET, PHONE, "123456");

    expect(hashOtpCode(SECRET, PHONE, "123456")).toBe(hash);
    expect(hashOtpCode(SECRET, "+8801712345679", "123456")).not.toBe(hash);
    expect(hashOtpCode(`${SECRET}x`, PHONE, "123456")).not.toBe(hash);
    expect(sameHash(hash, hashOtpCode(SECRET, PHONE, "123456"))).toBe(true);
    expect(sameHash(hash, hashOtpCode(SECRET, PHONE, "123457"))).toBe(false);
  });

  it("are sealed so that only the secret opens them", () => {
    const sealed = sealOtpCode(SECRET, "654321");

    expect(sealed).not.toContain("654321");
    expect(openOtpCode(SECRET, sealed)).toBe("654321");
    expect(() => openOtpCode(`${SECRET}x`, sealed)).toThrow();
    expect(sealOtpCode(SECRET, "654321")).not.toBe(sealed);
  });
});

describe("refresh tokens", () => {
  it("are random, and stored only as a hash", () => {
    const token = generateCustomerRefreshToken();

    expect(token).not.toBe(generateCustomerRefreshToken());
    expect(hashCustomerRefreshToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashCustomerRefreshToken(token)).not.toContain(token);
  });
});
