import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  money,
  offeringsPath,
  startCatalogApi,
  worldFor,
} from "../../../../test-support/catalog-world.js";
import { registerIamApiModels } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import { newId } from "@banijjik/ids";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startCatalogApi();
});

afterAll(async () => {
  await harness.dispose();
});

describe("stock ledger API", () => {
  it("receipts raise on-hand and moving average (1000 @ 50 + 500 @ 80)", async () => {
    const world = await worldFor(harness, RETAIL);
    const locationId = world.locationA1;
    const item = (
      await world.alice.call("post", `/orgs/${world.organizationA}/inventory-items`, {
        name: "Rice",
        baseUnitKey: "GRAM",
      })
    ).body.data;

    const firstReceipt = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/stock/receipts`,
      body: {
        locationId,
        lines: [{ inventoryItemId: item.inventoryItemId, quantity: 1000, unitCost: money(50) }],
      },
      idempotencyKey: newId(),
    });
    expect(firstReceipt.status).toBe(201);
    const secondReceipt = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/stock/receipts`,
      body: {
        locationId,
        lines: [{ inventoryItemId: item.inventoryItemId, quantity: 500, unitCost: money(80) }],
      },
      idempotencyKey: newId(),
    });
    expect(secondReceipt.status).toBe(201);

    const levels = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/stock/levels?locationId=${locationId}&limit=20`,
    );
    expect(levels.status).toBe(200);
    const row = levels.body.data.find(
      (entry: { inventoryItemId: string }) => entry.inventoryItemId === item.inventoryItemId,
    );
    expect(row.onHand).toBe(1500);
    expect(row.averageUnitCost.amount).toBe(60);
    expect(row.inventoryValue.amount).toBe(90_000);
  });

  it("refuses negative stock by default on adjustment", async () => {
    const world = await worldFor(harness, RETAIL);
    const locationId = world.locationA1;
    const item = (
      await world.alice.call("post", `/orgs/${world.organizationA}/inventory-items`, {
        name: "Salt",
        baseUnitKey: "GRAM",
      })
    ).body.data;
    await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/stock/receipts`,
      body: {
        locationId,
        lines: [{ inventoryItemId: item.inventoryItemId, quantity: 5, unitCost: money(10) }],
      },
      idempotencyKey: newId(),
    });
    const adjust = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/stock/adjustments`,
      body: {
        locationId,
        lines: [
          { inventoryItemId: item.inventoryItemId, quantityDelta: -10, reason: "ADJUSTMENT" },
        ],
      },
      idempotencyKey: newId(),
    });
    expect(adjust.status).toBe(409);
    expect(adjust.body.error.code).toBe("INSUFFICIENT_STOCK");
  });

  it("exposes variant availability from components", async () => {
    const world = await worldFor(harness, RETAIL);
    const locationId = world.locationA1;
    const item = (
      await world.alice.call("post", `/orgs/${world.organizationA}/inventory-items`, {
        name: "Shared rice",
        baseUnitKey: "GRAM",
      })
    ).body.data;
    await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/stock/receipts`,
      body: {
        locationId,
        lines: [{ inventoryItemId: item.inventoryItemId, quantity: 2500, unitCost: money(1) }],
      },
      idempotencyKey: newId(),
    });
    const offering = (
      await world.alice.call("post", offeringsPath(world.organizationA), {
        kind: "PRODUCT",
        name: "Pack",
        variants: [
          {
            price: money(100),
            unitKey: "PIECE",
            stockComponents: [{ inventoryItemId: item.inventoryItemId, quantity: 1000 }],
          },
        ],
      })
    ).body.data;
    const availability = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/offerings/${offering.offeringId}/availability?locationId=${locationId}`,
    );
    expect(availability.body.data.variants[0].availableQuantity).toBe(2);
  });
});
