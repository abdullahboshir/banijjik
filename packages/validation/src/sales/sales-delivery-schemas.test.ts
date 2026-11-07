import { SALES_DELIVERY_FAIL_REASON } from "@banijjik/contracts/sales/delivery";
import { newId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import {
  createDeliveryZoneRequestSchema,
  deliverOrderRequestSchema,
  deliveryAddressSchema,
  deliveryFailedRequestSchema,
  deliveryZoneListQuerySchema,
  receiveRtsRequestSchema,
  reconcileDeliveryLossRequestSchema,
  recoverDeliveryLossRequestSchema,
  shipOrderRequestSchema,
} from "./sales-delivery-schemas.js";

describe("deliveryAddressSchema", () => {
  it("stores a local phone as E.164", () => {
    const parsed = deliveryAddressSchema.parse({
      recipientName: "Rahim",
      phoneE164: "01712345678",
      addressLine: "House 1",
      districtCode: "dhaka",
      areaCode: "mirpur",
    });
    expect(parsed.phoneE164).toBe("+8801712345678");
    expect(parsed.postalCode).toBeNull();
  });
});

describe("createDeliveryZoneRequestSchema", () => {
  it("refuses a zone whose areaCodes contain a duplicate after trim and case-fold", () => {
    const result = createDeliveryZoneRequestSchema.safeParse({
      zoneKey: "dhaka-north",
      name: { bn: "ঢাকা", en: "Dhaka" },
      areaCodes: ["Mirpur", "mirpur"],
      feeMinor: 8000,
      status: "ACTIVE",
    });
    expect(result.success).toBe(false);
  });

  it("refuses an areaCode outside the 1–50 trimmed bound", () => {
    const tooLong = "a".repeat(51);
    const result = createDeliveryZoneRequestSchema.safeParse({
      zoneKey: "dhaka-north",
      name: { bn: "ঢাকা", en: "Dhaka" },
      areaCodes: [tooLong],
      feeMinor: 8000,
      status: "ACTIVE",
    });
    expect(result.success).toBe(false);
  });

  it("refuses a negative fee", () => {
    const result = createDeliveryZoneRequestSchema.safeParse({
      zoneKey: "dhaka-north",
      name: { bn: "ঢাকা", en: "Dhaka" },
      areaCodes: ["mirpur"],
      feeMinor: -1,
      status: "ACTIVE",
    });
    expect(result.success).toBe(false);
  });
});

describe("deliveryZoneListQuerySchema", () => {
  it("defaults the page size to 50 and refuses a limit above 100", () => {
    expect(deliveryZoneListQuerySchema.parse({})).toEqual({ page: 1, limit: 50 });
    expect(deliveryZoneListQuerySchema.safeParse({ limit: "101" }).success).toBe(false);
  });
});

describe("shipOrderRequestSchema", () => {
  it("accepts a courier dispatch", () => {
    const parsed = shipOrderRequestSchema.parse({
      version: 1,
      dispatch: { method: "COURIER", consignmentId: newId() },
    });
    expect(parsed.dispatch.method).toBe("COURIER");
  });
});

describe("deliveryFailedRequestSchema", () => {
  it("requires a note when the reason is OTHER", () => {
    const result = deliveryFailedRequestSchema.safeParse({
      version: 1,
      reasonKey: SALES_DELIVERY_FAIL_REASON.OTHER,
    });
    expect(result.success).toBe(false);
  });
});

describe("receiveRtsRequestSchema", () => {
  it("parses valid RTS request with disposition", () => {
    const parsed = receiveRtsRequestSchema.parse({
      version: 2,
      reasonKey: "CUSTOMER_UNAVAILABLE",
      restockDisposition: "RESTOCK",
      note: "Customer rejected after 3 attempts",
    });
    expect(parsed.version).toBe(2);
    expect(parsed.restockDisposition).toBe("RESTOCK");
  });

  it("refuses invalid restock disposition", () => {
    const result = receiveRtsRequestSchema.safeParse({
      version: 1,
      restockDisposition: "DISCARD",
    });
    expect(result.success).toBe(false);
  });
});

describe("deliverOrderRequestSchema", () => {
  it("parses valid deliver order request", () => {
    const parsed = deliverOrderRequestSchema.parse({
      version: 3,
      note: "Delivered to reception",
    });
    expect(parsed.version).toBe(3);
    expect(parsed.note).toBe("Delivered to reception");
  });
});

describe("reconcileDeliveryLossRequestSchema", () => {
  it("parses valid loss reconciliation with lost units", () => {
    const parsed = reconcileDeliveryLossRequestSchema.parse({
      expectedVersion: 2,
      reasonKey: "LOST_IN_TRANSIT",
      approvalToken: "tok-123",
      lines: [
        {
          orderLineId: newId(),
          restockQuantity: 1,
          damagedQuantity: 0,
          lostQuantity: 1,
        },
      ],
    });
    expect(parsed.expectedVersion).toBe(2);
    expect(parsed.lines).toHaveLength(1);
  });

  it("refuses reconciliation when 0 units are lost", () => {
    const result = reconcileDeliveryLossRequestSchema.safeParse({
      expectedVersion: 2,
      reasonKey: "LOST_IN_TRANSIT",
      approvalToken: "tok-123",
      lines: [
        {
          orderLineId: newId(),
          restockQuantity: 2,
          damagedQuantity: 0,
          lostQuantity: 0,
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe("recoverDeliveryLossRequestSchema", () => {
  it("parses valid physical recovery request", () => {
    const parsed = recoverDeliveryLossRequestSchema.parse({
      expectedVersion: 1,
      approvalToken: "tok-456",
      lines: [
        {
          orderLineId: newId(),
          restockQuantity: 1,
          damagedQuantity: 0,
        },
      ],
    });
    expect(parsed.expectedVersion).toBe(1);
    expect(parsed.lines).toHaveLength(1);
  });

  it("refuses recovery with 0 recovered units", () => {
    const result = recoverDeliveryLossRequestSchema.safeParse({
      expectedVersion: 1,
      approvalToken: "tok-456",
      lines: [
        {
          orderLineId: newId(),
          restockQuantity: 0,
          damagedQuantity: 0,
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});
