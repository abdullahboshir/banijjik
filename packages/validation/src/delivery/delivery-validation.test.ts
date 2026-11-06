import { newId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import {
  createDeliveryAssignmentRequestSchema,
  deliveryAssignmentListQuerySchema,
  recordRiderCashHandoverRequestSchema,
  reverseRiderCashHandoverRequestSchema,
} from "./delivery-validation.js";

describe("delivery validation schemas", () => {
  it("validates valid delivery assignment creation", () => {
    const valid = {
      orderId: newId(),
      riderMemberId: newId(),
      notes: "Deliver before 5 PM",
      shipOrder: true,
    };
    const parsed = createDeliveryAssignmentRequestSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it("rejects assignment with invalid UUID", () => {
    const invalid = {
      orderId: "not-a-uuid",
      riderMemberId: newId(),
    };
    const parsed = createDeliveryAssignmentRequestSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  it("validates assignment list query filters", () => {
    const query = {
      page: 1,
      limit: 20,
      orderId: newId(),
      riderMemberId: newId(),
      status: "ASSIGNED",
    };
    const parsed = deliveryAssignmentListQuerySchema.safeParse(query);
    expect(parsed.success).toBe(true);
  });

  it("validates rider cash handover recording", () => {
    const valid = {
      riderMemberId: newId(),
      paymentIds: [newId(), newId()],
      receivedVia: "CASH",
      businessDate: "2026-11-06",
    };
    const parsed = recordRiderCashHandoverRequestSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it("validates handover reversal request", () => {
    const valid = {
      version: 1,
      reason: "Cash counted wrong, corrected",
      approvalToken: "appr-token-123",
    };
    const parsed = reverseRiderCashHandoverRequestSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });
});
