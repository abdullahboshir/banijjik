import { SALES_DELIVERY_FAIL_REASON } from "@banijjik/contracts/sales/delivery";
import { newId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import {
  createDeliveryZoneRequestSchema,
  deliveryAddressSchema,
  deliveryFailedRequestSchema,
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
