import { addMemberWithAssignments, findSystemRoleId } from "../../../../test-support/rbac-world.js";
import { SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  memberWithRole,
  money,
  startCatalogApi,
  worldFor,
} from "../../../../test-support/catalog-world.js";
import {
  registerIamApiModels,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";
import {
  addCustomer,
  draftOrder,
  instantOrder,
  ordersPath,
  placeOrder,
  publishOffering,
  setSetting,
  shopOf,
  type SalesShop,
} from "../../../../test-support/sales-api-world.js";
import type { OrderRow } from "../../../../test-support/sales-api-rows.js";
import { MongoPaymentSummaryRepository } from "../../payment/index.js";

registerIamApiModels();
const RETAIL = { industryTemplateKey: "RETAIL" };
let harness: IamApiHarness;
beforeAll(async () => {
  harness = await startCatalogApi();
});
afterAll(async () => {
  await harness.dispose();
});

let customerNumber = 0;

async function drafted(shop: SalesShop, quantity = 1) {
  const product = await publishOffering(shop, { kind: "PRODUCT", name: "Tea", priceAmount: 1000 });
  customerNumber += 1;
  const phone = `+88017${String(customerNumber).padStart(8, "0")}`;
  const contactId = await addCustomer(shop, "Rahim", phone);
  const lines = [{ ...product, quantity }];
  const order = await draftOrder(shop, { locationId: shop.locationId, contactId, lines });
  return { order, contactId, lines };
}

async function placed(shop: SalesShop, quantity = 1) {
  const draft = await drafted(shop, quantity);
  const result = await placeOrder(shop, draft.order);
  expect(result.status).toBe(200);
  return { ...draft, order: result.order };
}

function pay(shop: SalesShop, orderId: string, amount: number, key = newId(), refund = false) {
  return shop.actor.callWith({
    method: "post",
    path: `/orgs/${shop.organizationId}/${refund ? "refunds" : "payments"}`,
    idempotencyKey: key,
    body: {
      locationId: shop.locationId,
      method: "CASH",
      amount: money(amount),
      allocations: [{ requestType: "ORDER", requestId: orderId, amount: money(amount) }],
    },
  });
}

async function detail(shop: SalesShop, orderId: string): Promise<OrderRow> {
  const response = await shop.actor.call("get", ordersPath(shop.organizationId, `/${orderId}`));
  expect(response.status).toBe(200);
  return response.body.data as OrderRow;
}

function cancel(shop: SalesShop, order: OrderRow) {
  return shop.actor.call("post", ordersPath(shop.organizationId, `/${order.orderId}/cancel`), {
    version: order.version,
    reason: "Customer cancelled",
  });
}

describe("orders as payment requests", () => {
  it("refuses an approval snapshot in the body of POST /refunds (plan 3.5b amendment 1)", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const { order } = await placed(shop);
    const response = await shop.actor.callWith({
      method: "post",
      path: `/orgs/${shop.organizationId}/refunds`,
      idempotencyKey: newId(),
      body: {
        locationId: shop.locationId,
        method: "CASH",
        amount: money(100),
        approvalSnapshot: {
          approvalId: newId(),
          approverMemberId: newId(),
          approvedAt: new Date().toISOString(),
        },
        allocations: [{ requestType: "ORDER", requestId: order.orderId, amount: money(100) }],
      },
    });
    expect(response.status).toBe(400);
  });

  it("pays an order through PARTIAL and PAID and a refund shows PARTIALLY_REFUNDED", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const { order } = await placed(shop);
    const key = newId();
    const first = await pay(shop, order.orderId, 500, key);
    expect(first.status).toBe(201);
    const replay = await pay(shop, order.orderId, 500, key);
    expect(replay.body.data).toEqual(first.body.data);
    expect((await detail(shop, order.orderId)).paymentStatus).toBe("PARTIAL");
    expect((await pay(shop, order.orderId, 500)).status).toBe(201);
    expect((await detail(shop, order.orderId)).paymentStatus).toBe("PAID");
    expect((await pay(shop, order.orderId, 100, newId(), true)).status).toBe(201);
    expect((await detail(shop, order.orderId)).paymentStatus).toBe("PARTIALLY_REFUNDED");
  });

  it("recreates a deleted summary with grandTotal on the first payment", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const { order } = await placed(shop, 3);
    await harness.connections.tenantShared
      .collection("payment_summaries")
      .deleteOne({ organizationId: shop.organizationId, requestId: order.orderId });
    expect((await pay(shop, order.orderId, 500)).status).toBe(201);
    const summary = await harness.connections.tenantShared
      .collection("payment_summaries")
      .findOne({ organizationId: shop.organizationId, requestId: order.orderId });
    expect(summary?.["total"]).toEqual(order.totals.grandTotal);
    expect(summary?.["allocated"]).toEqual(money(500));
  });

  it("refuses payment for DRAFT, CANCELLED and another organization's order", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const draft = await drafted(shop);
    expect((await pay(shop, draft.order.orderId, 100)).status).toBe(400);
    const result = await placeOrder(shop, draft.order);
    const foreign = {
      actor: world.bob,
      organizationId: world.organizationB,
      locationId: world.locationB1,
    };
    expect((await pay(foreign, draft.order.orderId, 100)).status).toBe(400);
    expect((await detail(shop, draft.order.orderId)).paymentStatus).toBe("UNPAID");
    expect((await cancel(shop, result.order)).status).toBe(200);
    expect((await pay(shop, draft.order.orderId, 100)).status).toBe(400);
  });

  it("snapshots BEFORE_REVENUE for PLACED and AFTER_REVENUE for a completed instant sale", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const { order, lines } = await placed(shop);
    const before = await pay(shop, order.orderId, 100);
    expect(before.status).toBe(201);
    expect(before.body.data.allocations[0].revenueState).toBe("BEFORE_REVENUE");
    const sale = await instantOrder(shop, { locationId: shop.locationId, lines });
    const after = await pay(shop, sale.order.orderId, 100);
    expect(after.status).toBe(201);
    expect(after.body.data.allocations[0].revenueState).toBe("AFTER_REVENUE");
  });

  it("lists three orders with their own payment statuses using one summary query", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const first = await placed(shop);
    const second = await placed(shop);
    const third = await placed(shop);
    await pay(shop, first.order.orderId, 500);
    await pay(shop, second.order.orderId, 1000);
    const spy = vi.spyOn(MongoPaymentSummaryRepository.prototype, "findByRequests");
    try {
      const response = await shop.actor.call("get", ordersPath(shop.organizationId));
      expect(response.status).toBe(200);
      expect(spy).toHaveBeenCalledTimes(1);
      const rows = response.body.data as OrderRow[];
      expect(new Map(rows.map((row) => [row.orderId, row.paymentStatus]))).toEqual(
        new Map([
          [first.order.orderId, "PARTIAL"],
          [second.order.orderId, "PAID"],
          [third.order.orderId, "UNPAID"],
        ]),
      );
    } finally {
      spy.mockRestore();
    }
  });

  it("refuses an edit below net paid without changing the order and updates a higher total", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const { order, lines } = await placed(shop, 3);
    await pay(shop, order.orderId, 2000);
    const edit = (quantity: number) =>
      shop.actor.call("patch", ordersPath(shop.organizationId, `/${order.orderId}`), {
        version: order.version,
        lines: lines.map((line) => ({ ...line, quantity })),
      });
    const refused = await edit(1);
    expect(refused.status).toBe(422);
    expect(refused.body.error.details.ruleKey).toBe("ORDER_TOTAL_BELOW_PAID");
    expect(await detail(shop, order.orderId)).toMatchObject({
      version: order.version,
      totals: order.totals,
    });
    expect((await edit(4)).status).toBe(200);
    const summary = await harness.connections.tenantShared
      .collection("payment_summaries")
      .findOne({ organizationId: shop.organizationId, requestId: order.orderId });
    expect(summary?.["total"]).toEqual(money(4000));
  });

  it.each([
    ["FIXED", 500, 500],
    ["PERCENT", 25, 250],
    ["FULL", 0, 1000],
    ["FIXED", 5000, 1000],
  ])("confirms only after the %s advance of %s is satisfied", async (rule, value, required) => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    await setSetting(shop, "sales.advance.required", rule);
    await setSetting(shop, "sales.advance.value", value);
    const { order } = await placed(shop);
    const confirm = () =>
      shop.actor.call("post", ordersPath(shop.organizationId, `/${order.orderId}/confirm`), {
        version: order.version,
      });
    const refused = await confirm();
    expect(refused.status).toBe(422);
    expect(refused.body.error.details.ruleKey).toBe("ADVANCE_NEEDS_PAYMENTS");
    expect((await pay(shop, order.orderId, required)).status).toBe(201);
    expect((await confirm()).body.data.status).toBe("CONFIRMED");
  });

  it("credits 500 on cancel once and refuses a second cancellation", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const { order, contactId } = await placed(shop);
    await pay(shop, order.orderId, 500);
    const cancelled = await cancel(shop, order);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.status).toBe("CANCELLED");
    expect((await cancel(shop, cancelled.body.data)).status).toBe(409);
    const credits = await harness.connections.tenantShared
      .collection("store_credit_entries")
      .find({ organizationId: shop.organizationId, contactId, kind: "CANCELLATION" })
      .toArray();
    expect(credits).toHaveLength(1);
    expect(credits[0]?.["amount"]).toEqual(money(500));
    const contact = await harness.connections.tenantShared
      .collection("contacts")
      .findOne({ organizationId: shop.organizationId, contactId });
    expect(contact?.["summary"].storeCreditBalanceMinor).toBe(500);
  });

  it("clears an unpaid order summary on cancellation so it leaves dues", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const { order } = await placed(shop);
    expect((await cancel(shop, order)).status).toBe(200);
    const summary = await harness.connections.tenantShared
      .collection("payment_summaries")
      .findOne({ organizationId: shop.organizationId, requestId: order.orderId });
    expect(summary?.["total"]).toEqual(money(0));
    const dues = await shop.actor.call(
      "get",
      `/orgs/${shop.organizationId}/dues?requestType=ORDER`,
    );
    expect(dues.status).toBe(200);
    expect(dues.body.data).toEqual([]);
  });

  it("refuses cancellation with net paid and no contact", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const { order } = await placed(shop);
    await pay(shop, order.orderId, 500);
    await harness.connections.tenantShared
      .collection("orders")
      .updateOne(
        { organizationId: shop.organizationId, orderId: order.orderId },
        { $set: { contactId: null } },
      );
    const response = await cancel(shop, order);
    expect(response.status).toBe(422);
    expect(response.body.error.details.ruleKey).toBe("ORDER_CANCEL_NEEDS_CONTACT");
    expect((await detail(shop, order.orderId)).status).toBe("PLACED");
  });

  it("denies a viewer and invalid payment input", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const { order } = await placed(shop);
    const viewer = await memberWithRole(harness, world, SYSTEM_ROLE_KEY.VIEWER);
    expect((await pay({ ...shop, actor: viewer }, order.orderId, 100)).status).toBe(403);
    expect((await pay(shop, order.orderId, -1)).status).toBe(400);
  });
  it("refuses payments and refunds for an order outside the caller's assigned location", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const { order } = await placed(shop);
    const roleId = await findSystemRoleId(
      harness.connections,
      world.organizationA,
      SYSTEM_ROLE_KEY.MANAGER,
    );
    const member = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: world.locationA2, roleId },
    ]);
    const elsewhere = { ...shop, actor: member.actor, locationId: world.locationA2 };
    expect((await pay(elsewhere, order.orderId, 100)).status).toBe(400);
    expect((await pay(shop, order.orderId, 500)).status).toBe(201);
    expect((await pay(elsewhere, order.orderId, 100, newId(), true)).status).toBe(400);
    expect((await detail(shop, order.orderId)).paymentStatus).toBe("PARTIAL");
  });
});
