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

describe("rebuild levels API", () => {
  it("reports no differences after receipts and can fix a corrupted projection", async () => {
    const world = await worldFor(harness, RETAIL);
    const locationId = world.locationA1;
    const item = (
      await world.alice.call("post", `/orgs/${world.organizationA}/inventory-items`, {
        name: "Rebuild rice",
        baseUnitKey: "GRAM",
      })
    ).body.data;
    await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/stock/receipts`,
      body: {
        locationId,
        lines: [{ inventoryItemId: item.inventoryItemId, quantity: 40, unitCost: money(5) }],
      },
      idempotencyKey: newId(),
    });
    const report = await world.alice.call(
      "post",
      `/orgs/${world.organizationA}/inventory/levels/rebuild`,
      { fix: false },
    );
    expect(report.status).toBe(200);
    expect(report.body.data.differenceCount).toBe(0);

    await harness.connections.tenantShared
      .collection("inventory_levels")
      .updateOne(
        { organizationId: world.organizationA, inventoryItemId: item.inventoryItemId, locationId },
        { $set: { onHand: 0 } },
      );
    harness.clock.advanceSeconds(61);
    const broken = await world.alice.call(
      "post",
      `/orgs/${world.organizationA}/inventory/levels/rebuild`,
      { fix: false },
    );
    expect(broken.status).toBe(200);
    expect(broken.body.data.differenceCount).toBeGreaterThan(0);
    harness.clock.advanceSeconds(61);
    const fixed = await world.alice.call(
      "post",
      `/orgs/${world.organizationA}/inventory/levels/rebuild`,
      { fix: true },
    );
    expect(fixed.body.data.fixed).toBe(true);
  });
});
