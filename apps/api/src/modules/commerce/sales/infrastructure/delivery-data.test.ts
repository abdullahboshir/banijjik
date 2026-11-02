import { CURRENCY_CODE, ERROR_CODE } from "@banijjik/contracts";
import { DELIVERY_ZONE_STATUS } from "@banijjik/contracts/sales/delivery";
import { newId, type OrderId, type OrganizationId, type UserId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { initializeModels, models, type DatabaseConnections } from "../../../../kernel/db/index.js";
import { withOrganizationContext } from "../../../../test-support/organization-context.js";
import {
  connectTestDatabases,
  disposeTestDatabases,
  installTestLogger,
} from "../../../../test-support/test-databases.js";
import { DeliveryAttempt } from "../domain/delivery-attempt.entity.js";
import { DeliveryZone } from "../domain/delivery-zone.entity.js";
import { DELIVERY_ATTEMPT_MODEL_NAME } from "./delivery-attempt.schema.js";
import { DELIVERY_ZONE_MODEL_NAME } from "./delivery-zone.schema.js";
import { MongoDeliveryAttemptRepository } from "./mongo-delivery-attempt.repository.js";
import { MongoDeliveryZoneRepository } from "./mongo-delivery-zone.repository.js";
import { registerSalesModels } from "./register-sales-models.js";

registerSalesModels();

const NOW = new Date("2026-10-31T08:00:00.000Z");
const ACTOR = newId() as UserId;
const zones = new MongoDeliveryZoneRepository();
const attempts = new MongoDeliveryAttemptRepository();

let connections: DatabaseConnections;

beforeAll(async () => {
  installTestLogger();
  connections = await connectTestDatabases();
  await initializeModels();
  await models({}).get(DELIVERY_ZONE_MODEL_NAME).createIndexes();
  await models({}).get(DELIVERY_ATTEMPT_MODEL_NAME).createIndexes();
});

afterAll(async () => {
  await disposeTestDatabases(connections);
});

function aZone(
  organizationId: OrganizationId,
  overrides: Partial<Parameters<typeof DeliveryZone.create>[0]> = {},
): DeliveryZone {
  return DeliveryZone.create({
    organizationId,
    zoneKey: overrides.zoneKey ?? `zone-${newId().slice(-8)}`,
    name: { bn: "ঢাকা", en: "Dhaka" },
    areaCodes: overrides.areaCodes ?? ["dhanmondi"],
    fee: { amount: 5000, currency: CURRENCY_CODE.BDT },
    status: DELIVERY_ZONE_STATUS.ACTIVE,
    actorUserId: ACTOR,
    now: NOW,
    ...overrides,
  });
}

function insertZone(zone: DeliveryZone): Promise<void> {
  return withOrganizationContext(zone.organizationId, () => zones.insert(zone));
}

function insertAttempt(attempt: DeliveryAttempt): Promise<void> {
  return withOrganizationContext(attempt.organizationId, () => attempts.insert(attempt));
}

describe("delivery zone indexes", () => {
  it("syncIndexes accepts the delivery_zones unique and partial unique definitions", async () => {
    const indexes = await connections.tenantShared.collection("delivery_zones").indexes();
    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: { organizationId: 1, deliveryZoneId: 1 }, unique: true }),
        expect.objectContaining({ key: { organizationId: 1, zoneKey: 1 }, unique: true }),
        expect.objectContaining({
          key: { organizationId: 1, areaCodes: 1 },
          unique: true,
          partialFilterExpression: { status: DELIVERY_ZONE_STATUS.ACTIVE },
        }),
        expect.objectContaining({ key: { organizationId: 1, createdAt: -1, deliveryZoneId: 1 } }),
      ]),
    );
  });

  it("creates the partial unique index on active area codes", async () => {
    const indexes = await connections.tenantShared.collection("delivery_zones").indexes();
    const activeArea = indexes.find(
      (index) => index.partialFilterExpression?.["status"] === DELIVERY_ZONE_STATUS.ACTIVE,
    );
    expect(activeArea).toMatchObject({
      key: { organizationId: 1, areaCodes: 1 },
      unique: true,
    });
  });

  it("unique index refuses a second ACTIVE zone claiming the same organizationId and areaCode", async () => {
    const organizationId = newId() as OrganizationId;
    await insertZone(aZone(organizationId, { areaCodes: ["mirpur"] }));

    await expect(
      insertZone(aZone(organizationId, { areaCodes: ["mirpur"], zoneKey: "other-mirpur" })),
    ).rejects.toMatchObject({ code: ERROR_CODE.CONFLICT });
  });

  it("refuses a concurrent second claim of the same active area", async () => {
    const organizationId = newId() as OrganizationId;
    const results = await Promise.allSettled([
      insertZone(aZone(organizationId, { areaCodes: ["tejgaon"], zoneKey: "tejgaon-a" })),
      insertZone(aZone(organizationId, { areaCodes: ["tejgaon"], zoneKey: "tejgaon-b" })),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.filter((result) => result.status === "rejected");
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toMatchObject({
      status: "rejected",
      reason: expect.objectContaining({ code: ERROR_CODE.CONFLICT }),
    });
  });

  it("an INACTIVE zone releases the area so a new ACTIVE zone may claim it", async () => {
    const organizationId = newId() as OrganizationId;
    const first = aZone(organizationId, { areaCodes: ["banani"], zoneKey: "banani-old" });
    await insertZone(first);
    const inactive = first.withChanges(
      { status: DELIVERY_ZONE_STATUS.INACTIVE },
      ACTOR,
      new Date("2026-10-31T09:00:00.000Z"),
    );
    await withOrganizationContext(organizationId, () => zones.update(inactive, first.version));

    await expect(
      insertZone(aZone(organizationId, { areaCodes: ["banani"], zoneKey: "banani-new" })),
    ).resolves.toBeUndefined();
  });

  it("allows the same active area in another organization", async () => {
    const firstOrg = newId() as OrganizationId;
    await insertZone(aZone(firstOrg, { areaCodes: ["gulshan"] }));
    await expect(
      insertZone(aZone(newId() as OrganizationId, { areaCodes: ["gulshan"] })),
    ).resolves.toBeUndefined();
  });

  it("inserts an ACTIVE delivery zone and findActiveByAreaCode returns it for the claiming areaCode", async () => {
    const organizationId = newId() as OrganizationId;
    const zone = aZone(organizationId, { areaCodes: ["uttara"] });
    await insertZone(zone);

    const found = await withOrganizationContext(organizationId, () =>
      zones.findActiveByAreaCode({ organizationId, areaCode: " Uttara " }),
    );
    expect(found?.deliveryZoneId).toBe(zone.deliveryZoneId);
  });

  it("findById in organization A does not return a zone inserted for organization B", async () => {
    const ownerId = newId() as OrganizationId;
    const otherId = newId() as OrganizationId;
    const zone = aZone(ownerId, { areaCodes: ["motijheel"] });
    await insertZone(zone);

    const hidden = await withOrganizationContext(otherId, () =>
      zones.findById(otherId, zone.deliveryZoneId),
    );
    const own = await withOrganizationContext(ownerId, () =>
      zones.findById(ownerId, zone.deliveryZoneId),
    );
    expect(hidden).toBeUndefined();
    expect(own?.organizationId).toBe(ownerId);
    expect(own?.deliveryZoneId).toBe(zone.deliveryZoneId);
    const stored = await connections.tenantShared
      .collection("delivery_zones")
      .findOne({ deliveryZoneId: zone.deliveryZoneId });
    expect(stored?.["organizationId"]).toBe(ownerId);
    expect(stored).not.toHaveProperty("locationId");
  });

  it("rejects a stale version with 409 CONFLICT", async () => {
    const organizationId = newId() as OrganizationId;
    const zone = aZone(organizationId, { areaCodes: ["wari"] });
    await insertZone(zone);
    const renamed = zone.withChanges({ name: { bn: "ওয়ারী", en: "Wari" } }, ACTOR, NOW);
    await withOrganizationContext(organizationId, () => zones.update(renamed, zone.version));

    const error = await withOrganizationContext(organizationId, () =>
      zones.update(renamed, zone.version),
    ).catch((caught: unknown) => caught);

    expect(error).toMatchObject({ code: "CONFLICT", details: { currentVersion: 2 } });
  });
});

describe("delivery attempt indexes", () => {
  it("syncIndexes accepts the delivery_attempts unique definitions", async () => {
    const indexes = await connections.tenantShared.collection("delivery_attempts").indexes();
    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: { organizationId: 1, deliveryAttemptId: 1 },
          unique: true,
        }),
        expect.objectContaining({
          key: { organizationId: 1, orderId: 1, ordinal: 1 },
          unique: true,
        }),
        expect.objectContaining({ key: { organizationId: 1, orderId: 1, startedAt: -1 } }),
      ]),
    );
  });

  it("unique index refuses two delivery attempts with the same organizationId, orderId, and ordinal", async () => {
    const organizationId = newId() as OrganizationId;
    const orderId = newId() as OrderId;
    const first = DeliveryAttempt.start({
      organizationId,
      orderId,
      ordinal: 1,
      dispatch: { method: "COURIER", consignmentId: newId() },
      actorUserId: ACTOR,
      now: NOW,
    });
    await insertAttempt(first);

    const duplicate = DeliveryAttempt.start({
      organizationId,
      orderId,
      ordinal: 1,
      dispatch: { method: "COURIER", consignmentId: newId() },
      actorUserId: ACTOR,
      now: NOW,
    });
    await expect(insertAttempt(duplicate)).rejects.toMatchObject({ code: ERROR_CODE.CONFLICT });
  });

  it("findById in organization A does not return an attempt inserted for organization B", async () => {
    const ownerId = newId() as OrganizationId;
    const otherId = newId() as OrganizationId;
    const attempt = DeliveryAttempt.start({
      organizationId: ownerId,
      orderId: newId() as OrderId,
      ordinal: 1,
      dispatch: { method: "COURIER", consignmentId: newId() },
      actorUserId: ACTOR,
      now: NOW,
    });
    await insertAttempt(attempt);
    const hidden = await withOrganizationContext(otherId, () =>
      attempts.findById(otherId, attempt.deliveryAttemptId),
    );
    expect(hidden).toBeUndefined();
  });

  it("stores tenant fields and lists by order", async () => {
    const organizationId = newId() as OrganizationId;
    const orderId = newId() as OrderId;
    const attempt = DeliveryAttempt.start({
      organizationId,
      orderId,
      ordinal: 1,
      dispatch: { method: "OWN_RIDER", deliveryAssignmentId: newId() },
      actorUserId: ACTOR,
      now: NOW,
    });
    await insertAttempt(attempt);

    const page = await withOrganizationContext(organizationId, () =>
      attempts.listByOrder({ organizationId, orderId, page: 1, limit: 50 }),
    );
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.organizationId).toBe(organizationId);
    expect(page.items[0]?.orderId).toBe(orderId);
    expect(page.hasNext).toBe(false);
  });
});

describe("tenant fields", () => {
  it("zone and attempt documents persist organizationId, version, createdAt, updatedAt, createdByUserId, updatedByUserId", async () => {
    const organizationId = newId() as OrganizationId;
    const zone = aZone(organizationId, { areaCodes: ["savar"] });
    await insertZone(zone);
    const storedZone = await withOrganizationContext(organizationId, () =>
      zones.findById(organizationId, zone.deliveryZoneId),
    );
    expect(storedZone).toMatchObject({
      organizationId,
      version: 1,
      createdAt: NOW,
      updatedAt: NOW,
      createdByUserId: ACTOR,
      updatedByUserId: ACTOR,
    });

    const attempt = DeliveryAttempt.start({
      organizationId,
      orderId: newId() as OrderId,
      ordinal: 1,
      dispatch: { method: "COURIER", consignmentId: newId() },
      actorUserId: ACTOR,
      now: NOW,
    });
    await insertAttempt(attempt);
    const storedAttempt = await withOrganizationContext(organizationId, () =>
      attempts.findById(organizationId, attempt.deliveryAttemptId),
    );
    expect(storedAttempt).toMatchObject({
      organizationId,
      version: 1,
      createdAt: NOW,
      updatedAt: NOW,
      createdByUserId: ACTOR,
      updatedByUserId: ACTOR,
    });
  });
});
