import { CURRENCY_CODE, ERROR_CODE } from "@banijjik/contracts";
import { DELIVERY_ZONE_STATUS } from "@banijjik/contracts/sales";
import { isUuidV7, newId, type OrganizationId, type UserId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import { DeliveryZone } from "./delivery-zone.entity.js";

const NOW = new Date("2026-10-31T08:00:00.000Z");
const ACTOR = newId() as UserId;
const ORGANIZATION_ID = newId() as OrganizationId;

function createInput(
  overrides: Partial<Parameters<typeof DeliveryZone.create>[0]> = {},
): Parameters<typeof DeliveryZone.create>[0] {
  return {
    organizationId: ORGANIZATION_ID,
    zoneKey: "dhaka-north",
    name: { bn: "ঢাকা উত্তর", en: "Dhaka North" },
    areaCodes: ["Mirpur", "Gulshan"],
    fee: { amount: 8000, currency: CURRENCY_CODE.BDT },
    status: DELIVERY_ZONE_STATUS.ACTIVE,
    actorUserId: ACTOR,
    now: NOW,
    ...overrides,
  };
}

describe("DeliveryZone", () => {
  it("normalizes area codes on write and keeps zoneKey as given", () => {
    const zone = DeliveryZone.create(createInput({ areaCodes: [" Mirpur ", "GULSHAN"] }));

    expect(zone.areaCodes).toEqual(["mirpur", "gulshan"]);
    expect(zone.zoneKey).toBe("dhaka-north");
    expect(zone.version).toBe(1);
    expect(isUuidV7(zone.deliveryZoneId)).toBe(true);
  });

  it("refuses a zone whose areaCodes contain a duplicate after trim and case-fold", () => {
    expect(() => DeliveryZone.create(createInput({ areaCodes: ["Mirpur", "mirpur"] }))).toThrow(
      expect.objectContaining({ code: ERROR_CODE.DUPLICATE, details: { field: "areaCodes" } }),
    );
  });

  it("refuses an areaCode outside the 1–50 trimmed bound", () => {
    expect(() => DeliveryZone.create(createInput({ areaCodes: ["a".repeat(51)] }))).toThrow(
      expect.objectContaining({ code: ERROR_CODE.VALIDATION_ERROR }),
    );
    expect(() => DeliveryZone.create(createInput({ areaCodes: ["   "] }))).toThrow(
      expect.objectContaining({ code: ERROR_CODE.VALIDATION_ERROR }),
    );
  });

  it("refuses an empty area-code list", () => {
    expect(() => DeliveryZone.create(createInput({ areaCodes: [] }))).toThrow(
      expect.objectContaining({ code: ERROR_CODE.VALIDATION_ERROR }),
    );
  });

  it("does not let withChanges rewrite zoneKey", () => {
    const zone = DeliveryZone.create(createInput());
    const edited = zone.withChanges(
      { name: { bn: "নতুন", en: "New" }, status: DELIVERY_ZONE_STATUS.INACTIVE },
      ACTOR,
      new Date("2026-10-31T09:00:00.000Z"),
    );

    expect(edited.zoneKey).toBe(zone.zoneKey);
    expect(edited.name.en).toBe("New");
    expect(edited.status).toBe(DELIVERY_ZONE_STATUS.INACTIVE);
    expect(edited.deliveryZoneId).toBe(zone.deliveryZoneId);
  });

  it("normalizes replacement area codes on edit", () => {
    const zone = DeliveryZone.create(createInput());
    const edited = zone.withChanges({ areaCodes: [" Banani "] }, ACTOR, NOW);

    expect(edited.areaCodes).toEqual(["banani"]);
  });

  it("refuses a non-integer or negative fee", () => {
    expect(() =>
      DeliveryZone.create(createInput({ fee: { amount: 80.5, currency: CURRENCY_CODE.BDT } })),
    ).toThrow(expect.objectContaining({ code: ERROR_CODE.VALIDATION_ERROR }));
    expect(() =>
      DeliveryZone.create(createInput({ fee: { amount: -1, currency: CURRENCY_CODE.BDT } })),
    ).toThrow(expect.objectContaining({ code: ERROR_CODE.VALIDATION_ERROR }));
  });

  it("does not fold area codes on restore", () => {
    const zone = DeliveryZone.create(createInput());
    const restored = DeliveryZone.restore({ ...zone, areaCodes: ["Mirpur"] });

    expect(restored.areaCodes).toEqual(["Mirpur"]);
  });
});
