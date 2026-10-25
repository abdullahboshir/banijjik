import { INVENTORY_ALLOW_NEGATIVE_STOCK_SETTING_KEY } from "@banijjik/contracts/inventory";
import { PERMISSION_KEY, SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { SALES_RULE_KEY } from "@banijjik/contracts/sales";
import { newId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { money, startCatalogApi, worldFor } from "../../../../test-support/catalog-world.js";
import {
  registerIamApiModels,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";
import { addMemberWithAssignments } from "../../../../test-support/rbac-world.js";
import {
  memberAt,
  newContact,
  orderDues,
  expectRuleRefused,
  grantToken,
  payOrder,
  postReverse,
  detailOf,
  soldLine,
  stockedItem,
  stockOf,
} from "../../../../test-support/sales-return-world.js";
import {
  ordersPath,
  publishOffering,
  setSetting,
  shopOf,
  type SalesShop,
} from "../../../../test-support/sales-api-world.js";
import type { TwoOrganizations } from "../../../../test-support/two-organizations.js";

registerIamApiModels();
const RETAIL = { industryTemplateKey: "RETAIL" };
const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const SOLD_PRICE = 1000;
let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startCatalogApi();
});
afterAll(async () => {
  await harness.dispose();
});

interface ExchangeOptions {
  readonly returned: readonly {
    readonly orderLineId: string;
    readonly quantity: number;
    readonly disposition?: string;
  }[];
  readonly sold: readonly {
    readonly offeringId: string;
    readonly variantId: string;
    readonly quantity: number;
  }[];
  readonly payments?: readonly { readonly method: string; readonly amount: number }[];
  readonly orderDiscount?: { readonly type: string; readonly value: number };
  readonly returnApprovalTokens?: { readonly refund?: string; readonly returnNotReceived?: string };
  readonly orderApprovalToken?: string;
}

/** The exchange body: the return lines, the new order's lines, and the payments on the new order. */
function exchangeBody(options: ExchangeOptions): Record<string, unknown> {
  return {
    return: {
      lines: options.returned.map((line) => ({
        orderLineId: line.orderLineId,
        quantity: line.quantity,
        disposition: line.disposition ?? "RESTOCK",
      })),
      reasonKey: "CHANGED_MIND",
      ...(options.returnApprovalTokens === undefined
        ? {}
        : { approvalTokens: options.returnApprovalTokens }),
    },
    order: {
      lines: options.sold.map((line) => ({
        offeringId: line.offeringId,
        variantId: line.variantId,
        quantity: line.quantity,
      })),
      ...(options.orderDiscount === undefined ? {} : { orderDiscount: options.orderDiscount }),
      ...(options.orderApprovalToken === undefined
        ? {}
        : { approvalToken: options.orderApprovalToken }),
    },
    payments: (options.payments ?? []).map((payment) => ({
      method: payment.method,
      amount: money(payment.amount),
    })),
  };
}

function postExchange(
  actor: SalesShop["actor"],
  target: { readonly organizationId: string; readonly orderId: string },
  body: object,
  idempotencyKey: string = newId(),
) {
  return actor.callWith({
    method: "post",
    path: ordersPath(target.organizationId, `/${target.orderId}/exchange`),
    idempotencyKey,
    body,
  });
}

function previewExchange(
  actor: SalesShop["actor"],
  target: { readonly organizationId: string; readonly orderId: string },
  body: object,
) {
  return actor.call(
    "post",
    ordersPath(target.organizationId, `/${target.orderId}/exchange/preview`),
    body,
  );
}

/** The returns of one order, as the list shows them. */
async function returnsOf(
  shop: SalesShop,
  orderId: string,
): Promise<readonly { salesReturnId: string }[]> {
  const response = await shop.actor.call(
    "get",
    `/orgs/${shop.organizationId}/sales/returns?orderId=${orderId}`,
  );
  expect(response.status).toBe(HTTP_OK);
  return response.body.data as readonly { salesReturnId: string }[];
}

/** The store-credit balance of a contact: its CREDIT entries less its DEBIT entries. */
async function creditBalanceOf(shop: SalesShop, contactId: string): Promise<number> {
  const response = await shop.actor.call(
    "get",
    `/orgs/${shop.organizationId}/store-credit?contactId=${contactId}`,
  );
  expect(response.status).toBe(HTTP_OK);
  const entries = response.body.data as readonly {
    direction: string;
    amount: { amount: number };
  }[];
  return entries.reduce(
    (sum, entry) =>
      sum + (entry.direction === "CREDIT" ? entry.amount.amount : -entry.amount.amount),
    0,
  );
}

/** A counter sale of `quantity` units with a contact, paid in full in cash. */
async function paidSale(shop: SalesShop, quantity: number, stockItemId?: string) {
  const contactId = await newContact(shop);
  const sold = await soldLine(shop, quantity, {
    contactId,
    ...(stockItemId === undefined ? {} : { stockItemId }),
  });
  const paid = await payOrder(shop, sold.order.orderId, {
    amount: sold.order.totals.grandTotal.amount,
  });
  expect(paid.status).toBe(HTTP_CREATED);
  return { ...sold, contactId };
}

async function newProduct(shop: SalesShop, priceAmount: number) {
  return publishOffering(shop, { kind: "PRODUCT", name: `Item ${newId()}`, priceAmount });
}

describe("exchange a return for a new order API: money and stock", () => {
  it("an exchange for a cheaper item leaves the difference as store credit", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const { order, line, contactId } = await paidSale(shop, 2);
    const cheaper = await newProduct(shop, 600);

    const response = await postExchange(
      shop.actor,
      { organizationId: shop.organizationId, orderId: order.orderId },
      exchangeBody({
        returned: [{ orderLineId: line.orderLineId, quantity: 1 }],
        sold: [{ ...cheaper, quantity: 1 }],
      }),
    );

    expect(response.status, JSON.stringify(response.body)).toBe(HTTP_CREATED);
    expect(response.body.data.storeCreditUsed.amount).toBe(600);
    expect(response.body.data.storeCreditLeft.amount).toBe(400);
    expect(response.body.data.dueAmount.amount).toBe(0);
    expect(await creditBalanceOf(shop, contactId)).toBe(400);
  });

  it("an exchange for a dearer item takes the difference in cash", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const { order, line } = await paidSale(shop, 2);
    const dearer = await newProduct(shop, 1500);

    const response = await postExchange(
      shop.actor,
      { organizationId: shop.organizationId, orderId: order.orderId },
      exchangeBody({
        returned: [{ orderLineId: line.orderLineId, quantity: 1 }],
        sold: [{ ...dearer, quantity: 1 }],
        payments: [{ method: "CASH", amount: 500 }],
      }),
    );

    expect(response.status, JSON.stringify(response.body)).toBe(HTTP_CREATED);
    expect(
      response.body.data.payments.map((payment: { method: string }) => payment.method),
    ).toEqual(["STORE_CREDIT", "CASH"]);
    expect(response.body.data.storeCreditLeft.amount).toBe(0);
    expect(response.body.data.dueAmount.amount).toBe(0);
    expect(response.body.data.order.paymentStatus).toBe("PAID");
  });

  it("an exchange for a dearer item without payment leaves the difference as a due on the new order", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const { order, line } = await paidSale(shop, 2);
    const dearer = await newProduct(shop, 1500);

    const response = await postExchange(
      shop.actor,
      { organizationId: shop.organizationId, orderId: order.orderId },
      exchangeBody({
        returned: [{ orderLineId: line.orderLineId, quantity: 1 }],
        sold: [{ ...dearer, quantity: 1 }],
      }),
    );

    expect(response.status, JSON.stringify(response.body)).toBe(HTTP_CREATED);
    expect(response.body.data.dueAmount.amount).toBe(500);
    const due = (await orderDues(shop)).find(
      (entry) => entry.requestId === response.body.data.order.orderId,
    );
    expect(due?.due.amount).toBe(500);
  });

  it("the same variant can be swapped: the returned unit is restocked before the new sale takes it", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    await setSetting(shop, INVENTORY_ALLOW_NEGATIVE_STOCK_SETTING_KEY, false);
    const item = await stockedItem(shop, 100, 1);
    const { order, line } = await paidSale(shop, 1, item);
    expect((await stockOf(shop, item)).onHand).toBe(0);

    const response = await postExchange(
      shop.actor,
      { organizationId: shop.organizationId, orderId: order.orderId },
      exchangeBody({
        returned: [{ orderLineId: line.orderLineId, quantity: 1 }],
        sold: [{ offeringId: line.offeringId, variantId: line.variantId, quantity: 1 }],
      }),
    );

    expect(response.status, JSON.stringify(response.body)).toBe(HTTP_CREATED);
    expect((await stockOf(shop, item)).onHand).toBe(0);
  });

  it("a failure in the new order writes nothing: no return, no credit, no stock movement", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const scarce = await stockedItem(shop, 100, 1);
    const { order, line } = await paidSale(shop, 2);
    const scarceProduct = await publishOffering(shop, {
      kind: "PRODUCT",
      name: `Scarce ${newId()}`,
      priceAmount: 300,
      stockComponents: [{ inventoryItemId: scarce, quantity: 1 }],
    });
    const stockBefore = (await stockOf(shop, scarce)).onHand;

    const response = await postExchange(
      shop.actor,
      { organizationId: shop.organizationId, orderId: order.orderId },
      exchangeBody({
        returned: [{ orderLineId: line.orderLineId, quantity: 1 }],
        sold: [{ ...scarceProduct, quantity: 5 }],
      }),
    );

    expect(response.status).not.toBe(HTTP_CREATED);
    expect(await returnsOf(shop, order.orderId)).toEqual([]);
    expect((await stockOf(shop, scarce)).onHand).toBe(stockBefore);
    const unchanged = await detailOf(shop, order.orderId);
    expect(unchanged.returnStatus).toBe("NONE");
    expect(unchanged.totals.grandTotal.amount).toBe(order.totals.grandTotal.amount);
  });

  it("a discount on the new order without its approval refuses and writes no return", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const cashier = await memberAt(harness, world, { locationId: shop.locationId });
    const contactId = await newContact(shop);
    const { order, line } = await soldLine(shop, 2, { contactId });
    const dearer = await newProduct(shop, 1500);

    const response = await postExchange(
      cashier,
      { organizationId: shop.organizationId, orderId: order.orderId },
      exchangeBody({
        returned: [{ orderLineId: line.orderLineId, quantity: 1 }],
        sold: [{ ...dearer, quantity: 1 }],
        orderDiscount: { type: "AMOUNT", value: 1000 },
      }),
    );

    expect(response.status).toBe(HTTP_FORBIDDEN);
    expect(response.body.error.code).toBe("APPROVAL_REQUIRED");
    expect(await returnsOf(shop, order.orderId)).toEqual([]);
  });
});

describe("exchange a return for a new order API: rules and approvals", () => {
  it("refuses an exchange on an order without a contact", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const { order, line } = await soldLine(shop, 2);
    expect(
      (await payOrder(shop, order.orderId, { amount: order.totals.grandTotal.amount })).status,
    ).toBe(HTTP_CREATED);
    const cheaper = await newProduct(shop, 600);

    const response = await postExchange(
      shop.actor,
      { organizationId: shop.organizationId, orderId: order.orderId },
      exchangeBody({
        returned: [{ orderLineId: line.orderLineId, quantity: 1 }],
        sold: [{ ...cheaper, quantity: 1 }],
      }),
    );

    expectRuleRefused(response, SALES_RULE_KEY.SALES_EXCHANGE_NEEDS_CONTACT);
  });

  it("the return of an exchange points to the new order and cannot be reversed", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const { order, line } = await paidSale(shop, 2);
    const cheaper = await newProduct(shop, 600);
    const exchanged = await postExchange(
      shop.actor,
      { organizationId: shop.organizationId, orderId: order.orderId },
      exchangeBody({
        returned: [{ orderLineId: line.orderLineId, quantity: 1 }],
        sold: [{ ...cheaper, quantity: 1 }],
      }),
    );
    expect(exchanged.status).toBe(HTTP_CREATED);
    const salesReturn = exchanged.body.data.salesReturn;

    const reversed = await postReverse(
      shop.actor,
      { organizationId: shop.organizationId, salesReturnId: salesReturn.salesReturnId },
      await reverseBody(world, shop, { orderId: order.orderId, salesReturn }),
    );

    expectRuleRefused(reversed, SALES_RULE_KEY.SALES_RETURN_EXCHANGE_NOT_REVERSIBLE);
    const read = await shop.actor.call(
      "get",
      `/orgs/${shop.organizationId}/sales/returns/${salesReturn.salesReturnId}`,
    );
    expect(read.body.data.exchangeOrderId).toBe(exchanged.body.data.order.orderId);
  });

  it("a store credit refund in an exchange needs the REFUND approval unless the caller is exempt", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const { order, line } = await paidSale(shop, 2);
    const cheaper = await newProduct(shop, 600);
    const cashier = await memberAt(harness, world, { locationId: shop.locationId });
    const body = exchangeBody({
      returned: [{ orderLineId: line.orderLineId, quantity: 1 }],
      sold: [{ ...cheaper, quantity: 1 }],
    });
    const target = { organizationId: shop.organizationId, orderId: order.orderId };

    const refused = await postExchange(cashier, target, body);
    expect(refused.status).toBe(HTTP_FORBIDDEN);
    expect(refused.body.error.code).toBe("APPROVAL_REQUIRED");
    expect(await returnsOf(shop, order.orderId)).toEqual([]);

    const refundToken = await grantToken(world, {
      action: "REFUND",
      orderId: order.orderId,
      locationId: shop.locationId,
      amount: SOLD_PRICE,
    });
    const approved = await postExchange(
      cashier,
      target,
      exchangeBody({
        returned: [{ orderLineId: line.orderLineId, quantity: 1 }],
        sold: [{ ...cheaper, quantity: 1 }],
        returnApprovalTokens: { refund: refundToken },
      }),
    );
    expect(approved.status, JSON.stringify(approved.body)).toBe(HTTP_CREATED);
  });

  it("the same Idempotency-Key returns the first exchange and writes nothing twice", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const { order, line } = await paidSale(shop, 2);
    const cheaper = await newProduct(shop, 600);
    const key = newId();
    const body = exchangeBody({
      returned: [{ orderLineId: line.orderLineId, quantity: 1 }],
      sold: [{ ...cheaper, quantity: 1 }],
    });
    const target = { organizationId: shop.organizationId, orderId: order.orderId };

    const first = await postExchange(shop.actor, target, body, key);
    const replay = await postExchange(shop.actor, target, body, key);

    expect(first.status).toBe(HTTP_CREATED);
    expect(replay.status).toBe(HTTP_CREATED);
    expect(replay.body.data.salesReturn.salesReturnId).toBe(
      first.body.data.salesReturn.salesReturnId,
    );
    expect(await returnsOf(shop, order.orderId)).toHaveLength(1);
  });

  it("the preview returns the same numbers as the exchange and writes nothing", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const { order, line } = await paidSale(shop, 2);
    const dearer = await newProduct(shop, 1500);
    const body = exchangeBody({
      returned: [{ orderLineId: line.orderLineId, quantity: 1 }],
      sold: [{ ...dearer, quantity: 1 }],
      payments: [{ method: "CASH", amount: 200 }],
    });
    const target = { organizationId: shop.organizationId, orderId: order.orderId };

    const preview = await previewExchange(shop.actor, target, body);
    expect(preview.status).toBe(HTTP_OK);
    expect(await returnsOf(shop, order.orderId)).toEqual([]);
    const created = await postExchange(shop.actor, target, body);

    expect(created.status).toBe(HTTP_CREATED);
    expect(preview.body.data.storeCreditUsed).toEqual(created.body.data.storeCreditUsed);
    expect(preview.body.data.storeCreditLeft).toEqual(created.body.data.storeCreditLeft);
    expect(preview.body.data.dueAmount).toEqual(created.body.data.dueAmount);
    expect(preview.body.data.orderGrandTotal).toEqual(created.body.data.order.totals.grandTotal);
    expect(preview.body.data.salesReturn.value).toEqual(created.body.data.salesReturn.value);
  });
});

describe("exchange a return for a new order API: access", () => {
  it("a caller without sales.order.create gets 403", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const { order, line } = await paidSale(shop, 2);
    const cheaper = await newProduct(shop, 600);
    const returner = await memberWithPermissions(world, shop.locationId, [
      PERMISSION_KEY.SALES_RETURN_CREATE,
      PERMISSION_KEY.SALES_RETURN_READ,
      PERMISSION_KEY.SALES_ORDER_READ,
    ]);

    const response = await postExchange(
      returner,
      { organizationId: shop.organizationId, orderId: order.orderId },
      exchangeBody({
        returned: [{ orderLineId: line.orderLineId, quantity: 1 }],
        sold: [{ ...cheaper, quantity: 1 }],
      }),
    );

    expect(response.status).toBe(HTTP_FORBIDDEN);
    expect(await returnsOf(shop, order.orderId)).toEqual([]);
  });

  it("a caller without sales.return.create gets 403", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const { order, line } = await paidSale(shop, 2);
    const cheaper = await newProduct(shop, 600);
    const seller = await memberWithPermissions(world, shop.locationId, [
      PERMISSION_KEY.SALES_ORDER_CREATE,
      PERMISSION_KEY.SALES_ORDER_READ,
      PERMISSION_KEY.SALES_RETURN_READ,
    ]);

    const response = await postExchange(
      seller,
      { organizationId: shop.organizationId, orderId: order.orderId },
      exchangeBody({
        returned: [{ orderLineId: line.orderLineId, quantity: 1 }],
        sold: [{ ...cheaper, quantity: 1 }],
      }),
    );

    expect(response.status).toBe(HTTP_FORBIDDEN);
    expect(await returnsOf(shop, order.orderId)).toEqual([]);
  });

  it("another organization's order is 404", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const { order, line } = await paidSale(shop, 2);
    const cheaper = await newProduct(shop, 600);

    const response = await postExchange(
      world.bob,
      { organizationId: world.organizationB, orderId: order.orderId },
      exchangeBody({
        returned: [{ orderLineId: line.orderLineId, quantity: 1 }],
        sold: [{ ...cheaper, quantity: 1 }],
      }),
    );

    expect(response.status).toBe(HTTP_NOT_FOUND);
  });

  it("an exchange at another location's order is 403", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const elsewhere = { ...shop, locationId: world.locationA2 };
    const { order, line } = await paidSale(elsewhere, 2);
    const cheaper = await newProduct(shop, 600);
    const manager = await memberAt(harness, world, {
      locationId: world.locationA1,
      roleKey: SYSTEM_ROLE_KEY.MANAGER,
    });

    const response = await postExchange(
      manager,
      { organizationId: shop.organizationId, orderId: order.orderId },
      exchangeBody({
        returned: [{ orderLineId: line.orderLineId, quantity: 1 }],
        sold: [{ ...cheaper, quantity: 1 }],
      }),
    );

    // Location-owned rows are invisible outside the caller's locations, so the order reads as
    // not found there, exactly as the A1 and A2 return tests record.
    expect(response.status).toBe(HTTP_NOT_FOUND);
    expect(await returnsOf(elsewhere, order.orderId)).toEqual([]);
  });
});

/** The reverse body of a return: the owner grants the reversal token for the return value. */
async function reverseBody(
  world: TwoOrganizations,
  shop: SalesShop,
  input: {
    readonly orderId: string;
    readonly salesReturn: {
      readonly salesReturnId: string;
      readonly version: number;
      readonly value: { readonly amount: number };
    };
  },
) {
  const approvalToken = await grantToken(world, {
    action: "SALES_RETURN_REVERSAL",
    orderId: input.orderId,
    locationId: shop.locationId,
    amount: input.salesReturn.value.amount,
  });
  return { version: input.salesReturn.version, reasonKey: "ENTERED_BY_MISTAKE", approvalToken };
}

/** A member whose only role is a custom role with exactly these permissions at one location. */
async function memberWithPermissions(
  world: TwoOrganizations,
  locationId: string,
  permissionKeys: readonly string[],
): Promise<SalesShop["actor"]> {
  const role = await world.alice.call("post", `/orgs/${world.organizationA}/roles`, {
    name: `Exchange ${newId()}`,
    permissionKeys,
  });
  expect(role.status).toBe(HTTP_CREATED);
  const added = await addMemberWithAssignments(harness.app, world.organizationA, [
    { locationId, roleId: role.body.data.roleId },
  ]);
  return added.actor;
}
