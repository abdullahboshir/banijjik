import { newId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { money, startCatalogApi, worldFor } from "../../../../test-support/catalog-world.js";
import {
  registerIamApiModels,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";
import {
  addCustomer,
  confirmOrder,
  draftOrder,
  getOrder,
  ordersPath,
  placeOrder,
  publishOffering,
  shopOf,
  type SalesShop,
} from "../../../../test-support/sales-api-world.js";

registerIamApiModels();
let harness: IamApiHarness;
beforeAll(async () => {
  harness = await startCatalogApi();
});
afterAll(async () => {
  await harness.dispose();
});

async function fixture(status: "PLACED" | "CONFIRMED") {
  const shop = shopOf(await worldFor(harness, { industryTemplateKey: "RETAIL" }));
  const product = await publishOffering(shop, { kind: "PRODUCT", name: "Tea", priceAmount: 1000 });
  const oldContactId = await addCustomer(shop, "Rahim", "+8801700000001");
  const newContactId = await addCustomer(shop, "Karim", "+8801700000002");
  const lines = [{ ...product, quantity: 1 }];
  const draft = await draftOrder(shop, {
    locationId: shop.locationId,
    contactId: oldContactId,
    lines,
  });
  const placed = await placeOrder(shop, draft);
  expect(placed.status).toBe(200);
  const order = status === "CONFIRMED" ? await confirmOrder(shop, placed.order) : placed.order;
  return { shop, order, oldContactId, newContactId, lines };
}

function payment(shop: SalesShop, orderId: string, refund = false) {
  return shop.actor.callWith({
    method: "post",
    path: `/orgs/${shop.organizationId}/${refund ? "refunds" : "payments"}`,
    idempotencyKey: newId(),
    body: {
      locationId: shop.locationId,
      method: "CASH",
      amount: money(500),
      allocations: [{ requestType: "ORDER", requestId: orderId, amount: money(500) }],
    },
  });
}

async function dues(shop: SalesShop, contactId: string) {
  const response = await shop.actor.call(
    "get",
    `/orgs/${shop.organizationId}/dues?requestType=ORDER&contactId=${contactId}`,
  );
  expect(response.status).toBe(200);
  return response.body.data as readonly { requestId: string }[];
}

function summary(shop: SalesShop, orderId: string) {
  return harness.connections.tenantShared
    .collection("payment_summaries")
    .findOne({ organizationId: shop.organizationId, requestType: "ORDER", requestId: orderId });
}

describe("order contact changes and payments", () => {
  it.each(["PLACED", "CONFIRMED"] as const)(
    "moves an unpaid %s order summary and dues to the new contact",
    async (status) => {
      const { shop, order, oldContactId, newContactId } = await fixture(status);
      const changed = await shop.actor.call(
        "patch",
        ordersPath(shop.organizationId, `/${order.orderId}`),
        { version: order.version, contactId: newContactId },
      );
      expect(changed.status).toBe(200);
      expect(changed.body.data.contactId).toBe(newContactId);
      expect(changed.body.data.version).toBe(order.version + 1);
      expect((await summary(shop, order.orderId))?.["contactId"]).toBe(newContactId);
      expect(await dues(shop, oldContactId)).toEqual([]);
      expect(await dues(shop, newContactId)).toEqual([
        expect.objectContaining({ requestId: order.orderId }),
      ]);
    },
  );

  it.each(["PLACED", "CONFIRMED"] as const)(
    "refuses a paid %s order contact change with ORDER_CONTACT_LOCKED_BY_PAYMENT and changes nothing",
    async (status) => {
      const { shop, order, oldContactId, newContactId, lines } = await fixture(status);
      expect((await payment(shop, order.orderId)).status).toBe(201);
      const before = await getOrder(shop, order.orderId);
      const summaryBefore = await summary(shop, order.orderId);
      const refused = await shop.actor.call(
        "patch",
        ordersPath(shop.organizationId, `/${order.orderId}`),
        {
          version: order.version,
          contactId: newContactId,
          lines: lines.map((line) => ({ ...line, quantity: 2 })),
        },
      );
      expect(refused.status).toBe(422);
      expect(refused.body.error.details.ruleKey).toBe("ORDER_CONTACT_LOCKED_BY_PAYMENT");
      expect(await getOrder(shop, order.orderId)).toEqual(before);
      expect(await summary(shop, order.orderId)).toEqual(summaryBefore);
      expect(await dues(shop, newContactId)).toEqual([]);
      expect(await dues(shop, oldContactId)).toEqual([
        expect.objectContaining({ requestId: order.orderId }),
      ]);
    },
  );

  it("allows changing the contact after all net paid money is refunded", async () => {
    const { shop, order, newContactId } = await fixture("PLACED");
    expect((await payment(shop, order.orderId)).status).toBe(201);
    expect((await payment(shop, order.orderId, true)).status).toBe(201);
    const changed = await shop.actor.call(
      "patch",
      ordersPath(shop.organizationId, `/${order.orderId}`),
      { version: order.version, contactId: newContactId },
    );
    expect(changed.status).toBe(200);
    expect((await summary(shop, order.orderId))?.["contactId"]).toBe(newContactId);
    expect(await dues(shop, newContactId)).toEqual([
      expect.objectContaining({ requestId: order.orderId }),
    ]);
  });
});
