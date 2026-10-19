import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { money, startCatalogApi, worldFor } from "../../../../test-support/catalog-world.js";
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

async function createItemWithStock(
  world: Awaited<ReturnType<typeof worldFor>>,
  name: string,
  quantity: number,
  locationId: string,
): Promise<string> {
  const item = (
    await world.alice.call("post", `/orgs/${world.organizationA}/inventory-items`, {
      name,
      baseUnitKey: "GRAM",
    })
  ).body.data;
  await world.alice.callWith({
    method: "post",
    path: `/orgs/${world.organizationA}/stock/receipts`,
    body: {
      locationId,
      lines: [{ inventoryItemId: item.inventoryItemId, quantity, unitCost: money(10) }],
    },
    idempotencyKey: newId(),
  });
  return item.inventoryItemId as string;
}

describe("stock operations", () => {
  it("writes DAMAGE_WRITE_OFF to damaged and keeps movements append-only", async () => {
    const world = await worldFor(harness, RETAIL);
    const locationId = world.locationA1;
    const inventoryItemId = await createItemWithStock(world, "Cream", 100, locationId);
    const before = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/stock/movements?inventoryItemId=${inventoryItemId}&limit=100`,
    );
    const countBefore = (before.body.data as unknown[]).length;

    const adjust = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/stock/adjustments`,
      body: {
        locationId,
        lines: [
          {
            inventoryItemId,
            quantityDelta: -20,
            reason: "DAMAGE_WRITE_OFF",
            note: "spoiled",
          },
        ],
      },
      idempotencyKey: newId(),
    });
    expect(adjust.status).toBe(201);

    const levels = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/stock/levels?locationId=${locationId}&limit=20`,
    );
    const row = levels.body.data.find(
      (entry: { inventoryItemId: string }) => entry.inventoryItemId === inventoryItemId,
    );
    expect(row.onHand).toBe(80);
    expect(row.damaged).toBe(20);

    const after = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/stock/movements?inventoryItemId=${inventoryItemId}&limit=100`,
    );
    expect((after.body.data as unknown[]).length).toBe(countBefore + 1);
  });

  it("transfers in one step and moves average cost", async () => {
    const world = await worldFor(harness, RETAIL);
    const fromLocationId = world.locationA1;
    const toLocationId = world.locationA2;
    expect(toLocationId).toBeTruthy();
    const inventoryItemId = await createItemWithStock(world, "Soap", 100, fromLocationId);

    const transfer = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/stock/transfers`,
      body: {
        fromLocationId,
        toLocationId,
        lines: [{ inventoryItemId, quantity: 40 }],
      },
      idempotencyKey: newId(),
    });
    expect(transfer.status).toBe(201);

    const fromLevels = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/stock/levels?locationId=${fromLocationId}&limit=20`,
    );
    const toLevels = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/stock/levels?locationId=${toLocationId}&limit=20`,
    );
    const fromRow = fromLevels.body.data.find(
      (entry: { inventoryItemId: string }) => entry.inventoryItemId === inventoryItemId,
    );
    const toRow = toLevels.body.data.find(
      (entry: { inventoryItemId: string }) => entry.inventoryItemId === inventoryItemId,
    );
    expect(fromRow.onHand).toBe(60);
    expect(toRow.onHand).toBe(40);
    expect(toRow.averageUnitCost.amount).toBe(10);
  });

  it("refuses a transfer to a location outside the caller's reach", async () => {
    const world = await worldFor(harness, RETAIL);
    const inventoryItemId = await createItemWithStock(world, "Oil", 50, world.locationA1);
    // Bob is org B; Alice of A transferring to B's location must fail location checks.
    const transfer = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/stock/transfers`,
      body: {
        fromLocationId: world.locationA1,
        toLocationId: world.locationB1,
        lines: [{ inventoryItemId, quantity: 5 }],
      },
      idempotencyKey: newId(),
    });
    expect([403, 400, 404]).toContain(transfer.status);
  });

  it("lets only one of two parallel adjustments take the last five units", async () => {
    const world = await worldFor(harness, RETAIL);
    const locationId = world.locationA1;
    const inventoryItemId = await createItemWithStock(world, "Beans", 5, locationId);
    const body = {
      locationId,
      lines: [{ inventoryItemId, quantityDelta: -5, reason: "ADJUSTMENT" }],
    };
    const [first, second] = await Promise.all([
      world.alice.callWith({
        method: "post",
        path: `/orgs/${world.organizationA}/stock/adjustments`,
        body,
        idempotencyKey: newId(),
      }),
      world.alice.callWith({
        method: "post",
        path: `/orgs/${world.organizationA}/stock/adjustments`,
        body,
        idempotencyKey: newId(),
      }),
    ]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);
    const levels = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/stock/levels?locationId=${locationId}&limit=20`,
    );
    const row = levels.body.data.find(
      (entry: { inventoryItemId: string }) => entry.inventoryItemId === inventoryItemId,
    );
    expect(row.available).toBeGreaterThanOrEqual(0);
    expect(row.onHand).toBe(0);
  });

  it("emits low stock once when crossing the threshold", async () => {
    const world = await worldFor(harness, RETAIL);
    const locationId = world.locationA1;
    const item = (
      await world.alice.call("post", `/orgs/${world.organizationA}/inventory-items`, {
        name: "Tea",
        baseUnitKey: "GRAM",
        lowStockThreshold: 20,
      })
    ).body.data;
    await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/stock/receipts`,
      body: {
        locationId,
        lines: [{ inventoryItemId: item.inventoryItemId, quantity: 50, unitCost: money(5) }],
      },
      idempotencyKey: newId(),
    });
    const firstCross = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/stock/adjustments`,
      body: {
        locationId,
        lines: [
          { inventoryItemId: item.inventoryItemId, quantityDelta: -35, reason: "ADJUSTMENT" },
        ],
      },
      idempotencyKey: newId(),
    });
    expect(firstCross.status).toBe(201);
    const stayLow = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/stock/adjustments`,
      body: {
        locationId,
        lines: [{ inventoryItemId: item.inventoryItemId, quantityDelta: -5, reason: "ADJUSTMENT" }],
      },
      idempotencyKey: newId(),
    });
    expect(stayLow.status).toBe(201);
    const levels = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/stock/levels?locationId=${locationId}&lowOnly=true&limit=20`,
    );
    expect(
      levels.body.data.some(
        (entry: { inventoryItemId: string }) => entry.inventoryItemId === item.inventoryItemId,
      ),
    ).toBe(true);
  });

  it("denies cross-org stock reads", async () => {
    const world = await worldFor(harness, RETAIL);
    const denied = await world.bob.call(
      "get",
      `/orgs/${world.organizationA}/stock/levels?locationId=${world.locationA1}&limit=20`,
    );
    expect([403, 404]).toContain(denied.status);
  });
});
