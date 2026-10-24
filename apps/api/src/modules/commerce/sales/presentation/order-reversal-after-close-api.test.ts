import { APPROVAL_ACTION } from "@banijjik/contracts/iam";
import {
  CLOSED_REQUEST_REVERSAL_POLICY,
  PAYMENT_REVERSAL_CLOSED_REQUEST_SETTING_KEY,
} from "@banijjik/contracts/payment";
import { newId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { money, startCatalogApi, worldFor } from "../../../../test-support/catalog-world.js";
import {
  registerIamApiModels,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";
import {
  addCustomer,
  cancelOrder,
  draftOrder,
  instantOrder,
  placeOrder,
  publishOffering,
  setSetting,
  shopOf,
  type SalesShop,
} from "../../../../test-support/sales-api-world.js";

registerIamApiModels();
const RETAIL = { industryTemplateKey: "RETAIL" };
let harness: IamApiHarness;
beforeAll(async () => {
  harness = await startCatalogApi();
});
afterAll(async () => {
  await harness.dispose();
});

const PRICE = 1000;

function payOrder(shop: SalesShop, orderId: string, amount: number) {
  return shop.actor.callWith({
    method: "post",
    path: `/orgs/${shop.organizationId}/payments`,
    idempotencyKey: newId(),
    body: {
      locationId: shop.locationId,
      method: "CASH",
      amount: money(amount),
      allocations: [{ requestType: "ORDER", requestId: orderId, amount: money(amount) }],
    },
  });
}

async function reverseOrderPayment(shop: SalesShop, paymentId: string, amount: number) {
  await shop.actor.call("put", `/orgs/${shop.organizationId}/me/approval-pin`, {
    currentPassword: shop.actor.person.password,
    pin: "1234",
  });
  const approvers = await shop.actor.call(
    "get",
    `/orgs/${shop.organizationId}/approvers?locationId=${shop.locationId}`,
  );
  const granted = await shop.actor.call("post", `/orgs/${shop.organizationId}/approvals`, {
    action: APPROVAL_ACTION.PAYMENT_REVERSAL,
    subjectKey: paymentId,
    amount: money(amount),
    locationId: shop.locationId,
    approverMemberId: approvers.body.data[0].memberId,
    pin: "1234",
  });
  expect(granted.status, JSON.stringify(granted.body)).toBe(200);
  return shop.actor.callWith({
    method: "post",
    path: `/orgs/${shop.organizationId}/payments/${paymentId}/reverse`,
    idempotencyKey: newId(),
    body: { approvalToken: granted.body.data.approvalToken },
  });
}

async function orderLines(shop: SalesShop) {
  const product = await publishOffering(shop, { kind: "PRODUCT", name: "Tea", priceAmount: PRICE });
  return [{ ...product, quantity: 1 }];
}

async function orderDues(shop: SalesShop) {
  const response = await shop.actor.call(
    "get",
    `/orgs/${shop.organizationId}/dues?requestType=ORDER`,
  );
  expect(response.status).toBe(200);
  return response.body.data as { requestId: string; total: unknown; due: unknown }[];
}

describe("an order payment reversed when the order is no longer open", () => {
  it("order: reversing a payment of a cancelled paid order is refused as today", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    await setSetting(
      shop,
      PAYMENT_REVERSAL_CLOSED_REQUEST_SETTING_KEY,
      CLOSED_REQUEST_REVERSAL_POLICY.WRITE_OFF,
    );
    const lines = await orderLines(shop);
    const contactId = await addCustomer(shop, "Rahim", "+8801712340001");
    const draft = await draftOrder(shop, { locationId: shop.locationId, contactId, lines });
    const placed = await placeOrder(shop, draft);
    expect(placed.status).toBe(200);
    const payment = await payOrder(shop, placed.order.orderId, 500);
    expect(payment.status).toBe(201);
    const cancelled = await cancelOrder(shop, {
      orderId: placed.order.orderId,
      version: placed.order.version,
      reason: "Customer cancelled",
    });
    expect(cancelled.status).toBe(200);

    const reversed = await reverseOrderPayment(shop, payment.body.data.paymentId, 500);

    expect(reversed.status, JSON.stringify(reversed.body)).toBe(422);
    expect(reversed.body.error.details.ruleKey).toBe("errors.payment_reversal_has_refund");
  });

  it("completed order under WRITE_OFF: the total stays and the reversed amount is back in dues", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    await setSetting(
      shop,
      PAYMENT_REVERSAL_CLOSED_REQUEST_SETTING_KEY,
      CLOSED_REQUEST_REVERSAL_POLICY.WRITE_OFF,
    );
    const lines = await orderLines(shop);
    const sale = await instantOrder(shop, { locationId: shop.locationId, lines });
    expect(sale.status).toBe(201);
    const payment = await payOrder(shop, sale.order.orderId, 400);
    expect(payment.status).toBe(201);

    const reversed = await reverseOrderPayment(shop, payment.body.data.paymentId, 400);

    expect(reversed.status, JSON.stringify(reversed.body)).toBe(201);
    expect(reversed.body.data.writeOffs).toEqual([]);
    const summary = await harness.connections.tenantShared
      .collection("payment_summaries")
      .findOne({ organizationId: shop.organizationId, requestId: sale.order.orderId });
    expect(summary?.["total"]).toEqual(money(PRICE));
    expect((await orderDues(shop)).map((row) => row.requestId)).toContain(sale.order.orderId);
  });
});
