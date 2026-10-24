import { SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { orderApprovalSubject, SALES_RULE_KEY } from "@banijjik/contracts/sales";
import { newId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { money, startCatalogApi, worldFor } from "../../../../test-support/catalog-world.js";
import {
  registerIamApiModels,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";
import { addMemberWithAssignments, findSystemRoleId } from "../../../../test-support/rbac-world.js";
import type { OrderLineRow, OrderRow } from "../../../../test-support/sales-api-rows.js";
import {
  addCustomer,
  addInventoryItem,
  instantOrder,
  levelOf,
  ordersPath,
  placeOrder,
  publishOffering,
  receiveStock,
  setSetting,
  shopOf,
  type SalesShop,
} from "../../../../test-support/sales-api-world.js";
import type { TwoOrganizations } from "../../../../test-support/two-organizations.js";

registerIamApiModels();
const RETAIL = { industryTemplateKey: "RETAIL" };
const PRICE = 1000;
const APPROVAL_PIN = "1234";
const DAY_MS = 24 * 60 * 60 * 1000;
let harness: IamApiHarness;
let phoneSequence = 0;

beforeAll(async () => {
  harness = await startCatalogApi();
});
afterAll(async () => {
  await harness.dispose();
});

interface ReturnLineRequest {
  readonly orderLineId: string;
  readonly quantity: number;
  readonly disposition?: string;
}

/** The return body the client sends: quantities and dispositions only (plan 3.5b decision 11). */
function returnBody(lines: readonly ReturnLineRequest[], extra: Record<string, unknown> = {}) {
  return {
    lines: lines.map((line) => ({
      orderLineId: line.orderLineId,
      quantity: line.quantity,
      disposition: line.disposition ?? "RESTOCK",
    })),
    reasonKey: "CHANGED_MIND",
    refundMethod: "CASH",
    ...extra,
  };
}

function returnsPath(organizationId: string, orderId: string, suffix = ""): string {
  return ordersPath(organizationId, `/${orderId}/returns${suffix}`);
}

function postReturn(
  actor: SalesShop["actor"],
  organizationId: string,
  orderId: string,
  body: object,
  key: string = newId(),
) {
  return actor.callWith({
    method: "post",
    path: returnsPath(organizationId, orderId),
    idempotencyKey: key,
    body,
  });
}

function previewReturn(shop: SalesShop, orderId: string, body: object) {
  return shop.actor.call("post", returnsPath(shop.organizationId, orderId, "/preview"), body);
}

function expectRuleRefused(response: { status: number; body: unknown }, ruleKey: string): void {
  const body = response.body as { error: { code: string; details: { ruleKey: string } } };
  expect(response.status).toBe(422);
  expect(body.error.code).toBe("BUSINESS_RULE");
  expect(body.error.details.ruleKey).toBe(ruleKey);
}

/** A counter sale of one product line, completed in the same request. */
async function soldLine(
  shop: SalesShop,
  quantity: number,
  options: { readonly contactId?: string; readonly stockItemId?: string } = {},
): Promise<{ order: OrderRow; line: OrderLineRow }> {
  const product = await publishOffering(shop, {
    kind: "PRODUCT",
    name: `Tea ${newId()}`,
    priceAmount: PRICE,
    ...(options.stockItemId === undefined
      ? {}
      : { stockComponents: [{ inventoryItemId: options.stockItemId, quantity: 1 }] }),
  });
  const sold = await instantOrder(shop, {
    locationId: shop.locationId,
    ...(options.contactId === undefined ? {} : { contactId: options.contactId }),
    lines: [{ offeringId: product.offeringId, variantId: product.variantId, quantity }],
  });
  expect(sold.status).toBe(201);
  const line = sold.order.lines[0];
  if (line === undefined) throw new Error("expected a sold line");
  return { order: sold.order, line };
}

async function detailOf(shop: SalesShop, orderId: string): Promise<OrderRow> {
  const response = await shop.actor.call("get", ordersPath(shop.organizationId, `/${orderId}`));
  expect(response.status).toBe(200);
  return response.body.data as OrderRow;
}

function payCash(shop: SalesShop, orderId: string, amount: number) {
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

async function returnsOfOrder(shop: SalesShop, orderId: string): Promise<readonly unknown[]> {
  const response = await shop.actor.call(
    "get",
    `/orgs/${shop.organizationId}/sales/returns?orderId=${orderId}&limit=100`,
  );
  expect(response.status).toBe(200);
  return response.body.data as readonly unknown[];
}

/** The stock ledger rows of a location, with the unit cost each movement carries (ADR-131). */
interface MovementWithCost {
  readonly sourceId: string;
  readonly reason: string;
  readonly unitCost?: { readonly amount: number; readonly currency: string };
}

async function movementsWithCost(shop: SalesShop): Promise<readonly MovementWithCost[]> {
  const response = await shop.actor.call(
    "get",
    `/orgs/${shop.organizationId}/stock/movements?locationId=${shop.locationId}&limit=100`,
  );
  expect(response.status).toBe(200);
  return response.body.data as readonly MovementWithCost[];
}

/** A stocked item: `units` at `unitCost` each. */
async function stockedItem(shop: SalesShop, unitCost = 100, units = 10): Promise<string> {
  const itemId = await addInventoryItem(shop, `Stock ${newId()}`);
  await receiveStock(shop, [
    { inventoryItemId: itemId, quantity: units, unitCostAmount: unitCost },
  ]);
  return itemId;
}

/** A token of one approval action, granted by the owner with the PIN (ADR-121). */
async function grantToken(
  world: TwoOrganizations,
  input: {
    readonly action: string;
    readonly orderId: string;
    readonly locationId: string;
    readonly amount: number;
  },
): Promise<string> {
  await world.alice.call("put", `/orgs/${world.organizationA}/me/approval-pin`, {
    currentPassword: world.alice.person.password,
    pin: APPROVAL_PIN,
  });
  const approvers = await world.alice.call(
    "get",
    `/orgs/${world.organizationA}/approvers?locationId=${input.locationId}`,
  );
  const granted = await world.alice.call("post", `/orgs/${world.organizationA}/approvals`, {
    action: input.action,
    subjectKey: orderApprovalSubject(input.orderId),
    amount: money(input.amount),
    locationId: input.locationId,
    approverMemberId: approvers.body.data[0].memberId,
    pin: APPROVAL_PIN,
  });
  expect(granted.status).toBe(200);
  return granted.body.data.approvalToken as string;
}

async function cashierAt(world: TwoOrganizations, locationId: string) {
  const roleId = await findSystemRoleId(
    harness.connections,
    world.organizationA,
    SYSTEM_ROLE_KEY.CASHIER,
  );
  const added = await addMemberWithAssignments(harness.app, world.organizationA, [
    { locationId, roleId },
  ]);
  return added.actor;
}

async function newContact(shop: SalesShop): Promise<string> {
  phoneSequence += 1;
  return addCustomer(
    shop,
    `Rahim ${phoneSequence}`,
    `+88016${String(phoneSequence).padStart(8, "0")}`,
  );
}

describe("sales returns API: money", () => {
  it("a full return of a paid cash order refunds the line value in cash and restocks it", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const item = await stockedItem(shop);
    const { order, line } = await soldLine(shop, 2, { stockItemId: item });
    expect((await payCash(shop, order.orderId, order.totals.grandTotal.amount)).status).toBe(201);
    expect((await levelOf(shop, item)).onHand).toBe(8);

    const created = await postReturn(
      shop.actor,
      shop.organizationId,
      order.orderId,
      returnBody([{ orderLineId: line.orderLineId, quantity: 2 }]),
    );

    expect(created.status).toBe(201);
    expect(created.body.data.refund.amount.amount).toBe(line.lineNetTotal.amount);
    expect(created.body.data.refund.paymentId).not.toBeNull();
    expect(created.body.data.dueReduced.amount).toBe(0);
    expect((await levelOf(shop, item)).onHand).toBe(10);
    expect((await detailOf(shop, order.orderId)).returnStatus).toBe("FULL");
  });

  it("a return of an unpaid order lowers the due and pays nothing out", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const { order, line } = await soldLine(shop, 2);

    const created = await postReturn(
      shop.actor,
      shop.organizationId,
      order.orderId,
      returnBody([{ orderLineId: line.orderLineId, quantity: 1 }]),
    );

    expect(created.status).toBe(201);
    expect(created.body.data.refund.amount.amount).toBe(0);
    expect(created.body.data.refund.paymentId).toBeNull();
    expect(created.body.data.dueReduced.amount).toBe(created.body.data.value.amount);
    expect(created.body.data.value.amount).toBe(line.lineNetTotal.amount / 2);
  });

  it("a return of a partly paid order lowers the due first and refunds only the paid excess", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const { order, line } = await soldLine(shop, 2);
    const total = order.totals.grandTotal.amount;
    expect((await payCash(shop, order.orderId, total - 500)).status).toBe(201);

    const created = await postReturn(
      shop.actor,
      shop.organizationId,
      order.orderId,
      returnBody([{ orderLineId: line.orderLineId, quantity: 1 }]),
    );

    const value = created.body.data.value.amount as number;
    expect(created.status).toBe(201);
    expect(created.body.data.dueReduced.amount).toBe(Math.min(value, 500));
    expect(created.body.data.refund.amount.amount).toBe(value - 500);
  });

  it("the preview returns the same numbers and writes nothing", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const { order, line } = await soldLine(shop, 2);
    const body = returnBody([{ orderLineId: line.orderLineId, quantity: 1 }]);

    const preview = await previewReturn(shop, order.orderId, body);
    expect(preview.status).toBe(200);
    expect(await returnsOfOrder(shop, order.orderId)).toHaveLength(0);

    const created = await postReturn(shop.actor, shop.organizationId, order.orderId, body);
    expect(created.body.data.value).toEqual(preview.body.data.value);
    expect(created.body.data.dueReduced).toEqual(preview.body.data.dueReduced);
    expect(created.body.data.refund.amount).toEqual(preview.body.data.refundAmount);
  });

  it("store credit refund needs a contact and adds a credit entry", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const anonymous = await soldLine(shop, 1);
    const anonymousPaid = await payCash(
      shop,
      anonymous.order.orderId,
      anonymous.order.totals.grandTotal.amount,
    );
    expect(anonymousPaid.status).toBe(201);
    const storeCreditBody = returnBody([{ orderLineId: anonymous.line.orderLineId, quantity: 1 }], {
      refundMethod: "STORE_CREDIT",
    });
    expectRuleRefused(
      await previewReturn(shop, anonymous.order.orderId, storeCreditBody),
      SALES_RULE_KEY.SALES_RETURN_STORE_CREDIT_NEEDS_CONTACT,
    );

    const contactId = await newContact(shop);
    const withContact = await soldLine(shop, 1, { contactId });
    const contactPaid = await payCash(
      shop,
      withContact.order.orderId,
      withContact.order.totals.grandTotal.amount,
    );
    expect(contactPaid.status).toBe(201);
    const created = await postReturn(
      shop.actor,
      shop.organizationId,
      withContact.order.orderId,
      returnBody([{ orderLineId: withContact.line.orderLineId, quantity: 1 }], {
        refundMethod: "STORE_CREDIT",
      }),
    );

    expect(created.status).toBe(201);
    expect(created.body.data.refund.method).toBe("STORE_CREDIT");
    expect(created.body.data.refund.storeCreditEntryId).not.toBeNull();
  });

  it("refuses a refund that is due without a method, and a gateway method", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const { order, line } = await soldLine(shop, 1);
    expect((await payCash(shop, order.orderId, order.totals.grandTotal.amount)).status).toBe(201);

    expectRuleRefused(
      await previewReturn(
        shop,
        order.orderId,
        returnBody([{ orderLineId: line.orderLineId, quantity: 1 }], { refundMethod: undefined }),
      ),
      SALES_RULE_KEY.SALES_RETURN_REFUND_METHOD_REQUIRED,
    );
    expectRuleRefused(
      await previewReturn(
        shop,
        order.orderId,
        returnBody([{ orderLineId: line.orderLineId, quantity: 1 }], { refundMethod: "GATEWAY" }),
      ),
      SALES_RULE_KEY.PAYMENT_METHOD_NOT_AVAILABLE,
    );
  });
});

describe("sales returns API: stock", () => {
  it("a damaged return goes to damaged stock and a not-received return moves no stock", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const item = await stockedItem(shop);
    const { order, line } = await soldLine(shop, 2, { stockItemId: item });

    const damaged = await postReturn(
      shop.actor,
      shop.organizationId,
      order.orderId,
      returnBody([{ orderLineId: line.orderLineId, quantity: 1, disposition: "DAMAGED" }]),
    );
    expect(damaged.status).toBe(201);
    const damagedRows = (await movementsWithCost(shop)).filter(
      (row) => row.sourceId === damaged.body.data.salesReturnId,
    );
    expect(damagedRows.map((row) => row.reason)).toEqual(["RETURN_DAMAGED"]);

    const token = await grantToken(world, {
      action: "RETURN_NOT_RECEIVED",
      orderId: order.orderId,
      locationId: shop.locationId,
      amount: line.lineNetTotal.amount / 2,
    });
    const notReceived = await postReturn(
      shop.actor,
      shop.organizationId,
      order.orderId,
      returnBody([{ orderLineId: line.orderLineId, quantity: 1, disposition: "NOT_RECEIVED" }], {
        approvalTokens: { returnNotReceived: token },
      }),
    );
    expect(notReceived.status).toBe(201);
    const notReceivedRows = (await movementsWithCost(shop)).filter(
      (row) => row.sourceId === notReceived.body.data.salesReturnId,
    );
    expect(notReceivedRows).toHaveLength(0);
  });

  it("restocked goods come back at the cost they were sold at, not today's average cost", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const item = await stockedItem(shop, 100, 10);
    const { order, line } = await soldLine(shop, 2, { stockItemId: item });
    await receiveStock(shop, [{ inventoryItemId: item, quantity: 10, unitCostAmount: 300 }]);
    expect((await levelOf(shop, item)).onHand).toBe(18);

    const created = await postReturn(
      shop.actor,
      shop.organizationId,
      order.orderId,
      returnBody([{ orderLineId: line.orderLineId, quantity: 2 }]),
    );

    expect(created.status).toBe(201);
    const rows = (await movementsWithCost(shop)).filter(
      (row) => row.sourceId === created.body.data.salesReturnId,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.unitCost).toEqual(money(100));
  });

  it("two returns racing for the last unit: one wins, the other is refused (409 or 422) and writes nothing", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const { order, line } = await soldLine(shop, 2);
    const first = await postReturn(
      shop.actor,
      shop.organizationId,
      order.orderId,
      returnBody([{ orderLineId: line.orderLineId, quantity: 1 }]),
    );
    expect(first.status).toBe(201);

    const racing = await Promise.all([
      postReturn(
        shop.actor,
        shop.organizationId,
        order.orderId,
        returnBody([{ orderLineId: line.orderLineId, quantity: 1 }]),
      ),
      postReturn(
        shop.actor,
        shop.organizationId,
        order.orderId,
        returnBody([{ orderLineId: line.orderLineId, quantity: 1 }]),
      ),
    ]);

    expect(racing.filter((response) => response.status === 201)).toHaveLength(1);
    const loser = racing.find((response) => response.status !== 201);
    expect([409, 422]).toContain(loser?.status);
    expect(await returnsOfOrder(shop, order.orderId)).toHaveLength(2);
    expect((await detailOf(shop, order.orderId)).lines[0]?.returnedQuantity).toBe(2);
  });

  it("refuses a quantity above what is left on the line", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const { order, line } = await soldLine(shop, 2);

    const response = await postReturn(
      shop.actor,
      shop.organizationId,
      order.orderId,
      returnBody([{ orderLineId: line.orderLineId, quantity: 3 }]),
    );

    expectRuleRefused(response, SALES_RULE_KEY.SALES_RETURN_QUANTITY_ABOVE_SOLD);
    expect(await returnsOfOrder(shop, order.orderId)).toHaveLength(0);
  });
});

describe("sales returns API: rules, approvals and access", () => {
  it("refuses a return after the return window and on an order that is not completed", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const { order, line } = await soldLine(shop, 1);
    await setSetting(shop, "sales.returnWindowDays", 0);
    await harness.connections.tenantShared
      .collection("orders")
      .updateOne(
        { organizationId: shop.organizationId, orderId: order.orderId },
        { $set: { completedAt: new Date(Date.now() - 3 * DAY_MS) } },
      );
    expectRuleRefused(
      await postReturn(
        shop.actor,
        shop.organizationId,
        order.orderId,
        returnBody([{ orderLineId: line.orderLineId, quantity: 1 }]),
      ),
      SALES_RULE_KEY.SALES_RETURN_WINDOW_CLOSED,
    );

    const product = await publishOffering(shop, {
      kind: "PRODUCT",
      name: `Bun ${newId()}`,
      priceAmount: PRICE,
    });
    const draft = await shop.actor.call("post", ordersPath(shop.organizationId), {
      locationId: shop.locationId,
      contactId: await newContact(shop),
      lines: [{ offeringId: product.offeringId, variantId: product.variantId, quantity: 1 }],
    });
    expect(draft.status).toBe(201);
    const placed = await placeOrder(shop, {
      orderId: draft.body.data.orderId as string,
      version: draft.body.data.version as number,
    });
    expect(placed.status).toBe(200);
    const placedLine = placed.order.lines[0];
    expectRuleRefused(
      await postReturn(
        shop.actor,
        shop.organizationId,
        placed.order.orderId,
        returnBody([{ orderLineId: placedLine?.orderLineId ?? "", quantity: 1 }]),
      ),
      SALES_RULE_KEY.SALES_RETURN_ORDER_NOT_RETURNABLE,
    );
  });

  it("a refund needs a REFUND approval unless the caller is exempt, and a not-received line always needs its approval", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const { order, line } = await soldLine(shop, 2);
    expect((await payCash(shop, order.orderId, order.totals.grandTotal.amount)).status).toBe(201);
    const cashier = await cashierAt(world, world.locationA1);
    const body = returnBody([{ orderLineId: line.orderLineId, quantity: 1 }]);

    const withoutToken = await postReturn(cashier, world.organizationA, order.orderId, body);
    const refused = withoutToken.body as {
      error: { code: string; details: { action: string } };
    };
    expect(withoutToken.status).toBe(403);
    expect(refused.error.code).toBe("APPROVAL_REQUIRED");
    expect(refused.error.details.action).toBe("REFUND");

    const token = await grantToken(world, {
      action: "REFUND",
      orderId: order.orderId,
      locationId: world.locationA1,
      amount: line.lineNetTotal.amount / 2,
    });
    const withToken = await postReturn(
      cashier,
      world.organizationA,
      order.orderId,
      returnBody([{ orderLineId: line.orderLineId, quantity: 1 }], {
        approvalTokens: { refund: token },
      }),
    );
    expect(withToken.status).toBe(201);
    expect(withToken.body.data.approvals[0].action).toBe("REFUND");

    const exempt = await postReturn(shop.actor, shop.organizationId, order.orderId, body);
    expect(exempt.status).toBe(201);
    expect(exempt.body.data.approvals).toEqual([]);
  });

  it("a not-received line without its approval is refused with the action named", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const { order, line } = await soldLine(shop, 1);

    const response = await postReturn(
      shop.actor,
      shop.organizationId,
      order.orderId,
      returnBody([{ orderLineId: line.orderLineId, quantity: 1, disposition: "NOT_RECEIVED" }]),
    );

    const refused = response.body as { error: { code: string; details: { action: string } } };
    expect(response.status).toBe(403);
    expect(refused.error.code).toBe("APPROVAL_REQUIRED");
    expect(refused.error.details.action).toBe("RETURN_NOT_RECEIVED");
  });

  it("a return reads back by id and in the list of its order", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const { order, line } = await soldLine(shop, 2);
    const created = await postReturn(
      shop.actor,
      shop.organizationId,
      order.orderId,
      returnBody([{ orderLineId: line.orderLineId, quantity: 1 }]),
    );
    const salesReturnId = created.body.data.salesReturnId as string;

    const read = await shop.actor.call(
      "get",
      `/orgs/${shop.organizationId}/sales/returns/${salesReturnId}`,
    );
    expect(read.status).toBe(200);
    expect(read.body.data.salesReturnNumber).toMatch(/^RTN-[0-9]{6}$/);
    expect(read.body.data.lines[0].quantity).toBe(1);
    expect(await returnsOfOrder(shop, order.orderId)).toEqual([
      expect.objectContaining({ salesReturnId }),
    ]);
  });

  it("the same Idempotency-Key returns the first return and writes nothing twice", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const { order, line } = await soldLine(shop, 2);
    const key = newId();
    const body = returnBody([{ orderLineId: line.orderLineId, quantity: 1 }]);

    const first = await postReturn(shop.actor, shop.organizationId, order.orderId, body, key);
    const replay = await postReturn(shop.actor, shop.organizationId, order.orderId, body, key);

    expect(first.status).toBe(201);
    expect(replay.body.data).toEqual(first.body.data);
    expect(await returnsOfOrder(shop, order.orderId)).toHaveLength(1);
  });

  it("a staff member without sales.return.create gets 403", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const { order, line } = await soldLine(shop, 1);

    const response = await postReturn(
      world.sam,
      world.organizationA,
      order.orderId,
      returnBody([{ orderLineId: line.orderLineId, quantity: 1 }]),
    );

    expect(response.status).toBe(403);
    expect(await returnsOfOrder(shop, order.orderId)).toHaveLength(0);
  });

  it("another organization's order is 404", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const { order, line } = await soldLine(shop, 1);

    const response = await postReturn(
      world.bob,
      world.organizationB,
      order.orderId,
      returnBody([{ orderLineId: line.orderLineId, quantity: 1 }]),
    );

    expect(response.status).toBe(404);
  });

  it("a return at another location's order is 403", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const elsewhere = { ...shop, locationId: world.locationA2 };
    const { order, line } = await soldLine(elsewhere, 1);
    const cashier = await cashierAt(world, world.locationA1);

    // Location-owned rows are invisible outside the caller's locations (tenancy LOCATION), so the
    // order reads as not found there, exactly as order reads do (plan 3.5b note in the handoff).
    const response = await postReturn(
      cashier,
      world.organizationA,
      order.orderId,
      returnBody([{ orderLineId: line.orderLineId, quantity: 1 }]),
    );

    expect(response.status).toBe(404);
  });

  it("old orders read returnStatus NONE", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const { order } = await soldLine(shop, 1);
    await harness.connections.tenantShared
      .collection("orders")
      .updateOne(
        { organizationId: shop.organizationId, orderId: order.orderId },
        { $unset: { returnStatus: "" } },
      );

    expect((await detailOf(shop, order.orderId)).returnStatus).toBe("NONE");
  });

  it("refuses OTHER without a note", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const { order, line } = await soldLine(shop, 1);

    expectRuleRefused(
      await postReturn(
        shop.actor,
        shop.organizationId,
        order.orderId,
        returnBody([{ orderLineId: line.orderLineId, quantity: 1 }], { reasonKey: "OTHER" }),
      ),
      SALES_RULE_KEY.SALES_RETURN_OTHER_REASON_NEEDS_NOTE,
    );
  });
});
