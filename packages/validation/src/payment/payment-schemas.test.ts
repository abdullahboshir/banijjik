import { describe, expect, it } from "vitest";
import {
  adjustStoreCreditRequestSchema,
  receivePaymentRequestSchema,
  refundPaymentRequestSchema,
  reversePaymentRequestSchema,
} from "./payment-schemas.js";

const VALID_UUID = "018f3b1b-7a3d-7b2a-8c9a-1e2f3a4b5c6d";

describe("payment-schemas", () => {
  it("accepts valid CASH receive payment request", () => {
    const parsed = receivePaymentRequestSchema.safeParse({
      locationId: VALID_UUID,
      method: "CASH",
      amount: { amount: 500, currency: "BDT" },
      allocations: [
        {
          requestType: "BOOKING",
          requestId: VALID_UUID,
          amount: { amount: 500, currency: "BDT" },
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("requires externalReference for BKASH", () => {
    const invalid = receivePaymentRequestSchema.safeParse({
      locationId: VALID_UUID,
      method: "BKASH",
      amount: { amount: 500, currency: "BDT" },
      allocations: [],
    });
    expect(invalid.success).toBe(false);

    const valid = receivePaymentRequestSchema.safeParse({
      locationId: VALID_UUID,
      method: "BKASH",
      amount: { amount: 500, currency: "BDT" },
      externalReference: "TRX12345678",
      allocations: [],
    });
    expect(valid.success).toBe(true);
  });

  it("validates refund payment request", () => {
    const parsed = refundPaymentRequestSchema.safeParse({
      locationId: VALID_UUID,
      method: "CASH",
      amount: { amount: 200, currency: "BDT" },
      allocations: [
        {
          requestType: "BOOKING",
          requestId: VALID_UUID,
          amount: { amount: 200, currency: "BDT" },
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("requires approvalToken for reversal", () => {
    const invalid = reversePaymentRequestSchema.safeParse({});
    expect(invalid.success).toBe(false);

    const valid = reversePaymentRequestSchema.safeParse({
      approvalToken: "appr-token-123",
    });
    expect(valid.success).toBe(true);
  });

  it("validates store credit adjustment", () => {
    const valid = adjustStoreCreditRequestSchema.safeParse({
      contactId: VALID_UUID,
      direction: "CREDIT",
      amount: { amount: 100, currency: "BDT" },
      reason: "Customer goodwill",
      approvalToken: "tok_123",
    });
    expect(valid.success).toBe(true);
  });
});
