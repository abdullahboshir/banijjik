import { describe, expect, it } from "vitest";
import {
  customerAccountBlockRequestSchema,
  customerAccountEraseRequestSchema,
  customerOtpSendRequestSchema,
  customerOtpVerifyRequestSchema,
  storefrontResolveQuerySchema,
} from "./customer-account.schema.js";

describe("customerOtpSendRequestSchema", () => {
  it("turns a typed phone into E.164", () => {
    expect(customerOtpSendRequestSchema.parse({ phone: "01712-345678" })).toEqual({
      phone: "+8801712345678",
    });
  });

  it.each([{}, { phone: "" }, { phone: "12345" }, { phone: "+8801712345678", extra: 1 }])(
    "refuses %j",
    (body) => {
      expect(customerOtpSendRequestSchema.safeParse(body).success).toBe(false);
    },
  );
});

describe("customerOtpVerifyRequestSchema", () => {
  it("accepts a phone and a code of exactly six digits", () => {
    expect(customerOtpVerifyRequestSchema.parse({ phone: "01712345678", code: "012345" })).toEqual({
      phone: "+8801712345678",
      code: "012345",
    });
  });

  it.each(["12345", "1234567", "12a456", "", " 123456", "١٢٣٤٥٦"])(
    "refuses the code %j",
    (code) => {
      expect(customerOtpVerifyRequestSchema.safeParse({ phone: "01712345678", code }).success).toBe(
        false,
      );
    },
  );
});

describe("storefrontResolveQuerySchema", () => {
  it("accepts a host with or without a port and refuses anything that is not a host", () => {
    expect(storefrontResolveQuerySchema.safeParse({ host: "acme.localhost:3300" }).success).toBe(
      true,
    );
    expect(storefrontResolveQuerySchema.safeParse({ host: "acme.sites.example.com" }).success).toBe(
      true,
    );
    expect(storefrontResolveQuerySchema.safeParse({ host: "http://acme.com" }).success).toBe(false);
    expect(storefrontResolveQuerySchema.safeParse({ host: "a b" }).success).toBe(false);
    expect(storefrontResolveQuerySchema.safeParse({}).success).toBe(false);
  });
});

describe("customerAccountBlockRequestSchema", () => {
  it("needs the version and nothing else", () => {
    expect(customerAccountBlockRequestSchema.safeParse({ version: 2 }).success).toBe(true);
    expect(customerAccountBlockRequestSchema.safeParse({}).success).toBe(false);
    expect(customerAccountBlockRequestSchema.safeParse({ version: 2, reason: "x" }).success).toBe(
      false,
    );
  });
});

describe("customerAccountEraseRequestSchema", () => {
  it("needs challengeId and 6-digit code", () => {
    const valid = {
      challengeId: "018f3b60-1234-7123-8123-123456789abc",
      code: "123456",
    };
    expect(customerAccountEraseRequestSchema.safeParse(valid).success).toBe(true);
    expect(customerAccountEraseRequestSchema.safeParse({ ...valid, code: "12345" }).success).toBe(
      false,
    );
    expect(
      customerAccountEraseRequestSchema.safeParse({ ...valid, challengeId: "not-a-uuid" }).success,
    ).toBe(false);
    expect(customerAccountEraseRequestSchema.safeParse({ ...valid, extra: true }).success).toBe(
      false,
    );
  });
});
