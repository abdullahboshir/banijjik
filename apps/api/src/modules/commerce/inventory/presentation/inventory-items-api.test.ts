import { newId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { money, startCatalogApi, worldFor } from "../../../../test-support/catalog-world.js";
import { registerIamApiModels } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startCatalogApi();
});

afterAll(async () => {
  await harness.dispose();
});

function itemsPath(organizationId: string, suffix = ""): string {
  return `/orgs/${organizationId}/inventory-items${suffix}`;
}

describe("inventory items API", () => {
  it("creates, reads, updates and archives an item", async () => {
    const world = await worldFor(harness, RETAIL);
    const created = await world.alice.call("post", itemsPath(world.organizationA), {
      name: "Basmati rice",
      baseUnitKey: "GRAM",
      lowStockThreshold: 500,
    });
    expect(created.status).toBe(201);
    const item = created.body.data;
    expect(item).toMatchObject({ name: "Basmati rice", baseUnitKey: "GRAM", status: "ACTIVE" });

    const fetched = await world.alice.call(
      "get",
      itemsPath(world.organizationA, `/${item.inventoryItemId}`),
    );
    expect(fetched.status).toBe(200);

    const updated = await world.alice.call(
      "patch",
      itemsPath(world.organizationA, `/${item.inventoryItemId}`),
      {
        version: item.version,
        name: "Premium basmati",
      },
    );
    expect(updated.body.data.name).toBe("Premium basmati");

    const archived = await world.alice.call(
      "post",
      itemsPath(world.organizationA, `/${item.inventoryItemId}/archive`),
      { version: updated.body.data.version },
    );
    expect(archived.body.data.status).toBe("ARCHIVED");
  });

  it("refuses archive when on-hand stock remains", async () => {
    const world = await worldFor(harness, RETAIL);
    const locationId = world.locationA1;
    const itemRes = await world.alice.call("post", itemsPath(world.organizationA), {
      name: "Oil",
      baseUnitKey: "ML",
    });
    const item = itemRes.body.data;
    await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/stock/receipts`,
      body: {
        locationId,
        lines: [{ inventoryItemId: item.inventoryItemId, quantity: 10, unitCost: money(100) }],
      },
      idempotencyKey: newId(),
    });
    const archived = await world.alice.call(
      "post",
      itemsPath(world.organizationA, `/${item.inventoryItemId}/archive`),
      { version: item.version },
    );
    expect(archived.status).toBe(422);
    expect(archived.body.error.details.ruleKey).toBe("INVENTORY_ITEM_HAS_STOCK");
  });
});
