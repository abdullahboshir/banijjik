import { describe, expect, it } from "vitest";
import { newId } from "@banijjik/ids";
import {
  createConsignmentRequestSchema,
  recordCourierSettlementRequestSchema,
  reverseCourierSettlementRequestSchema,
} from "./courier-validation.js";

describe("courier validation schemas", () => {
  it("accepts a valid create consignment request", () => {
    const valid = {
      orderId: newId(),
      courierKey: "STEADFAST",
      trackingNumber: "SF-12345678",
      shipOrder: true,
    };
    const parsed = createConsignmentRequestSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it("refuses empty or invalid courier key in consignment request", () => {
    const invalid = {
      orderId: newId(),
      courierKey: "INVALID_KEY",
      trackingNumber: "SF-123",
    };
    expect(createConsignmentRequestSchema.safeParse(invalid).success).toBe(false);
  });

  it("accepts a valid record courier settlement request", () => {
    const valid = {
      courierKey: "PATHAO",
      paymentIds: [newId(), newId()],
      courierChargesMinor: 120,
      receivedVia: "BKASH",
      externalReference: "ST-REF-9988",
      businessDate: "2026-11-06",
    };
    const parsed = recordCourierSettlementRequestSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it("refuses settlement with negative courier charges or empty payments", () => {
    expect(
      recordCourierSettlementRequestSchema.safeParse({
        courierKey: "STEADFAST",
        paymentIds: [],
        courierChargesMinor: 10,
        receivedVia: "CASH",
        externalReference: "REF-1",
        businessDate: "2026-11-06",
      }).success,
    ).toBe(false);

    expect(
      recordCourierSettlementRequestSchema.safeParse({
        courierKey: "STEADFAST",
        paymentIds: [newId()],
        courierChargesMinor: -1,
        receivedVia: "CASH",
        externalReference: "REF-1",
        businessDate: "2026-11-06",
      }).success,
    ).toBe(false);
  });

  it("accepts a valid reverse courier settlement request", () => {
    const valid = {
      version: 1,
      reason: "Carrier credited wrong merchant account",
      approvalToken: "token-1234",
    };
    expect(reverseCourierSettlementRequestSchema.safeParse(valid).success).toBe(true);
  });
});
