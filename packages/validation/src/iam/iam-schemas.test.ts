import { describe, expect, it } from "vitest";
import { loginRequestSchema } from "./login.schema.js";
import { meUpdateRequestSchema } from "./me-update.schema.js";
import { userRegisterRequestSchema } from "./user-register.schema.js";

describe("userRegisterRequestSchema", () => {
  it("normalizes email and phone and keeps the password untouched", () => {
    const parsed = userRegisterRequestSchema.parse({
      name: "  Rahim ",
      email: "Rahim@Example.com",
      phone: "01712345678",
      password: " keep my spaces ",
    });

    expect(parsed).toEqual({
      name: "Rahim",
      email: "rahim@example.com",
      phone: "+8801712345678",
      password: " keep my spaces ",
    });
  });

  it("rejects a field it does not know, such as a status", () => {
    const result = userRegisterRequestSchema.safeParse({
      name: "Rahim",
      email: "rahim@example.com",
      password: "long enough password",
      status: "ACTIVE",
    });

    expect(result.error?.issues[0]?.code).toBe("unrecognized_keys");
  });

  it("rejects a missing password", () => {
    const result = userRegisterRequestSchema.safeParse({ name: "Rahim", email: "r@example.com" });

    expect(result.error?.issues[0]?.path).toEqual(["password"]);
  });
});

describe("loginRequestSchema", () => {
  it("classifies the identifier", () => {
    const parsed = loginRequestSchema.parse({ identifier: "01712345678", password: "x" });

    expect(parsed.identifier).toEqual({ kind: "PHONE", value: "+8801712345678" });
  });

  it("rejects a missing identifier at the identifier path", () => {
    const result = loginRequestSchema.safeParse({ password: "x" });

    expect(result.error?.issues[0]?.path).toEqual(["identifier"]);
  });
});

describe("meUpdateRequestSchema", () => {
  it("requires the version", () => {
    expect(meUpdateRequestSchema.safeParse({ name: "Karim" }).success).toBe(false);
  });

  it("accepts a name change with the version", () => {
    expect(meUpdateRequestSchema.parse({ name: " Karim ", version: 3 })).toEqual({
      name: "Karim",
      version: 3,
    });
  });

  it("rejects a locale outside bn and en", () => {
    expect(meUpdateRequestSchema.safeParse({ preferredLocale: "fr", version: 1 }).success).toBe(
      false,
    );
  });
});
