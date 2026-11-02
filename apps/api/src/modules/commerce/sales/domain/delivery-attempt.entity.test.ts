import { ERROR_CODE } from "@banijjik/contracts";
import { SALES_DELIVERY_FAIL_REASON } from "@banijjik/contracts/sales/delivery";
import { newId, type OrderId, type OrganizationId, type UserId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import { DeliveryAttempt } from "./delivery-attempt.entity.js";

const NOW = new Date("2026-10-31T08:00:00.000Z");
const ACTOR = newId() as UserId;
const ORGANIZATION_ID = newId() as OrganizationId;
const ORDER_ID = newId() as OrderId;
const CONSIGNMENT_ID = newId();
const ASSIGNMENT_ID = newId();

describe("DeliveryAttempt", () => {
  it("starts a courier attempt with only a consignment link", () => {
    const attempt = DeliveryAttempt.start({
      organizationId: ORGANIZATION_ID,
      orderId: ORDER_ID,
      ordinal: 1,
      dispatch: { method: "COURIER", consignmentId: CONSIGNMENT_ID },
      actorUserId: ACTOR,
      now: NOW,
    });

    expect(attempt.method).toBe("COURIER");
    expect(attempt.consignmentId).toBe(CONSIGNMENT_ID);
    expect(attempt.deliveryAssignmentId).toBeNull();
    expect(attempt.failedAt).toBeNull();
    expect(attempt.ordinal).toBe(1);
    expect(attempt.organizationId).toBe(ORGANIZATION_ID);
    expect(attempt.orderId).toBe(ORDER_ID);
  });

  it("starts an own-rider attempt with only an assignment link", () => {
    const attempt = DeliveryAttempt.start({
      organizationId: ORGANIZATION_ID,
      orderId: ORDER_ID,
      ordinal: 2,
      dispatch: { method: "OWN_RIDER", deliveryAssignmentId: ASSIGNMENT_ID },
      actorUserId: ACTOR,
      now: NOW,
    });

    expect(attempt.method).toBe("OWN_RIDER");
    expect(attempt.consignmentId).toBeNull();
    expect(attempt.deliveryAssignmentId).toBe(ASSIGNMENT_ID);
  });

  it("refuses a non-positive ordinal", () => {
    expect(() =>
      DeliveryAttempt.start({
        organizationId: ORGANIZATION_ID,
        orderId: ORDER_ID,
        ordinal: 0,
        dispatch: { method: "COURIER", consignmentId: CONSIGNMENT_ID },
        actorUserId: ACTOR,
        now: NOW,
      }),
    ).toThrow(expect.objectContaining({ code: ERROR_CODE.VALIDATION_ERROR }));
  });

  it("records a failure reason and timestamp", () => {
    const attempt = DeliveryAttempt.start({
      organizationId: ORGANIZATION_ID,
      orderId: ORDER_ID,
      ordinal: 1,
      dispatch: { method: "COURIER", consignmentId: CONSIGNMENT_ID },
      actorUserId: ACTOR,
      now: NOW,
    });
    const failedAt = new Date("2026-10-31T10:00:00.000Z");
    const failed = attempt.markFailed({
      reasonKey: SALES_DELIVERY_FAIL_REASON.REFUSED,
      actorUserId: ACTOR,
      now: failedAt,
    });

    expect(failed.failedAt).toEqual(failedAt);
    expect(failed.reasonKey).toBe(SALES_DELIVERY_FAIL_REASON.REFUSED);
    expect(failed.note).toBeNull();
  });

  it("requires a note when the fail reason is OTHER", () => {
    const attempt = DeliveryAttempt.start({
      organizationId: ORGANIZATION_ID,
      orderId: ORDER_ID,
      ordinal: 1,
      dispatch: { method: "COURIER", consignmentId: CONSIGNMENT_ID },
      actorUserId: ACTOR,
      now: NOW,
    });

    expect(() =>
      attempt.markFailed({
        reasonKey: SALES_DELIVERY_FAIL_REASON.OTHER,
        actorUserId: ACTOR,
        now: NOW,
      }),
    ).toThrow(expect.objectContaining({ code: ERROR_CODE.VALIDATION_ERROR }));
  });
});
