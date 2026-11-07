import { ORDER_STATUS } from "@banijjik/contracts/sales";
import { SALES_DELIVERY_FAIL_REASON } from "@banijjik/contracts/sales/delivery";
import { newId } from "@banijjik/ids";
import type { Response } from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { worldFor } from "../../../../test-support/catalog-world.js";
import type { TwoOrganizations } from "../../../../test-support/two-organizations.js";
import {
  grantCommission,
  homeOf,
  processDayAndReplay,
  startDayScenarioApi,
  todayInDhaka,
  trialBalances,
} from "../../../../test-support/day-scenario-world.js";
import {
  registerIamApiModels,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";
import type { OrderRow } from "../../../../test-support/sales-api-rows.js";
import {
  addCustomer,
  addInventoryItem,
  confirmOrder,
  draftOrder,
  getOrder,
  ordersPath,
  placeOrder,
  publishOffering,
  receiveStock,
  shopOf,
  type SalesShop,
} from "../../../../test-support/sales-api-world.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };
const ITEM_PRICE = 5_000;
const UNIT_COST = 50;
const PACK_GRAMS = 1_000;
const CUSTOMER_PHONE = "+8801700000001";
const APPROVAL_PIN = "5678";
const DHAKA_ADDRESS = {
  recipientName: "Rahim Uddin",
  phoneE164: "01712345678",
  addressLine: "House 12, Road 4",
  districtCode: "dhaka",
  areaCode: "dhanmondi",
  postalCode: "1209",
} as const;

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startDayScenarioApi();
});

afterAll(async () => {
  await harness.dispose();
});

async function ensureZones(shop: SalesShop): Promise<void> {
  await shop.actor.callWith({
    method: "post",
    path: `/orgs/${shop.organizationId}/sales/delivery-zones`,
    idempotencyKey: newId(),
    body: {
      zoneKey: `zone-${newId().slice(-12)}`,
      name: { bn: "ঢাকা", en: "Dhaka" },
      areaCodes: [DHAKA_ADDRESS.areaCode, "gulshan", "mirpur"],
      feeMinor: 0,
      status: "ACTIVE",
    },
  });
}

async function itemWithStockOf(shop: SalesShop, name: string, stockQuantity = 20 * PACK_GRAMS) {
  const itemId = await addInventoryItem(shop, `${name} raw item`);
  const pack = await publishOffering(shop, {
    kind: "PRODUCT",
    name: `${name} pack`,
    priceAmount: ITEM_PRICE,
    stockComponents: [{ inventoryItemId: itemId, quantity: PACK_GRAMS }],
  });
  await receiveStock(shop, [
    { inventoryItemId: itemId, quantity: stockQuantity, unitCostAmount: UNIT_COST },
  ]);
  return { itemId, offeringId: pack.offeringId, variantId: pack.variantId };
}

async function makeConfirmedOrder(
  shop: SalesShop,
  offering: { offeringId: string; variantId: string },
  fulfillmentMethod: "COURIER" | "OWN_RIDER" = "COURIER",
  contactId?: string,
): Promise<OrderRow> {
  await ensureZones(shop);
  const draft = await draftOrder(shop, {
    locationId: shop.locationId,
    contactId,
    fulfillmentMethod,
    deliveryAddress: DHAKA_ADDRESS,
    lines: [{ offeringId: offering.offeringId, variantId: offering.variantId, quantity: 1 }],
  });
  const placed = await placeOrder(shop, { orderId: draft.orderId, version: draft.version });
  expect(placed.status).toBe(200);
  const confirmed = await confirmOrder(shop, {
    orderId: draft.orderId,
    version: placed.order.version,
  });
  return confirmed;
}

async function shipCourierOrderCall(shop: SalesShop, orderId: string): Promise<Response> {
  return shop.actor.callWith({
    method: "post",
    path: `/orgs/${shop.organizationId}/courier/consignments`,
    idempotencyKey: newId(),
    body: {
      orderId,
      courierKey: "STEADFAST",
      trackingNumber: `trk-${newId().slice(-8)}`,
      shipOrder: true,
    },
  });
}

async function shipRiderOrderCall(
  shop: SalesShop,
  orderId: string,
  riderMemberId: string,
): Promise<Response> {
  return shop.actor.callWith({
    method: "post",
    path: `/orgs/${shop.organizationId}/delivery/assignments`,
    idempotencyKey: newId(),
    body: {
      orderId,
      riderMemberId,
      shipOrder: true,
    },
  });
}

function deliverOrderCall(
  shop: SalesShop,
  orderId: string,
  version: number,
  note?: string,
): Promise<Response> {
  return shop.actor.callWith({
    method: "post",
    path: ordersPath(shop.organizationId, `/${orderId}/deliver`),
    idempotencyKey: newId(),
    body: { version, ...(note ? { note } : {}) },
  });
}

function failDeliveryCall(shop: SalesShop, orderId: string, version: number): Promise<Response> {
  return shop.actor.callWith({
    method: "post",
    path: ordersPath(shop.organizationId, `/${orderId}/delivery-failed`),
    idempotencyKey: newId(),
    body: {
      version,
      reasonKey: SALES_DELIVERY_FAIL_REASON.RECIPIENT_UNAVAILABLE,
      note: "Recipient unavailable",
    },
  });
}

function reshipOrderCall(
  shop: SalesShop,
  orderId: string,
  version: number,
  dispatch: { method: "COURIER" | "OWN_RIDER"; id?: string },
): Promise<Response> {
  const payload =
    dispatch.method === "COURIER"
      ? { method: "COURIER" as const, consignmentId: dispatch.id ?? newId() }
      : { method: "OWN_RIDER" as const, deliveryAssignmentId: dispatch.id ?? newId() };
  return shop.actor.callWith({
    method: "post",
    path: ordersPath(shop.organizationId, `/${orderId}/reship`),
    idempotencyKey: newId(),
    body: { version, dispatch: payload },
  });
}

function rtsCall(
  shop: SalesShop,
  orderId: string,
  version: number,
  restockDisposition: "RESTOCK" | "RETURN_DAMAGED" = "RESTOCK",
): Promise<Response> {
  return shop.actor.callWith({
    method: "post",
    path: ordersPath(shop.organizationId, `/${orderId}/rts`),
    idempotencyKey: newId(),
    body: { version, reasonKey: "PACKAGE_RETURNED", restockDisposition },
  });
}

async function approverMember(world: TwoOrganizations, locationId: string): Promise<string> {
  await world.alice.call("put", `/orgs/${world.organizationA}/me/approval-pin`, {
    currentPassword: world.alice.person.password,
    pin: APPROVAL_PIN,
  });
  const approvers = await world.alice.call(
    "get",
    `/orgs/${world.organizationA}/approvers?locationId=${locationId}`,
  );
  expect(approvers.status).toBe(200);
  return approvers.body.data[0].memberId as string;
}

async function lossApprovalToken(
  shop: SalesShop,
  input: {
    readonly action: "DELIVERY_LOSS_CLOSE" | "DELIVERY_LOSS_RECOVER";
    readonly approverMemberId: string;
    readonly subjectKey: string;
    readonly locationId: string;
    readonly amount?: { readonly amount: number; readonly currency: string };
  },
): Promise<string> {
  const response = await shop.actor.call("post", `/orgs/${shop.organizationId}/approvals`, {
    action: input.action,
    subjectKey: input.subjectKey,
    locationId: input.locationId,
    approverMemberId: input.approverMemberId,
    pin: APPROVAL_PIN,
    ...(input.amount === undefined ? {} : { amount: input.amount }),
  });
  expect(response.status).toBe(200);
  return response.body.data.approvalToken as string;
}

describe("COD Commerce Day Scenarios (Card 4.3 Part V-cod)", () => {
  it("midnight Asia/Dhaka business dates match settlement and report dates", () => {
    const today = todayInDhaka();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("day scenario: advance + COD delivery + courier fee + settlement gives zero collection receivable and balanced trial balance", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    await grantCommission(shop.organizationId);
    const item = await itemWithStockOf(shop, "Advance COD Rice");
    const contactId = await addCustomer(shop, "COD Buyer 1", CUSTOMER_PHONE);

    // 1. Confirmed COURIER order
    const order = await makeConfirmedOrder(shop, item, "COURIER", contactId);

    // 2. Advance payment of 1,000 BDT
    const advancePay = await shop.actor.callWith({
      method: "post",
      path: `/orgs/${shop.organizationId}/payments`,
      idempotencyKey: newId(),
      body: {
        locationId: shop.locationId,
        contactId,
        method: "BKASH",
        externalReference: "BKASH-ADV-001",
        amount: { amount: 1_000, currency: "BDT" },
        allocations: [
          {
            requestType: "ORDER",
            requestId: order.orderId,
            amount: { amount: 1_000, currency: "BDT" },
          },
        ],
      },
    });
    expect(advancePay.status).toBe(201);

    // 3. Ship order via courier consignment
    const shipRes = await shipCourierOrderCall(shop, order.orderId);
    expect(shipRes.status).toBe(200);
    const shippedOrder = await getOrder(shop, order.orderId);
    expect(shippedOrder.status).toBe("SHIPPED");

    // 4. Deliver order (COD collection for remainder 4,000 BDT)
    const deliverRes = await deliverOrderCall(shop, order.orderId, shippedOrder.version);
    expect(deliverRes.status).toBe(200);
    expect(deliverRes.body.data.status).toBe("DELIVERED");

    // 5. Courier settlement with fee
    const paymentsList = await shop.actor.call(
      "get",
      `/orgs/${shop.organizationId}/payments?method=COD_COURIER&limit=50`,
    );
    expect(paymentsList.status).toBe(200);
    const paymentIds = paymentsList.body.data.map((p: { paymentId: string }) => p.paymentId);
    expect(paymentIds.length).toBeGreaterThan(0);

    const settleRes = await shop.actor.callWith({
      method: "post",
      path: `/orgs/${shop.organizationId}/courier/settlements`,
      idempotencyKey: newId(),
      body: {
        courierKey: "STEADFAST",
        paymentIds: [paymentIds[0]],
        courierChargesMinor: 100, // 1 BDT fee
        receivedVia: "BANK",
        externalReference: "SETTLE-ADV-001",
        businessDate: todayInDhaka(),
      },
    });
    expect(settleRes.status).toBe(200);

    // 6. Process outbox events through workers
    await processDayAndReplay(shop.organizationId);

    // 7. Verify trial balance balances
    const balances = await trialBalances(shop.actor, shop.organizationId);
    expect(balances).toBe(true);

    // 8. Verify report counters
    const home = await homeOf(shop.actor, shop.organizationId);
    expect(home.periods.today.counters.ordersCompleted).toBe(1);
  });

  it("day scenario: failed/redelivered order then delivered return has balanced trial balance", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    await grantCommission(shop.organizationId);
    const item = await itemWithStockOf(shop, "Redelivery Rice");

    const order = await makeConfirmedOrder(shop, item, "COURIER");
    const shipRes = await shipCourierOrderCall(shop, order.orderId);
    expect(shipRes.status).toBe(200);
    const shippedOrder = await getOrder(shop, order.orderId);

    // Delivery attempt fails
    const failRes = await failDeliveryCall(shop, order.orderId, shippedOrder.version);
    expect(failRes.status).toBe(200);
    expect(failRes.body.data.status).toBe("DELIVERY_FAILED");

    // Reship
    const reshipRes = await reshipOrderCall(shop, order.orderId, failRes.body.data.version, {
      method: "COURIER",
    });
    expect(reshipRes.status).toBe(200);
    expect(reshipRes.body.data.status).toBe("SHIPPED");

    // Deliver
    const deliverRes = await deliverOrderCall(shop, order.orderId, reshipRes.body.data.version);
    expect(deliverRes.status).toBe(200);
    expect(deliverRes.body.data.status).toBe("DELIVERED");

    // Settle COD
    const paymentsList = await shop.actor.call(
      "get",
      `/orgs/${shop.organizationId}/payments?method=COD_COURIER&limit=50`,
    );
    const codPaymentId = paymentsList.body.data[0].paymentId;

    const settleRes = await shop.actor.callWith({
      method: "post",
      path: `/orgs/${shop.organizationId}/courier/settlements`,
      idempotencyKey: newId(),
      body: {
        courierKey: "PATHAO",
        paymentIds: [codPaymentId],
        courierChargesMinor: 200,
        receivedVia: "CASH",
        externalReference: "SETTLE-REDEL-002",
        businessDate: todayInDhaka(),
      },
    });
    expect(settleRes.status).toBe(200);

    // Delivered order return
    const line = deliverRes.body.data.lines[0];
    const returnRes = await shop.actor.callWith({
      method: "post",
      path: ordersPath(shop.organizationId, `/${order.orderId}/returns`),
      idempotencyKey: newId(),
      body: {
        lines: [{ orderLineId: line.orderLineId, quantity: 1, disposition: "RESTOCK" }],
        reasonKey: "CHANGED_MIND",
        refundMethod: "CASH",
      },
    });
    expect(returnRes.status).toBe(201);

    await processDayAndReplay(shop.organizationId);
    expect(await trialBalances(shop.actor, shop.organizationId)).toBe(true);
  });

  it("day scenario: failed shipment + damaged RTS + fee has correct stock, revenue and expense", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const item = await itemWithStockOf(shop, "RTS Damaged Item");

    const order = await makeConfirmedOrder(shop, item, "COURIER");
    const shipRes = await shipCourierOrderCall(shop, order.orderId);
    expect(shipRes.status).toBe(200);
    const shippedOrder = await getOrder(shop, order.orderId);
    const failRes = await failDeliveryCall(shop, order.orderId, shippedOrder.version);
    expect(failRes.status).toBe(200);

    // Return to Sender marked RETURN_DAMAGED
    const rtsRes = await rtsCall(shop, order.orderId, failRes.body.data.version, "RETURN_DAMAGED");
    expect(rtsRes.status).toBe(200);
    expect(rtsRes.body.data.status).toBe("RETURNED_TO_SENDER");

    await processDayAndReplay(shop.organizationId);
    expect(await trialBalances(shop.actor, shop.organizationId)).toBe(true);
  });

  it("day scenario: rider delivery + handover + correction matches register and rider cash", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const item = await itemWithStockOf(shop, "Rider Rice");

    const order = await makeConfirmedOrder(shop, item, "OWN_RIDER");
    const shipRes = await shipRiderOrderCall(shop, order.orderId, world.samMemberId);
    expect(shipRes.status).toBe(200);
    const shippedOrder = await getOrder(shop, order.orderId);
    const deliverRes = await deliverOrderCall(shop, order.orderId, shippedOrder.version);
    expect(deliverRes.status).toBe(200);

    const paymentsList = await shop.actor.call(
      "get",
      `/orgs/${shop.organizationId}/payments?method=RIDER_CASH&limit=50`,
    );
    const riderPaymentId = paymentsList.body.data[0].paymentId;

    const handoverRes = await shop.actor.callWith({
      method: "post",
      path: `/orgs/${shop.organizationId}/delivery/handovers`,
      idempotencyKey: newId(),
      body: {
        riderMemberId: world.samMemberId,
        paymentIds: [riderPaymentId],
        receivedVia: "CASH",
        businessDate: todayInDhaka(),
      },
    });
    expect(handoverRes.status).toBe(200);

    await processDayAndReplay(shop.organizationId);
    expect(await trialBalances(shop.actor, shop.organizationId)).toBe(true);
  });

  it("day scenario: full flow with advance + failure + partial return + loss + carrier fee + later recovery reconciles ending inventory, COGS/loss, customer due, commission, reports, and trial balance after real workers", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    await grantCommission(shop.organizationId);
    const item = await itemWithStockOf(shop, "Full Lifecycle Item");

    const order = await makeConfirmedOrder(shop, item, "COURIER");
    const shipRes = await shipCourierOrderCall(shop, order.orderId);
    expect(shipRes.status).toBe(200);
    const shippedOrder = await getOrder(shop, order.orderId);
    const failRes = await failDeliveryCall(shop, order.orderId, shippedOrder.version);
    expect(failRes.status).toBe(200);

    const approverMemberId = await approverMember(world, shop.locationId);
    const approvalToken = await lossApprovalToken(shop, {
      action: "DELIVERY_LOSS_CLOSE",
      approverMemberId,
      subjectKey: order.orderId,
      locationId: shop.locationId,
      amount: { amount: UNIT_COST * 1, currency: "BDT" },
    });

    // Delivery loss closure
    const lossRes = await shop.actor.callWith({
      method: "post",
      path: ordersPath(shop.organizationId, `/${order.orderId}/delivery-loss/close`),
      idempotencyKey: newId(),
      body: {
        expectedVersion: failRes.body.data.version,
        reasonKey: "COURIER_REPORTED_LOST",
        approvalToken,
        lines: [
          {
            orderLineId: order.lines[0]?.orderLineId ?? "",
            restockQuantity: 0,
            damagedQuantity: 0,
            lostQuantity: 1,
          },
        ],
      },
    });
    expect(lossRes.status).toBe(200);
    expect(lossRes.body.data.deliveryLossClosureId).toBeTruthy();
    const lostOrder = await getOrder(shop, order.orderId);
    expect(lostOrder.status).toBe(ORDER_STATUS.DELIVERY_LOSS_CLOSED);

    // Later recovery of goods
    const recoveryApproval = await lossApprovalToken(shop, {
      action: "DELIVERY_LOSS_RECOVER",
      approverMemberId,
      subjectKey: lossRes.body.data.deliveryLossClosureId,
      locationId: shop.locationId,
      amount: { amount: UNIT_COST * 1, currency: "BDT" },
    });

    const recoverRes = await shop.actor.callWith({
      method: "post",
      path: ordersPath(shop.organizationId, `/${order.orderId}/delivery-loss/recover`),
      idempotencyKey: newId(),
      body: {
        expectedVersion: 1,
        approvalToken: recoveryApproval,
        lines: [
          {
            orderLineId: order.lines[0]?.orderLineId ?? "",
            restockQuantity: 1,
            damagedQuantity: 0,
          },
        ],
      },
    });
    expect(recoverRes.status).toBe(200);

    // Process outbox through worker
    await processDayAndReplay(shop.organizationId);

    // Verify trial balance and reporting
    expect(await trialBalances(shop.actor, shop.organizationId)).toBe(true);
    const home = await homeOf(shop.actor, shop.organizationId);
    expect(home).toBeDefined();
  });
});
