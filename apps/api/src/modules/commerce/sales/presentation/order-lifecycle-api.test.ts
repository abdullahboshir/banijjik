import { AUDIT_ACTION } from "@banijjik/contracts";
import { SALES_EVENT_TYPE } from "@banijjik/contracts/sales";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { money, startCatalogApi, worldFor } from "../../../../test-support/catalog-world.js";
import { registerIamApiModels } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import { countAuditRows } from "../../../../test-support/organization-tenant-world.js";
import type { OrderRow } from "../../../../test-support/sales-api-rows.js";
import {
  addCustomer,
  addInventoryItem,
  completeOrder,
  confirmOrder,
  draftOrder,
  instantOrder,
  levelOf,
  orderMovements,
  placeOrder,
  publishOffering,
  quoteOf,
  receiveStock,
  shopOf,
} from "../../../../test-support/sales-api-world.js";
import type { SalesShop } from "../../../../test-support/sales-api-world.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };
/** One sales unit of the pack draws rice and a bag, so one sale writes one SALE movement each. */
const GRAMS_OF_RICE_PER_PACK = 1000;
const BAGS_PER_PACK = 1;
const PACK_PRICE = 12_000;
const RICE_COST_PER_GRAM = 60;
const BAG_COST_PER_UNIT = 200;
const COST_OF_ONE_PACK =
  GRAMS_OF_RICE_PER_PACK * RICE_COST_PER_GRAM + BAGS_PER_PACK * BAG_COST_PER_UNIT;
const PACKS_IN_STOCK = 5;
const PACKS_SOLD = 2;
const GRAMS_SOLD = GRAMS_OF_RICE_PER_PACK * PACKS_SOLD;
const FIRST_NUMBER = "000001";
const SECOND_NUMBER = "000002";
const RAHIM_PHONE = "+8801700000001";

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startCatalogApi();
});

afterAll(async () => {
  await harness.dispose();
});

/** The pack, the two items it draws from, and the customer a pickup order can call back. */
interface Pack {
  readonly riceItemId: string;
  readonly bagItemId: string;
  readonly offeringId: string;
  readonly variantId: string;
  readonly contactId: string;
}

async function packOf(shop: SalesShop, label: string): Promise<Pack> {
  const riceItemId = await addInventoryItem(shop, `Rice ${label}`);
  const bagItemId = await addInventoryItem(shop, `Bag ${label}`);
  const product = await publishOffering(shop, {
    kind: "PRODUCT",
    name: `Rice 1kg pack ${label}`,
    priceAmount: PACK_PRICE,
    stockComponents: [
      { inventoryItemId: riceItemId, quantity: GRAMS_OF_RICE_PER_PACK },
      { inventoryItemId: bagItemId, quantity: BAGS_PER_PACK },
    ],
  });
  await receiveStock(shop, [
    {
      inventoryItemId: riceItemId,
      quantity: GRAMS_OF_RICE_PER_PACK * PACKS_IN_STOCK,
      unitCostAmount: RICE_COST_PER_GRAM,
    },
    { inventoryItemId: bagItemId, quantity: PACKS_IN_STOCK, unitCostAmount: BAG_COST_PER_UNIT },
  ]);
  const contactId = await addCustomer(shop, `Rahim ${label}`, RAHIM_PHONE);
  return { riceItemId, bagItemId, ...product, contactId };
}

function linesOf(pack: Pack, quantity: number) {
  return [{ offeringId: pack.offeringId, variantId: pack.variantId, quantity }];
}

function draftBodyOf(shop: SalesShop, pack: Pack, quantity: number) {
  return {
    locationId: shop.locationId,
    contactId: pack.contactId,
    lines: linesOf(pack, quantity),
  };
}

/** draft → place → confirm → complete, the row of every step in order. */
async function sellThrough(shop: SalesShop, pack: Pack, quantity: number): Promise<OrderRow[]> {
  const draft = await draftOrder(shop, draftBodyOf(shop, pack, quantity));
  const placed = await placeOrder(shop, { orderId: draft.orderId, version: draft.version });
  const confirmed = await confirmOrder(shop, {
    orderId: draft.orderId,
    version: placed.order.version,
  });
  const completed = await completeOrder(shop, {
    orderId: draft.orderId,
    version: confirmed.version,
  });
  return [draft, placed.order, confirmed, completed];
}

/** The outbox rows of one order, oldest first (ADR-115: orderingKey is `order:<orderId>`). */
async function eventsOf(organizationId: string, orderId: string) {
  const rows = await harness.connections.platform
    .collection("outbox_events")
    .find({ organizationId, orderingKey: `order:${orderId}` })
    .sort({ streamSequence: 1 })
    .toArray();
  return rows.map((row) => ({
    type: row["type"] as string,
    payload: row["payload"] as Record<string, unknown>,
    streamSequence: row["streamSequence"] as number,
  }));
}

function orderIdOf(steps: readonly OrderRow[]): string {
  const [draft] = steps;
  if (draft === undefined) throw new Error("expected a drafted order");
  return draft.orderId;
}

describe("the order lifecycle", () => {
  it("reserves at place and writes one SALE movement per pack component at complete", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const pack = await packOf(shop, "lifecycle");

    const draft = await draftOrder(shop, draftBodyOf(shop, pack, PACKS_SOLD));
    expect(draft.status).toBe("DRAFT");
    expect(draft.orderNumber).toBeNull();
    expect(draft.invoiceNumber).toBeNull();
    expect(await levelOf(shop, pack.riceItemId)).toEqual({
      onHand: GRAMS_OF_RICE_PER_PACK * PACKS_IN_STOCK,
      reserved: 0,
    });

    const placed = await placeOrder(shop, { orderId: draft.orderId, version: draft.version });
    expect(placed.status).toBe(200);
    expect(placed.order.status).toBe("PLACED");
    expect(placed.order.orderNumber).toBe(FIRST_NUMBER);
    expect(placed.order.fulfillment.method).toBe("PICKUP");
    expect(await levelOf(shop, pack.riceItemId)).toEqual({
      onHand: GRAMS_OF_RICE_PER_PACK * PACKS_IN_STOCK,
      reserved: GRAMS_SOLD,
    });
    expect(await levelOf(shop, pack.bagItemId)).toEqual({
      onHand: PACKS_IN_STOCK,
      reserved: PACKS_SOLD,
    });
    expect(await orderMovements(shop, draft.orderId)).toEqual([]);

    const confirmed = await confirmOrder(shop, {
      orderId: draft.orderId,
      version: placed.order.version,
    });
    expect(confirmed.status).toBe("CONFIRMED");

    const completed = await completeOrder(shop, {
      orderId: draft.orderId,
      version: confirmed.version,
    });
    expect(completed.status).toBe("COMPLETED");
    expect(completed.invoiceNumber).toBe(FIRST_NUMBER);
    expect(completed.lines[0]?.unitCostSnapshot).toEqual(money(COST_OF_ONE_PACK));
    expect(
      (await orderMovements(shop, draft.orderId))
        .map((row) => `${row.inventoryItemId}|${row.quantityDelta}|${row.reason}`)
        .sort(),
    ).toEqual(
      [`${pack.bagItemId}|${-PACKS_SOLD}|SALE`, `${pack.riceItemId}|${-GRAMS_SOLD}|SALE`].sort(),
    );
    expect(await levelOf(shop, pack.riceItemId)).toEqual({
      onHand: GRAMS_OF_RICE_PER_PACK * (PACKS_IN_STOCK - PACKS_SOLD),
      reserved: 0,
    });
  });

  it("holds exactly the totals the quoter answers for the same lines", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const pack = await packOf(shop, "totals");
    const lines = linesOf(pack, 3);

    const quote = await quoteOf(shop, lines);
    const draft = await draftOrder(shop, draftBodyOf(shop, pack, 3));
    const placed = await placeOrder(shop, { orderId: draft.orderId, version: draft.version });

    expect(draft.totals).toMatchObject(quote.totals);
    expect(placed.order.totals).toEqual(draft.totals);
    expect(placed.order.lines[0]?.lineNetTotal).toEqual(quote.lines[0]?.lineNetTotal);
    expect(placed.order.totals.subtotal).toEqual(money(3 * PACK_PRICE));
  });

  it("takes the order number and the invoice number from their own sequences", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const pack = await packOf(shop, "numbers");

    const first = await sellThrough(shop, pack, PACKS_SOLD);
    const second = await sellThrough(shop, pack, PACKS_SOLD);

    expect(first[1]?.orderNumber).toBe(FIRST_NUMBER);
    expect(first[3]?.invoiceNumber).toBe(FIRST_NUMBER);
    expect(second[1]?.orderNumber).toBe(SECOND_NUMBER);
    expect(second[3]?.invoiceNumber).toBe(SECOND_NUMBER);
    expect(second[0]?.orderNumber).toBeNull();
  });

  it("writes one event per step in the order stream, carrying only the order id", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const pack = await packOf(shop, "events");

    const steps = await sellThrough(shop, pack, 1);
    const orderId = orderIdOf(steps);
    const events = await eventsOf(shop.organizationId, orderId);

    expect(events.map((event) => event.type)).toEqual([
      SALES_EVENT_TYPE.ORDER_DRAFTED,
      SALES_EVENT_TYPE.ORDER_PLACED,
      SALES_EVENT_TYPE.ORDER_CONFIRMED,
      SALES_EVENT_TYPE.ORDER_COMPLETED,
    ]);
    expect(events.map((event) => event.streamSequence)).toEqual([1, 2, 3, 4]);
    for (const event of events) expect(event.payload).toEqual({ orderId });
  });

  it("writes one audit entry for every step", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const pack = await packOf(shop, "audit");

    const steps = await sellThrough(shop, pack, 1);
    const orderId = orderIdOf(steps);

    for (const action of [
      AUDIT_ACTION.ORDER_DRAFTED,
      AUDIT_ACTION.ORDER_PLACED,
      AUDIT_ACTION.ORDER_CONFIRMED,
      AUDIT_ACTION.ORDER_COMPLETED,
    ]) {
      expect(
        await countAuditRows(harness.connections, {
          organizationId: shop.organizationId,
          action,
          entityId: orderId,
        }),
      ).toBe(1);
    }
  });

  it("completes an instant sale in one call with both numbers from their sequences", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const pack = await packOf(shop, "instant");

    const sale = await instantOrder(shop, {
      locationId: shop.locationId,
      lines: linesOf(pack, 1),
    });

    expect(sale.status).toBe(201);
    expect(sale.order.status).toBe("COMPLETED");
    expect(sale.order.orderNumber).toBe(FIRST_NUMBER);
    expect(sale.order.invoiceNumber).toBe(FIRST_NUMBER);
    expect(sale.order.fulfillment.method).toBe("INSTANT");
    expect(sale.order.paymentStatus).toBe("UNPAID");
    expect(sale.order.contactId).toBeNull();
    expect(await levelOf(shop, pack.riceItemId)).toEqual({
      onHand: GRAMS_OF_RICE_PER_PACK * (PACKS_IN_STOCK - 1),
      reserved: 0,
    });
    expect(await orderMovements(shop, sale.order.orderId)).toHaveLength(2);
  });
});
