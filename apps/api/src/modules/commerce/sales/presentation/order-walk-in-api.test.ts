import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import {
  memberWithRole,
  startCatalogApi,
  worldFor,
} from "../../../../test-support/catalog-world.js";
import {
  registerIamApiModels,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";
import {
  addInventoryItem,
  draftOrder,
  instantOrder,
  listOrders,
  movementsOf,
  ordersPath,
  publishOffering,
  receiveStock,
  shopOf,
  type SalesShop,
} from "../../../../test-support/sales-api-world.js";
import { newId } from "@banijjik/ids";
registerIamApiModels();
const RETAIL = { industryTemplateKey: "RETAIL" };
const SALON = { industryTemplateKey: "SALON" };
let harness: IamApiHarness;
beforeAll(async () => {
  harness = await startCatalogApi();
});
afterAll(async () => {
  await harness.dispose();
});
async function serviceOf(shop: SalesShop) {
  return publishOffering(shop, {
    kind: "SERVICE",
    name: "Haircut",
    priceAmount: 1000,
    kindDetails: { durationMinutes: 30 },
  });
}
function lineOf(offering: { offeringId: string; variantId: string }, quantity = 1) {
  return { ...offering, quantity };
}
describe("walk-in service orders", () => {
  it("an instant sale sells a walk-in service with a product and completes in one request", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL, SALON));
    const service = await serviceOf(shop);
    const inventoryItemId = await addInventoryItem(shop, "Shampoo");
    const product = await publishOffering(shop, {
      kind: "PRODUCT",
      name: "Shampoo",
      priceAmount: 500,
      stockComponents: [{ inventoryItemId, quantity: 1 }],
    });
    await receiveStock(shop, [{ inventoryItemId, quantity: 10, unitCostAmount: 100 }]);
    // Legacy service stock components must never reach the ledger.
    await harness.connections.tenantShared
      .collection("offerings")
      .updateOne(
        { organizationId: shop.organizationId, offeringId: service.offeringId },
        { $set: { "variants.0.stockComponents": [{ inventoryItemId, quantity: 2 }] } },
      );
    const key = newId();
    const body = { locationId: shop.locationId, lines: [lineOf(service), lineOf(product)] };
    const sold = await instantOrder(shop, body, key);
    expect(sold.status).toBe(201);
    expect(sold.order.status).toBe("COMPLETED");
    expect(sold.order.lines).toHaveLength(2);
    expect(sold.order.lines[0]).toMatchObject({ kind: "SERVICE", unitCostSnapshot: null });
    const stored = await harness.connections.tenantShared
      .collection("orders")
      .findOne({ orderId: sold.order.orderId });
    expect(stored?.["lines"][0].costComponents).toEqual([]);
    const movements = (await movementsOf(shop)).filter((row) => row.reason === "SALE");
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({ sourceId: sold.order.orderId, quantityDelta: -1 });
    expect((await instantOrder(shop, body, key)).order.orderId).toBe(sold.order.orderId);
    expect(await listOrders(shop)).toHaveLength(1);
  });
  it("a draft or placed order still refuses a SERVICE line with KIND_NEEDS_BOOKING", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL, SALON));
    const service = await serviceOf(shop);
    const refused = await shop.actor.call("post", ordersPath(shop.organizationId), {
      locationId: shop.locationId,
      lines: [lineOf(service)],
    });
    expect(refused.status).toBe(422);
    expect(refused.body.error.details.ruleKey).toBe("KIND_NEEDS_BOOKING");
    const product = await publishOffering(shop, {
      kind: "PRODUCT",
      name: "Comb",
      priceAmount: 100,
    });
    const draft = await draftOrder(shop, { locationId: shop.locationId, lines: [lineOf(product)] });
    const patch = await shop.actor.call(
      "patch",
      ordersPath(shop.organizationId, `/${draft.orderId}`),
      { version: draft.version, lines: [lineOf(service)] },
    );
    expect(patch.status).toBe(422);
    expect(patch.body.error.details.ruleKey).toBe("KIND_NEEDS_BOOKING");
    // A legacy draft containing a service must fail when placed.
    await harness.connections.tenantShared.collection("orders").updateOne(
      { orderId: draft.orderId },
      {
        $set: {
          "lines.0.offeringId": service.offeringId,
          "lines.0.variantId": service.variantId,
        },
      },
    );
    const placed = await shop.actor.call(
      "post",
      ordersPath(shop.organizationId, `/${draft.orderId}/place`),
      { version: draft.version },
    );
    expect(placed.status).toBe(422);
    expect(placed.body.error.details.ruleKey).toBe("KIND_NEEDS_BOOKING");
  });
  it("a SERVICE line is refused when SERVICE is not an effective kind", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL, SALON));
    const service = await serviceOf(shop);
    await harness.connections.platform
      .collection("organizations")
      .updateOne(
        { organizationId: shop.organizationId },
        { $set: RETAIL, $inc: { configVersion: 1 } },
      );
    const response = await shop.actor.call("post", ordersPath(shop.organizationId, "/instant"), {
      locationId: shop.locationId,
      lines: [lineOf(service)],
    });
    expect(response.status).toBe(422);
    expect(response.body.error.details.ruleKey).toBe("KIND_NEEDS_BOOKING");
    expect(await listOrders(shop)).toEqual([]);
  });
  it("a service quantity must be a whole number", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL, SALON));
    const service = await serviceOf(shop);
    const response = await shop.actor.call("post", ordersPath(shop.organizationId, "/instant"), {
      locationId: shop.locationId,
      lines: [lineOf(service, 1.5)],
    });
    expect(response.status).toBe(400);
    expect(response.body.error.details.fields).toContainEqual({
      path: "lines.0.quantity",
      messageKey: "validation.invalid_type",
    });
    expect(await listOrders(shop)).toEqual([]);
  });
  it("another organization's service cannot be sold", async () => {
    const world = await worldFor(harness, RETAIL, SALON);
    const service = await serviceOf(shopOf(world));
    const other = {
      actor: world.bob,
      organizationId: world.organizationB,
      locationId: world.locationB1,
    };
    const response = await instantOrder(other, {
      locationId: other.locationId,
      lines: [lineOf(service)],
    });
    expect([400, 404]).toContain(response.status);
    expect(await listOrders(other)).toEqual([]);
  });
  it("a member without sales.order.create cannot make an instant sale with a service", async () => {
    const world = await worldFor(harness, RETAIL, SALON);
    const shop = shopOf(world);
    const service = await serviceOf(shop);
    const viewer = await memberWithRole(harness, world, SYSTEM_ROLE_KEY.VIEWER);
    const response = await instantOrder(
      { ...shop, actor: viewer },
      { locationId: shop.locationId, lines: [lineOf(service)] },
    );
    expect(response.status).toBe(403);
    expect(await listOrders(shop)).toEqual([]);
  });
});
