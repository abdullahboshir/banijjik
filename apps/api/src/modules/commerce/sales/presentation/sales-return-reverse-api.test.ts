import { INVENTORY_ALLOW_NEGATIVE_STOCK_SETTING_KEY } from "@banijjik/contracts/inventory";
import { SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { SALES_RULE_KEY } from "@banijjik/contracts/sales";
import { newId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startCatalogApi, worldFor } from "../../../../test-support/catalog-world.js";
import {
  registerIamApiModels,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";
import {
  detailOf,
  expectRuleRefused,
  grantToken,
  memberAt,
  movementsOfSource,
  newContact,
  orderDues,
  paidReturn,
  payOrder,
  postReturn,
  postReverse,
  returnBody,
  type ReturnView,
  soldLine,
  stockedItem,
  stockOf,
} from "../../../../test-support/sales-return-world.js";
import {
  receiveStock,
  setSetting,
  shopOf,
  type SalesShop,
} from "../../../../test-support/sales-api-world.js";
import type { TwoOrganizations } from "../../../../test-support/two-organizations.js";

registerIamApiModels();
const RETAIL = { industryTemplateKey: "RETAIL" };
const HTTP_OK = 200;
let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startCatalogApi();
});
afterAll(async () => {
  await harness.dispose();
});

/** The reverse body: the owner grants the SALES_RETURN_REVERSAL token for the return value. */
async function reverseBody(
  world: TwoOrganizations,
  shop: SalesShop,
  input: { readonly orderId: string; readonly salesReturn: ReturnView },
  extra: Record<string, unknown> = {},
) {
  const approvalToken = await grantToken(world, {
    action: "SALES_RETURN_REVERSAL",
    orderId: input.orderId,
    locationId: shop.locationId,
    amount: input.salesReturn.value.amount,
  });
  return {
    version: input.salesReturn.version,
    reasonKey: "ENTERED_BY_MISTAKE",
    approvalToken,
    ...extra,
  };
}

function summaryOf(shop: SalesShop, orderId: string) {
  return harness.connections.tenantShared
    .collection("payment_summaries")
    .findOne({ organizationId: shop.organizationId, requestId: orderId });
}

function returnRow(shop: SalesShop, salesReturnId: string) {
  return harness.connections.tenantShared
    .collection("sales_returns")
    .findOne({ organizationId: shop.organizationId, salesReturnId });
}

describe("reverse a sales return API: money and stock", () => {
  it("reversing a cash-refunded return with payback restores the order total, takes the cash back and puts the goods back out at the returned cost", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const item = await stockedItem(shop, 100, 10);
    const { order, salesReturn } = await paidReturn(shop, {
      quantity: 2,
      returned: 2,
      stockItemId: item,
    });
    const totalBefore = (await summaryOf(shop, order.orderId))?.["total"];
    expect(totalBefore.amount).toBe(order.totals.grandTotal.amount - salesReturn.value.amount);
    expect((await stockOf(shop, item)).onHand).toBe(10);
    // The average cost moves after the sale; the reversal must still use the stored cost.
    await receiveStock(shop, [{ inventoryItemId: item, quantity: 10, unitCostAmount: 300 }]);

    const body = await reverseBody(
      world,
      shop,
      { orderId: order.orderId, salesReturn },
      {
        payback: { method: "CASH" },
      },
    );
    const reversed = await postReverse(
      shop.actor,
      { organizationId: shop.organizationId, salesReturnId: salesReturn.salesReturnId },
      body,
    );

    expect(reversed.status, JSON.stringify(reversed.body)).toBe(HTTP_OK);
    expect(reversed.body.data.status).toBe("REVERSED");
    expect(reversed.body.data.reversal.paybackPaymentId).not.toBeNull();
    expect((await summaryOf(shop, order.orderId))?.["total"].amount).toBe(
      order.totals.grandTotal.amount,
    );
    const payback = await shop.actor.call(
      "get",
      `/orgs/${shop.organizationId}/payments/${reversed.body.data.reversal.paybackPaymentId}`,
    );
    expect(payback.body.data.direction).toBe("IN");
    expect(payback.body.data.method).toBe("CASH");
    expect(payback.body.data.amount.amount).toBe(salesReturn.refund.amount.amount);
    expect((await orderDues(shop)).filter((due) => due.requestId === order.orderId)).toEqual([]);
    const rows = await movementsOfSource(shop, salesReturn.salesReturnId);
    const reversal = rows.find((row) => row.reason === "RETURN_REVERSAL");
    expect(reversal?.quantityDelta).toBe(-2);
    expect(reversal?.unitCost?.amount).toBe(100);
    expect((await stockOf(shop, item)).onHand).toBe(18);
    const order2 = await detailOf(shop, order.orderId);
    expect(order2.returnStatus).toBe("NONE");
    expect(order2.lines[0]?.returnedQuantity).toBe(0);
  });

  it("reversing without payback leaves the refunded amount as a due on the order", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const { order, salesReturn } = await paidReturn(shop, { quantity: 2, returned: 1 });
    expect(salesReturn.refund.amount.amount).toBeGreaterThan(0);

    const body = await reverseBody(world, shop, { orderId: order.orderId, salesReturn });
    const reversed = await postReverse(
      shop.actor,
      { organizationId: shop.organizationId, salesReturnId: salesReturn.salesReturnId },
      body,
    );

    expect(reversed.status, JSON.stringify(reversed.body)).toBe(HTTP_OK);
    expect(reversed.body.data.reversal.paybackPaymentId).toBeNull();
    const due = (await orderDues(shop)).find((entry) => entry.requestId === order.orderId);
    expect(due?.due.amount).toBe(salesReturn.refund.amount.amount);
  });

  it("reversing a store-credit return with store credit payback debits the balance; a short balance refuses and writes nothing", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const contactId = await newContact(shop);
    const contactCredit = async () =>
      (
        await harness.connections.tenantShared
          .collection("contacts")
          .findOne({ organizationId: shop.organizationId, contactId })
      )?.["summary"].storeCreditBalanceMinor as number;
    const first = await paidReturn(shop, {
      quantity: 2,
      returned: 1,
      refundMethod: "STORE_CREDIT",
      contactId,
    });
    const credited = await contactCredit();
    expect(credited).toBe(first.salesReturn.refund.amount.amount);

    const body = await reverseBody(
      world,
      shop,
      { orderId: first.order.orderId, salesReturn: first.salesReturn },
      { payback: { method: "STORE_CREDIT" } },
    );
    const reversed = await postReverse(
      shop.actor,
      { organizationId: shop.organizationId, salesReturnId: first.salesReturn.salesReturnId },
      body,
    );
    expect(reversed.status, JSON.stringify(reversed.body)).toBe(HTTP_OK);
    expect(await contactCredit()).toBe(0);

    const second = await paidReturn(shop, {
      quantity: 2,
      returned: 1,
      refundMethod: "STORE_CREDIT",
      contactId,
    });
    const spender = await soldLine(shop, 2, { contactId });
    const spend = await payOrder(shop, spender.order.orderId, {
      amount: second.salesReturn.refund.amount.amount,
      method: "STORE_CREDIT",
      contactId: contactId,
    });
    expect(spend.status).toBe(201);
    expect(await contactCredit()).toBe(0);
    const totalBefore = (await summaryOf(shop, second.order.orderId))?.["total"].amount;
    const stockBefore = (await detailOf(shop, second.order.orderId)).lines[0]?.returnedQuantity;

    const shortBody = await reverseBody(
      world,
      shop,
      { orderId: second.order.orderId, salesReturn: second.salesReturn },
      { payback: { method: "STORE_CREDIT" } },
    );
    const refused = await postReverse(
      shop.actor,
      { organizationId: shop.organizationId, salesReturnId: second.salesReturn.salesReturnId },
      shortBody,
    );

    expect(refused.status).toBeGreaterThanOrEqual(400);
    expect((await returnRow(shop, second.salesReturn.salesReturnId))?.["status"]).toBe("ACTIVE");
    expect((await summaryOf(shop, second.order.orderId))?.["total"].amount).toBe(totalBefore);
    expect((await detailOf(shop, second.order.orderId)).lines[0]?.returnedQuantity).toBe(
      stockBefore,
    );
    expect(await contactCredit()).toBe(0);
  });

  it("reversing a damaged return takes the goods out of damaged stock; a not-received line moves nothing", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const item = await stockedItem(shop, 100, 10);
    const damaged = await paidReturn(shop, {
      quantity: 2,
      returned: 1,
      disposition: "DAMAGED",
      stockItemId: item,
    });
    expect(await stockOf(shop, item)).toEqual({ onHand: 8, damaged: 1 });

    const body = await reverseBody(world, shop, {
      orderId: damaged.order.orderId,
      salesReturn: damaged.salesReturn,
    });
    const reversed = await postReverse(
      shop.actor,
      { organizationId: shop.organizationId, salesReturnId: damaged.salesReturn.salesReturnId },
      body,
    );

    expect(reversed.status, JSON.stringify(reversed.body)).toBe(HTTP_OK);
    expect(await stockOf(shop, item)).toEqual({ onHand: 8, damaged: 0 });
    const rows = await movementsOfSource(shop, damaged.salesReturn.salesReturnId);
    expect(rows.map((row) => row.reason).sort()).toEqual([
      "RETURN_DAMAGED",
      "RETURN_DAMAGED_REVERSAL",
    ]);

    const sold = await soldLine(shop, 1, { stockItemId: item });
    const notReceivedToken = await grantToken(world, {
      action: "RETURN_NOT_RECEIVED",
      orderId: sold.order.orderId,
      locationId: shop.locationId,
      amount: sold.line.lineNetTotal.amount,
    });
    const notReceived = await postReturn(
      shop.actor,
      { organizationId: shop.organizationId, orderId: sold.order.orderId },
      returnBody(
        [{ orderLineId: sold.line.orderLineId, quantity: 1, disposition: "NOT_RECEIVED" }],
        {
          approvalTokens: { returnNotReceived: notReceivedToken },
        },
      ),
    );
    expect(notReceived.status).toBe(201);
    const stockBefore = await stockOf(shop, item);

    const reverseNotReceived = await postReverse(
      shop.actor,
      { organizationId: shop.organizationId, salesReturnId: notReceived.body.data.salesReturnId },
      await reverseBody(world, shop, {
        orderId: sold.order.orderId,
        salesReturn: notReceived.body.data,
      }),
    );

    expect(reverseNotReceived.status).toBe(HTTP_OK);
    expect(await stockOf(shop, item)).toEqual(stockBefore);
    expect(await movementsOfSource(shop, notReceived.body.data.salesReturnId)).toEqual([]);
  });

  it("refuses when the returned goods are no longer on hand", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const item = await stockedItem(shop, 100, 10);
    const restocked = await paidReturn(shop, { quantity: 2, returned: 2, stockItemId: item });
    await soldLine(shop, 10, { stockItemId: item });
    expect((await stockOf(shop, item)).onHand).toBe(0);

    for (const allowNegative of [false, true]) {
      if (allowNegative) await setSetting(shop, INVENTORY_ALLOW_NEGATIVE_STOCK_SETTING_KEY, true);
      const refused = await postReverse(
        shop.actor,
        { organizationId: shop.organizationId, salesReturnId: restocked.salesReturn.salesReturnId },
        await reverseBody(world, shop, {
          orderId: restocked.order.orderId,
          salesReturn: restocked.salesReturn,
        }),
      );
      expectRuleRefused(refused, SALES_RULE_KEY.SALES_RETURN_STOCK_GONE);
      expect(refused.body.error.details.inventoryItemId).toBe(item);
    }
    expect((await returnRow(shop, restocked.salesReturn.salesReturnId))?.["status"]).toBe("ACTIVE");
    expect((await stockOf(shop, item)).onHand).toBe(0);

    const damaged = await paidReturn(shop, {
      quantity: 2,
      returned: 1,
      disposition: "DAMAGED",
      stockItemId: item,
    });
    await harness.connections.tenantShared
      .collection("inventory_levels")
      .updateOne(
        { organizationId: shop.organizationId, inventoryItemId: item },
        { $set: { damaged: 0 } },
      );
    const damagedRefused = await postReverse(
      shop.actor,
      { organizationId: shop.organizationId, salesReturnId: damaged.salesReturn.salesReturnId },
      await reverseBody(world, shop, {
        orderId: damaged.order.orderId,
        salesReturn: damaged.salesReturn,
      }),
    );
    expectRuleRefused(damagedRefused, SALES_RULE_KEY.SALES_RETURN_STOCK_GONE);
  });

  it("refuses with its own rule when the order payment total is in another currency", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const { order, salesReturn } = await paidReturn(shop, { quantity: 2, returned: 1 });
    await harness.connections.tenantShared
      .collection("payment_summaries")
      .updateOne(
        { organizationId: shop.organizationId, requestId: order.orderId },
        { $set: { "total.currency": "USD" } },
      );

    const refused = await postReverse(
      shop.actor,
      { organizationId: shop.organizationId, salesReturnId: salesReturn.salesReturnId },
      await reverseBody(world, shop, { orderId: order.orderId, salesReturn }),
    );

    expectRuleRefused(refused, SALES_RULE_KEY.SALES_RETURN_REVERSE_CURRENCY_MISMATCH);
    expect((await returnRow(shop, salesReturn.salesReturnId))?.["status"]).toBe("ACTIVE");
  });

  it("the delivery charge of a reversed return can be returned again", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const { order, line } = await soldLine(shop, 2);
    await harness.connections.tenantShared
      .collection("orders")
      .updateOne(
        { organizationId: shop.organizationId, orderId: order.orderId },
        { $set: { "totals.deliveryCharge.amount": 50 } },
      );
    const returnWithDelivery = () =>
      postReturn(
        shop.actor,
        { organizationId: shop.organizationId, orderId: order.orderId },
        returnBody([{ orderLineId: line.orderLineId, quantity: 1 }], {
          returnDeliveryCharge: true,
        }),
      );
    const first = await returnWithDelivery();
    expect(first.status).toBe(201);
    expect(first.body.data.deliveryChargeReturned.amount).toBe(50);

    const reversed = await postReverse(
      shop.actor,
      { organizationId: shop.organizationId, salesReturnId: first.body.data.salesReturnId },
      await reverseBody(world, shop, { orderId: order.orderId, salesReturn: first.body.data }),
    );
    expect(reversed.status, JSON.stringify(reversed.body)).toBe(HTTP_OK);
    const again = await returnWithDelivery();

    expect(again.status).toBe(201);
    expect(again.body.data.deliveryChargeReturned.amount).toBe(50);
  });
});

describe("reverse a sales return API: rules, approvals and access", () => {
  it("a reverse always needs the SALES_RETURN_REVERSAL approval for the return value", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const { order, salesReturn } = await paidReturn(shop, { quantity: 2, returned: 1 });
    const withoutToken = await postReverse(
      shop.actor,
      { organizationId: shop.organizationId, salesReturnId: salesReturn.salesReturnId },
      {
        version: salesReturn.version,
        reasonKey: "ENTERED_BY_MISTAKE",
      },
    );
    const refused = withoutToken.body as { error: { code: string; details: { action: string } } };
    expect(withoutToken.status, JSON.stringify(withoutToken.body)).toBe(403);
    expect(refused.error.code).toBe("APPROVAL_REQUIRED");
    expect(refused.error.details.action).toBe("SALES_RETURN_REVERSAL");

    const lowToken = await grantToken(world, {
      action: "SALES_RETURN_REVERSAL",
      orderId: order.orderId,
      locationId: shop.locationId,
      amount: salesReturn.value.amount - 1,
    });
    const tooLow = await postReverse(
      shop.actor,
      { organizationId: shop.organizationId, salesReturnId: salesReturn.salesReturnId },
      {
        version: salesReturn.version,
        reasonKey: "ENTERED_BY_MISTAKE",
        approvalToken: lowToken,
      },
    );
    expect(tooLow.status).toBe(403);
    expect((await returnRow(shop, salesReturn.salesReturnId))?.["status"]).toBe("ACTIVE");
  });

  it("refuses the reason OTHER without a note", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const { order, salesReturn } = await paidReturn(shop, { quantity: 2, returned: 1 });

    const refused = await postReverse(
      shop.actor,
      { organizationId: shop.organizationId, salesReturnId: salesReturn.salesReturnId },
      await reverseBody(
        world,
        shop,
        { orderId: order.orderId, salesReturn },
        { reasonKey: "OTHER" },
      ),
    );

    expectRuleRefused(refused, SALES_RULE_KEY.SALES_RETURN_OTHER_REASON_NEEDS_NOTE);
  });

  it("a payback when nothing was refunded is a validation error that names the payback", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const { order, line } = await soldLine(shop, 2);
    const created = await postReturn(
      shop.actor,
      { organizationId: shop.organizationId, orderId: order.orderId },
      returnBody([{ orderLineId: line.orderLineId, quantity: 1 }], { refundMethod: null }),
    );
    expect(created.status).toBe(201);
    expect(created.body.data.refund.amount.amount).toBe(0);

    const refused = await postReverse(
      shop.actor,
      { organizationId: shop.organizationId, salesReturnId: created.body.data.salesReturnId },
      await reverseBody(
        world,
        shop,
        { orderId: order.orderId, salesReturn: created.body.data },
        { payback: { method: "CASH" } },
      ),
    );

    expect(refused.status).toBe(400);
    expect(refused.body.error.code).toBe("VALIDATION_ERROR");
    expect(refused.body.error.details.field).toBe("payback");
  });

  it("a second reverse of the same return is refused and writes nothing", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const item = await stockedItem(shop, 100, 10);
    const { order, salesReturn } = await paidReturn(shop, {
      quantity: 2,
      returned: 2,
      stockItemId: item,
    });
    const first = await postReverse(
      shop.actor,
      { organizationId: shop.organizationId, salesReturnId: salesReturn.salesReturnId },
      await reverseBody(world, shop, { orderId: order.orderId, salesReturn }),
    );
    expect(first.status).toBe(HTTP_OK);
    const stockAfterFirst = await stockOf(shop, item);
    const totalAfterFirst = (await summaryOf(shop, order.orderId))?.["total"].amount;

    const second = await postReverse(
      shop.actor,
      { organizationId: shop.organizationId, salesReturnId: salesReturn.salesReturnId },
      await reverseBody(world, shop, { orderId: order.orderId, salesReturn }),
    );

    expect(second.status).toBe(409);
    expect(await stockOf(shop, item)).toEqual(stockAfterFirst);
    expect((await summaryOf(shop, order.orderId))?.["total"].amount).toBe(totalAfterFirst);
    expect(await movementsOfSource(shop, salesReturn.salesReturnId)).toHaveLength(2);
  });

  it("two parallel reverses: one wins, the other 409, stock and money moved once", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const item = await stockedItem(shop, 100, 10);
    const { order, salesReturn } = await paidReturn(shop, {
      quantity: 2,
      returned: 2,
      stockItemId: item,
    });
    const bodies = [
      await reverseBody(world, shop, { orderId: order.orderId, salesReturn }),
      await reverseBody(world, shop, { orderId: order.orderId, salesReturn }),
    ];

    const racing = await Promise.all(
      bodies.map((body) =>
        postReverse(
          shop.actor,
          { organizationId: shop.organizationId, salesReturnId: salesReturn.salesReturnId },
          body,
        ),
      ),
    );

    expect(racing.filter((response) => response.status === HTTP_OK)).toHaveLength(1);
    const loser = racing.find((response) => response.status !== HTTP_OK);
    expect(loser?.status).toBe(409);
    expect((await stockOf(shop, item)).onHand).toBe(8);
    expect(await movementsOfSource(shop, salesReturn.salesReturnId)).toHaveLength(2);
    expect((await summaryOf(shop, order.orderId))?.["total"].amount).toBe(
      order.totals.grandTotal.amount,
    );
  });

  it("refuses to reverse an exchange return and a return of an order that is no longer completed", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const exchange = await paidReturn(shop, { quantity: 2, returned: 1 });
    await harness.connections.tenantShared
      .collection("sales_returns")
      .updateOne(
        { organizationId: shop.organizationId, salesReturnId: exchange.salesReturn.salesReturnId },
        { $set: { exchangeOrderId: newId() } },
      );
    expectRuleRefused(
      await postReverse(
        shop.actor,
        { organizationId: shop.organizationId, salesReturnId: exchange.salesReturn.salesReturnId },
        await reverseBody(world, shop, {
          orderId: exchange.order.orderId,
          salesReturn: exchange.salesReturn,
        }),
      ),
      SALES_RULE_KEY.SALES_RETURN_EXCHANGE_NOT_REVERSIBLE,
    );

    const closed = await paidReturn(shop, { quantity: 2, returned: 1 });
    await harness.connections.tenantShared
      .collection("orders")
      .updateOne(
        { organizationId: shop.organizationId, orderId: closed.order.orderId },
        { $set: { status: "CANCELLED" } },
      );
    expectRuleRefused(
      await postReverse(
        shop.actor,
        { organizationId: shop.organizationId, salesReturnId: closed.salesReturn.salesReturnId },
        await reverseBody(world, shop, {
          orderId: closed.order.orderId,
          salesReturn: closed.salesReturn,
        }),
      ),
      SALES_RULE_KEY.SALES_RETURN_REVERSE_ORDER_NOT_COMPLETED,
    );
  });

  it("the same Idempotency-Key returns the first reversal", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const item = await stockedItem(shop, 100, 10);
    const { order, salesReturn } = await paidReturn(shop, {
      quantity: 2,
      returned: 2,
      stockItemId: item,
    });
    const key = newId();
    const body = await reverseBody(world, shop, { orderId: order.orderId, salesReturn });

    const first = await postReverse(
      shop.actor,
      {
        organizationId: shop.organizationId,
        salesReturnId: salesReturn.salesReturnId,
        idempotencyKey: key,
      },
      body,
    );
    const replay = await postReverse(
      shop.actor,
      {
        organizationId: shop.organizationId,
        salesReturnId: salesReturn.salesReturnId,
        idempotencyKey: key,
      },
      body,
    );

    expect(first.status).toBe(HTTP_OK);
    expect(replay.body.data).toEqual(first.body.data);
    expect(await movementsOfSource(shop, salesReturn.salesReturnId)).toHaveLength(2);
  });

  it("a cashier without sales.return.reverse gets 403", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const { order, salesReturn } = await paidReturn(shop, { quantity: 2, returned: 1 });
    const cashier = await memberAt(harness, world, { locationId: world.locationA1 });

    const response = await postReverse(
      cashier,
      { organizationId: world.organizationA, salesReturnId: salesReturn.salesReturnId },
      await reverseBody(world, shop, { orderId: order.orderId, salesReturn }),
    );

    expect(response.status).toBe(403);
    expect((await returnRow(shop, salesReturn.salesReturnId))?.["status"]).toBe("ACTIVE");
  });

  it("a manager with sales.return.reverse at the location reverses the return", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const { order, salesReturn } = await paidReturn(shop, { quantity: 2, returned: 1 });
    const manager = await memberAt(harness, world, {
      locationId: world.locationA1,
      roleKey: SYSTEM_ROLE_KEY.MANAGER,
    });

    const response = await postReverse(
      manager,
      { organizationId: world.organizationA, salesReturnId: salesReturn.salesReturnId },
      await reverseBody(world, shop, { orderId: order.orderId, salesReturn }),
    );

    expect(response.status).toBe(HTTP_OK);
  });

  it("another organization's return is 404", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const { order, salesReturn } = await paidReturn(shop, { quantity: 2, returned: 1 });

    const response = await postReverse(
      world.bob,
      { organizationId: world.organizationB, salesReturnId: salesReturn.salesReturnId },
      {
        ...(await reverseBody(world, shop, { orderId: order.orderId, salesReturn })),
      },
    );

    expect(response.status).toBe(404);
  });

  it("a return at another location is refused to a manager of this location", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const elsewhere = { ...shop, locationId: world.locationA2 };
    const { order, salesReturn } = await paidReturn(elsewhere, { quantity: 2, returned: 1 });
    const manager = await memberAt(harness, world, {
      locationId: world.locationA1,
      roleKey: SYSTEM_ROLE_KEY.MANAGER,
    });

    const response = await postReverse(
      manager,
      { organizationId: world.organizationA, salesReturnId: salesReturn.salesReturnId },
      await reverseBody(world, elsewhere, { orderId: order.orderId, salesReturn }),
    );

    // Location-owned rows are invisible outside the caller's locations, so the return reads as
    // not found there, exactly as the A1 create test records.
    expect(response.status).toBe(404);
    expect((await returnRow(shop, salesReturn.salesReturnId))?.["status"]).toBe("ACTIVE");
  });
});
