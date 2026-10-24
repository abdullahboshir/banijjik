import { ALL_LOCATIONS, SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { ORDER_STATUS, SALES_RULE_KEY, orderApprovalSubject } from "@banijjik/contracts/sales";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { API_PASSWORD } from "../../../../test-support/auth-api-scenarios.js";
import { money, startCatalogApi, worldFor } from "../../../../test-support/catalog-world.js";
import { registerIamApiModels } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import { addMemberWithAssignments, findSystemRoleId } from "../../../../test-support/rbac-world.js";
import type { OrderRow } from "../../../../test-support/sales-api-rows.js";
import {
  addCustomer,
  addInventoryItem,
  approvalTokenFor,
  cancelOrder,
  completeOrder,
  confirmOrder,
  draftOrder,
  getOrder,
  levelOf,
  ordersPath,
  patchOrder,
  placeOrder,
  publishOffering,
  quoteOf,
  receiveStock,
  setSetting,
  shopOf,
  transitionOrder,
} from "../../../../test-support/sales-api-world.js";
import type { SalesShop } from "../../../../test-support/sales-api-world.js";
import type { TwoOrganizations } from "../../../../test-support/two-organizations.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };

const PACK_GRAMS = 1_000;
const PACK_PRICE = 10_000;
const RICE_COST_PER_GRAM = 60;
const RAHIM_PHONE = "+8801700000001";
/** A contact dedupes on the phone inside one organization, so a second order needs another. */
const KARIM_PHONE = "+8801700000002";
const PACKS_ON_SHELF = 6;
/** The approval threshold of the package is ten percent, so this stays inside it. */
const TEN_PERCENT_BP = 1_000;
const TWENTY_PERCENT_BP = 2_000;
/** Three packs carry a fifth of 30 000, so the token must cover this much. */
const THREE_PACK_DISCOUNT = 6_000;
const APPROVAL_PIN = "4321";

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startCatalogApi();
});

afterAll(async () => {
  await harness.dispose();
});

interface Pack {
  readonly offeringId: string;
  readonly variantId: string;
  readonly riceItemId: string;
}

interface ManualDiscount {
  readonly type: string;
  readonly value: number;
}

async function shelfOf(shop: SalesShop): Promise<Pack> {
  const riceItemId = await addInventoryItem(shop, "Rice");
  const pack = await publishOffering(shop, {
    kind: "PRODUCT",
    name: "Rice 1kg pack",
    priceAmount: PACK_PRICE,
    stockComponents: [{ inventoryItemId: riceItemId, quantity: PACK_GRAMS }],
  });
  await receiveStock(shop, [
    {
      inventoryItemId: riceItemId,
      quantity: PACKS_ON_SHELF * PACK_GRAMS,
      unitCostAmount: RICE_COST_PER_GRAM,
    },
  ]);
  return { ...pack, riceItemId };
}

function lineOf(pack: Pack, quantity: number, manualDiscount?: ManualDiscount) {
  return {
    offeringId: pack.offeringId,
    variantId: pack.variantId,
    quantity,
    ...(manualDiscount === undefined ? {} : { manualDiscount }),
  };
}

async function drafted(
  shop: SalesShop,
  pack: Pack,
  quantity: number,
  phone = RAHIM_PHONE,
): Promise<OrderRow> {
  const contactId = await addCustomer(shop, "Rahim", phone);
  return draftOrder(shop, {
    locationId: shop.locationId,
    contactId,
    lines: [lineOf(pack, quantity)],
  });
}

/**
 * The manoxen totals invariants, read back from the stored row: what the shop charges is the sum of
 * the lines it holds, a pickup order carries no delivery charge, and no client number got in.
 */
function assertMoneyHolds(order: OrderRow): void {
  const sumOfLineNets = order.lines.reduce((sum, line) => sum + line.lineNetTotal.amount, 0);
  expect(order.totals.grandTotal.amount).toBe(
    sumOfLineNets + order.totals.roundingAdjustment.amount,
  );
  expect(order.totals.deliveryCharge.amount).toBe(0);
  for (const line of order.lines) expect(line.unitPrice).toEqual(money(PACK_PRICE));
}

/** A PATCH that must succeed, answered with the row the shop now holds. */
async function editOrder(
  shop: SalesShop,
  order: { orderId: string; version: number },
  body: object,
): Promise<OrderRow> {
  const response = await patchOrder(shop, {
    orderId: order.orderId,
    body: { version: order.version, ...body },
  });
  expect(response.status).toBe(200);
  return response.order;
}

/** A manager with an approval PIN, so an over-threshold edit can be tokened over the counter. */
async function approverOf(world: TwoOrganizations): Promise<string> {
  const managerRoleId = await findSystemRoleId(
    harness.connections,
    world.organizationA,
    SYSTEM_ROLE_KEY.MANAGER,
  );
  const manager = await addMemberWithAssignments(harness.app, world.organizationA, [
    { locationId: ALL_LOCATIONS, roleId: managerRoleId },
  ]);
  const pin = await manager.actor.call("put", `/orgs/${world.organizationA}/me/approval-pin`, {
    currentPassword: API_PASSWORD,
    pin: APPROVAL_PIN,
  });
  expect(pin.status).toBe(204);
  return manager.memberId;
}

/** A PATCH answered raw, so a refusal can be read down to its rule key. */
function rawPatch(shop: SalesShop, orderId: string, body: object) {
  return shop.actor.call("patch", ordersPath(shop.organizationId, `/${orderId}`), body);
}

describe("the money and the stock an edited order keeps", () => {
  it("re-quotes a placed order so the totals follow the lines and the reservation follows them", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const pack = await shelfOf(shop);
    const draft = await drafted(shop, pack, 1);
    const placed = await placeOrder(shop, { orderId: draft.orderId, version: draft.version });
    expect(placed.status).toBe(200);
    const before = placed.order;
    expect(before.totals.subtotal).toEqual(money(PACK_PRICE));

    const thrice = await editOrder(shop, before, { lines: [lineOf(pack, 3)] });

    expect(thrice.status).toBe(ORDER_STATUS.PLACED);
    expect(thrice.orderNumber).toBe(before.orderNumber);
    expect(thrice.version).toBe(before.version + 1);
    expect(thrice.totals).toMatchObject((await quoteOf(shop, [lineOf(pack, 3)])).totals as object);
    assertMoneyHolds(thrice);
    expect(await levelOf(shop, pack.riceItemId)).toEqual({
      onHand: PACKS_ON_SHELF * PACK_GRAMS,
      reserved: 3 * PACK_GRAMS,
    });
  });

  it("the order read returns the manual and order discount rules", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const pack = await shelfOf(shop);
    const contactId = await addCustomer(shop, "Rahim", RAHIM_PHONE);
    const lineRule = { type: "PERCENT", value: TEN_PERCENT_BP };
    const orderRule = { type: "AMOUNT", value: 500 };
    const draft = await draftOrder(shop, {
      locationId: shop.locationId,
      contactId,
      lines: [lineOf(pack, 2, lineRule)],
      orderDiscount: orderRule,
    });

    const read = await getOrder(shop, draft.orderId);
    expect(read.lines[0]?.manualDiscount).toEqual(lineRule);
    expect(read.orderDiscount).toEqual(orderRule);

    // The placed order keeps the rules too, so an edit can replay them from the read.
    const placed = await placeOrder(shop, { orderId: draft.orderId, version: draft.version });
    expect(placed.status).toBe(200);
    expect(placed.order.lines[0]?.manualDiscount).toEqual(lineRule);
    expect(placed.order.orderDiscount).toEqual(orderRule);
  });

  it("a line edit that resends the manual discount keeps it", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const pack = await shelfOf(shop);
    const contactId = await addCustomer(shop, "Rahim", RAHIM_PHONE);
    const rule = { type: "PERCENT", value: TEN_PERCENT_BP };
    const draft = await draftOrder(shop, {
      locationId: shop.locationId,
      contactId,
      lines: [lineOf(pack, 2, rule)],
    });
    const placed = await placeOrder(shop, { orderId: draft.orderId, version: draft.version });
    expect(placed.status).toBe(200);

    const edited = await editOrder(shop, placed.order, { lines: [lineOf(pack, 3, rule)] });

    expect(edited.lines[0]?.quantity).toBe(3);
    expect(edited.lines[0]?.manualDiscount).toEqual(rule);
    expect(edited.lines[0]?.lineDiscount.amount).toBeGreaterThan(0);
    expect(edited.totals.discountTotal.amount).toBeGreaterThan(0);
  });

  it("keeps the price snapshot and the discount when a confirmed order is amended", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const pack = await shelfOf(shop);
    const draft = await drafted(shop, pack, 2);
    const placed = await placeOrder(shop, { orderId: draft.orderId, version: draft.version });
    expect(placed.status).toBe(200);
    const confirmed = await confirmOrder(shop, {
      orderId: draft.orderId,
      version: placed.order.version,
    });

    const lines = [lineOf(pack, 3, { type: "PERCENT", value: TEN_PERCENT_BP })];
    const amended = await editOrder(shop, confirmed, { lines, note: "Added a bag" });

    expect(amended.status).toBe(ORDER_STATUS.CONFIRMED);
    expect(amended.note).toBe("Added a bag");
    const quote = await quoteOf(shop, lines);
    expect(amended.totals).toMatchObject(quote.totals as object);
    expect(amended.totals.discountTotal.amount).toBeGreaterThan(0);
    expect(amended.lines.map((line) => line.lineNetTotal)).toEqual(
      quote.lines.map((line) => line.lineNetTotal),
    );
    assertMoneyHolds(amended);
    expect(await levelOf(shop, pack.riceItemId)).toEqual({
      onHand: PACKS_ON_SHELF * PACK_GRAMS,
      reserved: 3 * PACK_GRAMS,
    });
  });

  it("zeroes the totals when an edit clears every line of a draft", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const pack = await shelfOf(shop);
    const draft = await drafted(shop, pack, 1);

    const cleared = await editOrder(shop, draft, { lines: [] });

    expect(cleared.status).toBe(ORDER_STATUS.DRAFT);
    expect(cleared.lines).toEqual([]);
    expect(cleared.totals).toEqual({
      subtotal: money(0),
      discountTotal: money(0),
      taxTotal: money(0),
      deliveryCharge: money(0),
      grandTotal: money(0),
      roundingAdjustment: money(0),
    });
    expect(await levelOf(shop, pack.riceItemId)).toEqual({
      onHand: PACKS_ON_SHELF * PACK_GRAMS,
      reserved: 0,
    });
  });

  it("refuses an edit once the order has left the editable statuses", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    await setSetting(shop, "sales.usePacking", true);
    const pack = await shelfOf(shop);
    const draft = await drafted(shop, pack, 1);
    const placed = await placeOrder(shop, { orderId: draft.orderId, version: draft.version });
    expect(placed.status).toBe(200);
    const confirmed = await confirmOrder(shop, {
      orderId: draft.orderId,
      version: placed.order.version,
    });
    const packed = await transitionOrder(shop, {
      orderId: draft.orderId,
      action: "pack",
      version: confirmed.version,
    });
    expect(packed.status).toBe(200);

    const afterPack = await patchOrder(shop, {
      orderId: draft.orderId,
      body: { version: packed.order.version, lines: [lineOf(pack, 2)] },
    });
    expect(afterPack.status).toBe(409);
    expect((await getOrder(shop, draft.orderId)).totals.subtotal).toEqual(money(PACK_PRICE));

    const completed = await completeOrder(shop, {
      orderId: draft.orderId,
      version: packed.order.version,
    });
    const afterComplete = await patchOrder(shop, {
      orderId: draft.orderId,
      body: { version: completed.version, lines: [lineOf(pack, 5)] },
    });
    expect(afterComplete.status).toBe(409);

    const otherDraft = await drafted(shop, pack, 1, KARIM_PHONE);
    const second = await placeOrder(shop, {
      orderId: otherDraft.orderId,
      version: otherDraft.version,
    });
    expect(second.status).toBe(200);
    const cancelled = await cancelOrder(shop, {
      orderId: otherDraft.orderId,
      version: second.order.version,
      reason: "Customer changed mind",
    });
    expect(cancelled.status).toBe(200);
    const afterCancel = await patchOrder(shop, {
      orderId: otherDraft.orderId,
      body: { version: cancelled.order.version, note: "Too late" },
    });
    expect(afterCancel.status).toBe(409);
    // The completed order took its pack off the shelf and the cancelled one gave its reservation back.
    expect(await levelOf(shop, pack.riceItemId)).toEqual({
      onHand: PACKS_ON_SHELF * PACK_GRAMS - PACK_GRAMS,
      reserved: 0,
    });
  });

  it("refuses an over-threshold discount added by an edit and never moves the reservation", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    await setSetting(shop, "sales.discountOwnerWithoutApproval", false);
    const pack = await shelfOf(shop);
    const draft = await drafted(shop, pack, 1);
    const placed = await placeOrder(shop, { orderId: draft.orderId, version: draft.version });
    expect(placed.status).toBe(200);

    const refused = await patchOrder(shop, {
      orderId: draft.orderId,
      body: {
        version: placed.order.version,
        lines: [lineOf(pack, 3, { type: "PERCENT", value: TWENTY_PERCENT_BP })],
      },
    });
    expect(refused.status).toBe(403);

    const unchanged = await getOrder(shop, draft.orderId);
    expect(unchanged.totals).toEqual(placed.order.totals);
    expect(unchanged.lines[0]?.quantity).toBe(1);
    expect(await levelOf(shop, pack.riceItemId)).toEqual({
      onHand: PACKS_ON_SHELF * PACK_GRAMS,
      reserved: PACK_GRAMS,
    });
  });

  it("refuses an edit whose token approves less than the discount it adds", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const approverMemberId = await approverOf(world);
    await setSetting(shop, "sales.discountOwnerWithoutApproval", false);
    const pack = await shelfOf(shop);
    const draft = await drafted(shop, pack, 1);
    const placed = await placeOrder(shop, { orderId: draft.orderId, version: draft.version });
    expect(placed.status).toBe(200);
    const lines = [lineOf(pack, 3, { type: "PERCENT", value: TWENTY_PERCENT_BP })];
    const tokenInput = (amount: number) => ({
      approverMemberId,
      subjectKey: orderApprovalSubject(draft.orderId),
      locationId: shop.locationId,
      pin: APPROVAL_PIN,
      amount: money(amount),
    });

    const shortToken = await approvalTokenFor(
      world.alice,
      shop.organizationId,
      tokenInput(TEN_PERCENT_BP),
    );
    const short = await patchOrder(shop, {
      orderId: draft.orderId,
      body: { version: placed.order.version, lines, approvalToken: shortToken },
    });
    expect(short.status).toBe(403);
    expect(await levelOf(shop, pack.riceItemId)).toEqual({
      onHand: PACKS_ON_SHELF * PACK_GRAMS,
      reserved: PACK_GRAMS,
    });

    const fullToken = await approvalTokenFor(
      world.alice,
      shop.organizationId,
      tokenInput(THREE_PACK_DISCOUNT),
    );
    const approved = await editOrder(shop, placed.order, { lines, approvalToken: fullToken });
    expect(approved.status).toBe(ORDER_STATUS.PLACED);
    expect(approved.totals.discountTotal).toEqual(money(THREE_PACK_DISCOUNT));
    expect(await levelOf(shop, pack.riceItemId)).toEqual({
      onHand: PACKS_ON_SHELF * PACK_GRAMS,
      reserved: 3 * PACK_GRAMS,
    });
  });

  it("keeps the token spendable when the edit it was handed to fails on a stale version", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const approverMemberId = await approverOf(world);
    await setSetting(shop, "sales.discountOwnerWithoutApproval", false);
    const pack = await shelfOf(shop);
    const draft = await drafted(shop, pack, 1);
    const placed = await placeOrder(shop, { orderId: draft.orderId, version: draft.version });
    expect(placed.status).toBe(200);
    const lines = [lineOf(pack, 3, { type: "PERCENT", value: TWENTY_PERCENT_BP })];
    const token = await approvalTokenFor(world.alice, shop.organizationId, {
      approverMemberId,
      subjectKey: orderApprovalSubject(draft.orderId),
      locationId: shop.locationId,
      pin: APPROVAL_PIN,
      amount: money(THREE_PACK_DISCOUNT),
    });

    // The draft's version is stale: place already moved the order to the next one, and the spent
    // token must come back when the edit rolls back (ADR-121).
    const stale = await patchOrder(shop, {
      orderId: draft.orderId,
      body: { version: draft.version, lines, approvalToken: token },
    });
    expect(stale.status).toBe(409);

    const corrected = await editOrder(shop, placed.order, { lines, approvalToken: token });
    expect(corrected.status).toBe(ORDER_STATUS.PLACED);
    expect(corrected.totals.discountTotal).toEqual(money(THREE_PACK_DISCOUNT));
    expect(await levelOf(shop, pack.riceItemId)).toEqual({
      onHand: PACKS_ON_SHELF * PACK_GRAMS,
      reserved: 3 * PACK_GRAMS,
    });
  });

  it("refuses an edit that clears every line once the order has been placed", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const pack = await shelfOf(shop);
    const draft = await drafted(shop, pack, 1);
    const placed = await placeOrder(shop, { orderId: draft.orderId, version: draft.version });
    expect(placed.status).toBe(200);

    const refused = await rawPatch(shop, draft.orderId, {
      version: placed.order.version,
      lines: [],
    });
    expect(refused.status).toBe(422);
    expect(refused.body.error.code).toBe("BUSINESS_RULE");
    expect(refused.body.error.details.ruleKey).toBe(SALES_RULE_KEY.ORDER_NEEDS_LINE);
    expect((await getOrder(shop, draft.orderId)).lines).toHaveLength(1);
    expect(await levelOf(shop, pack.riceItemId)).toEqual({
      onHand: PACKS_ON_SHELF * PACK_GRAMS,
      reserved: PACK_GRAMS,
    });
  });

  it("refuses an edit that drops the contact a pickup order needs", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const pack = await shelfOf(shop);
    const draft = await drafted(shop, pack, 1);
    const placed = await placeOrder(shop, { orderId: draft.orderId, version: draft.version });
    expect(placed.status).toBe(200);

    const refused = await rawPatch(shop, draft.orderId, {
      version: placed.order.version,
      contactId: null,
    });
    expect(refused.status).toBe(422);
    expect(refused.body.error.code).toBe("BUSINESS_RULE");
    expect(refused.body.error.details).toMatchObject({
      ruleKey: SALES_RULE_KEY.CONTACT_PHONE_REQUIRED,
      contactId: "",
    });
    expect((await getOrder(shop, draft.orderId)).contactId).toBe(draft.contactId);
  });
});
