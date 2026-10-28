import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { worldFor } from "../../../../test-support/catalog-world.js";
import {
  registerIamApiModels,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";
import {
  closeRegister,
  openRegister,
  pairedTill,
  saleCall,
} from "../../../../test-support/pos-api-world.js";
import {
  addInventoryItem,
  instantOrder,
  publishOffering,
  receiveStock,
  shopOf,
  type SalesShop,
} from "../../../../test-support/sales-api-world.js";
import { payOrder, postReturn, returnBody } from "../../../../test-support/sales-return-world.js";
import {
  cashierOf,
  grantCommission,
  replayLeavesOutcomeUnchanged,
  startDayScenarioApi,
  todayInDhaka,
} from "../../../../test-support/day-scenario-world.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };
const PACK_GRAMS = 1_000;
const LOOSE_GRAMS = 500;
const RECEIVE_GRAMS = PACK_GRAMS * 2 + LOOSE_GRAMS;
const POS_PACK_PRICE = 10_000;
const POS_LOOSE_PRICE = 4_000;
const ADMIN_PACK_PRICE = 10_000;
const UNIT_COST = 60;

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startDayScenarioApi();
});
afterAll(async () => {
  await harness.dispose();
});

async function stockedOfferings(shop: SalesShop) {
  const inventoryItemId = await addInventoryItem(shop, "Rice");
  await receiveStock(shop, [
    { inventoryItemId, quantity: RECEIVE_GRAMS, unitCostAmount: UNIT_COST },
  ]);
  const pack = await publishOffering(shop, {
    kind: "PRODUCT",
    name: "Rice 1kg pack",
    priceAmount: POS_PACK_PRICE,
    stockComponents: [{ inventoryItemId, quantity: PACK_GRAMS }],
  });
  const loose = await publishOffering(shop, {
    kind: "PRODUCT",
    name: "Loose rice",
    priceAmount: POS_LOOSE_PRICE,
    unitKey: "GRAM",
    stockComponents: [{ inventoryItemId, quantity: LOOSE_GRAMS }],
  });
  return { pack, loose };
}

describe("retail day scenario", () => {
  it("a retail day of stock in, a loose-and-packed till sale, an admin order, a return and register close then reports, z-report, trial balance and commission match the named amounts, also on replay", async () => {
    const posGrand = POS_PACK_PRICE + POS_LOOSE_PRICE;
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    await grantCommission(shop.organizationId);
    const { pack, loose } = await stockedOfferings(shop);
    const till = await pairedTill(harness.app, {
      manager: world.alice,
      cashier: world.alice,
      organizationId: shop.organizationId,
      locationId: shop.locationId,
    });
    const session = await openRegister(till);
    const sold = await saleCall(till, {
      lines: [
        { offeringId: pack.offeringId, variantId: pack.variantId, quantity: 1 },
        { offeringId: loose.offeringId, variantId: loose.variantId, quantity: 1 },
      ],
      payments: [{ method: "CASH", amount: { amount: posGrand, currency: "BDT" } }],
    });
    expect(sold.status, JSON.stringify(sold.body)).toBe(201);
    const admin = await instantOrder(shop, {
      locationId: shop.locationId,
      lines: [{ offeringId: pack.offeringId, variantId: pack.variantId, quantity: 1 }],
    });
    expect(admin.status).toBe(201);
    expect((await payOrder(shop, admin.order.orderId, { amount: ADMIN_PACK_PRICE })).status).toBe(
      201,
    );
    const line = admin.order.lines[0];
    if (line === undefined) throw new Error("expected an admin line");
    const returned = await postReturn(
      shop.actor,
      { organizationId: shop.organizationId, orderId: admin.order.orderId },
      returnBody([{ orderLineId: line.orderLineId, quantity: 1 }]),
    );
    expect(returned.status, JSON.stringify(returned.body)).toBe(201);
    const closed = await closeRegister(till, { session, countedCash: posGrand });
    expect(closed.status, JSON.stringify(closed.body)).toBe(200);
    const today = todayInDhaka();
    const outcome = await replayLeavesOutcomeUnchanged({
      actor: shop.actor,
      organizationId: shop.organizationId,
      today,
      tillSession: { till, posSessionId: session.posSessionId },
    });
    expect(outcome.trialBalances).toBe(true);
    expect(outcome.homeToday.counters.ordersCompleted).toBe(2);
    expect(outcome.homeToday.counters.netSales).toBe(posGrand + ADMIN_PACK_PRICE);
    expect(outcome.homeToday.counters.returnsCount).toBe(1);
    expect(outcome.homeToday.counters.returnsValue).toBe(ADMIN_PACK_PRICE);
    expect(outcome.homeToday.derived.netSalesAfterReturns).toBe(posGrand);
    expect(outcome.homeToday.paidInByMethod.CASH).toBe(posGrand + ADMIN_PACK_PRICE);
    expect(outcome.homeToday.refundedByMethod.CASH).toBe(ADMIN_PACK_PRICE);
    expect(outcome.dailyTotals.derived.netSalesAfterReturns).toBe(posGrand);
    expect(outcome.commission).toEqual([]);
    expect(outcome.zReport).toMatchObject({
      salesCount: 1,
      grandTotal: { amount: posGrand },
    });
  });

  it("a cashier gets 403 on home", async () => {
    const world = await worldFor(harness, RETAIL);
    const cashier = await cashierOf(harness, world);
    const home = await cashier.actor.call("get", `/orgs/${world.organizationA}/reports/home`);
    expect(home.status).toBe(403);
  });

  it("cross-org home reads are denied and org B does not see org A's net sales", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const product = await publishOffering(shop, {
      kind: "PRODUCT",
      name: "Soap",
      priceAmount: 800,
    });
    await grantCommission(shop.organizationId);
    const sold = await instantOrder(shop, {
      locationId: shop.locationId,
      lines: [{ offeringId: product.offeringId, variantId: product.variantId, quantity: 1 }],
    });
    expect(sold.status).toBe(201);
    expect((await payOrder(shop, sold.order.orderId, { amount: 800 })).status).toBe(201);
    await replayLeavesOutcomeUnchanged({
      actor: shop.actor,
      organizationId: shop.organizationId,
      today: todayInDhaka(),
    });
    const foreign = await world.bob.call("get", `/orgs/${world.organizationA}/reports/home`);
    expect([403, 404]).toContain(foreign.status);
    const bHome = await world.bob.call("get", `/orgs/${world.organizationB}/reports/home`);
    expect(bHome.status).toBe(200);
    expect(bHome.body.data.periods.today.counters.netSales).toBe(0);
  });
});
