import { describe, expect, it } from "vitest";
import {
  creditPaymentMethodsSettingSchema,
  creditPurchaseRejectRequestSchema,
  creditPurchaseSubmitRequestSchema,
  creditPurchaseVerifyRequestSchema,
  creditPurchasesStaffQuerySchema,
  transactionReferenceSchema,
} from "./credit-schemas.js";

describe("credit validation schemas", () => {
  it("normalizes and validates a transaction reference (trimmed, upper-cased, 6-30 alphanumeric)", () => {
    expect(transactionReferenceSchema.parse("  trx12345  ")).toBe("TRX12345");
    expect(transactionReferenceSchema.safeParse("123").success).toBe(false);
    expect(transactionReferenceSchema.safeParse("abc-123").success).toBe(false);
  });

  it("reports the standard invalid_format issue, not a custom English message", () => {
    const result = transactionReferenceSchema.safeParse("abc-123");
    const issue = result.error?.issues[0];
    expect(issue?.code).toBe("invalid_format");
    expect(issue?.message).not.toContain("transaction reference");
  });

  it("validates credit purchase submission request", () => {
    const valid = {
      creditPackId: "01926b48-1234-7abc-8def-0123456789ab",
      method: "BKASH",
      senderPhone: "01712345678",
      transactionReference: "bkashref123",
    };
    const parsed = creditPurchaseSubmitRequestSchema.parse(valid);
    expect(parsed.senderPhone).toBe("+8801712345678");
    expect(parsed.transactionReference).toBe("BKASHREF123");
  });

  it("validates credit purchase verify request", () => {
    expect(creditPurchaseVerifyRequestSchema.parse({ version: 1 })).toEqual({ version: 1 });
    expect(
      creditPurchaseVerifyRequestSchema.parse({ version: 2, approvalToken: "token-123" }),
    ).toEqual({ version: 2, approvalToken: "token-123" });
  });

  it("validates credit purchase reject request", () => {
    expect(
      creditPurchaseRejectRequestSchema.parse({ version: 1, reason: "Invalid transaction ID" }),
    ).toEqual({ version: 1, reason: "Invalid transaction ID" });
    expect(creditPurchaseRejectRequestSchema.safeParse({ version: 1, reason: "" }).success).toBe(
      false,
    );
  });

  it("validates credit payment methods setting", () => {
    const setting = [
      {
        method: "BKASH",
        accountNumber: "01711000000",
        accountType: "Merchant",
        instructions: {
          bn: "বিকাশ মার্চেন্ট নাম্বারে পেমেন্ট করুন",
          en: "Pay to the bKash merchant number",
        },
      },
    ];
    expect(creditPaymentMethodsSettingSchema.parse(setting)).toEqual(setting);
    expect(creditPaymentMethodsSettingSchema.safeParse([]).success).toBe(true);
  });

  it("validates credit purchases staff query", () => {
    expect(
      creditPurchasesStaffQuerySchema.parse({
        page: "1",
        limit: "20",
        status: "PENDING",
        q: "TRX123",
      }),
    ).toEqual({
      page: 1,
      limit: 20,
      status: "PENDING",
      q: "TRX123",
    });
  });
});
