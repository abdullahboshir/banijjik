import { newId } from "@banijjik/ids";
import type { Response } from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startCatalogApi, worldFor } from "../../../../test-support/catalog-world.js";
import { registerIamApiModels } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import type { OrderRow } from "../../../../test-support/sales-api-rows.js";
import {
  addCustomer,
  addInventoryItem,
  draftOrder,
  levelOf,
  ordersPath,
  publishOffering,
  receiveStock,
  setSetting,
  shopOf,
} from "../../../../test-support/sales-api-world.js";
import type { SalesShop } from "../../../../test-support/sales-api-world.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };

const GRAMS_OF_RICE = 1_000;
const PACK_PRICE = 12_000;
const RICE_COST_PER_GRAM = 60;
const LOOSE_RICE_GRAMS = 500;
const RAHIM_PHONE = "+8801700000001";

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startCatalogApi();
});

afterAll(async () => {
  await harness.dispose();
});

interface Offering {
  readonly offeringId: string;
  readonly variantId: string;
}

/** One rice item on the shelf, the pack that draws from it, and the pickup contact. */
interface Shelf {
  readonly riceItemId: string;
  readonly pack: Offering;
  readonly contactId: string;
}

function lineOf(offering: Offering, quantity: number) {
  return { offeringId: offering.offeringId, variantId: offering.variantId, quantity };
}

function shelfBody(shelf: Shelf, quantity: number, extra: object = {}) {
  return { lines: [lineOf(shelf.pack, quantity)], ...extra };
}

async function shelfOf(shop: SalesShop, label: string, gramsOnShelf: number): Promise<Shelf> {
  const riceItemId = await addInventoryItem(shop, `Rice ${label}`);
  const pack = await publishOffering(shop, {
    kind: "PRODUCT",
    name: `Rice 1kg pack ${label}`,
    priceAmount: PACK_PRICE,
    stockComponents: [{ inventoryItemId: riceItemId, quantity: GRAMS_OF_RICE }],
  });
  await receiveStock(shop, [
    { inventoryItemId: riceItemId, quantity: gramsOnShelf, unitCostAmount: RICE_COST_PER_GRAM },
  ]);
  const contactId = await addCustomer(shop, `Rahim ${label}`, RAHIM_PHONE);
  return { riceItemId, pack, contactId };
}

/** A product sold loose straight from the same item, so one line needs no packaging. */
async function looseRiceOf(shop: SalesShop, riceItemId: string, label: string): Promise<Offering> {
  return publishOffering(shop, {
    kind: "PRODUCT",
    name: `Loose rice ${label}`,
    priceAmount: 7_000,
    unitKey: "GRAM",
    stockComponents: [{ inventoryItemId: riceItemId, quantity: LOOSE_RICE_GRAMS }],
  });
}

async function draftOf(shop: SalesShop, shelf: Shelf, quantity: number): Promise<OrderRow> {
  return draftOrder(shop, {
    locationId: shop.locationId,
    contactId: shelf.contactId,
    ...shelfBody(shelf, quantity),
  });
}

function placeCall(
  shop: SalesShop,
  order: { orderId: string; version: number },
  idempotencyKey: string,
): Promise<Response> {
  return shop.actor.callWith({
    method: "post",
    path: ordersPath(shop.organizationId, `/${order.orderId}/place`),
    body: { version: order.version },
    idempotencyKey,
  });
}

async function place(
  shop: SalesShop,
  order: { orderId: string; version: number },
): Promise<Response> {
  return placeCall(shop, order, newId());
}

/** A step that must succeed, so the test can read the order and its next version. */
async function step(
  shop: SalesShop,
  order: { orderId: string; version: number },
  action: string,
): Promise<OrderRow> {
  const response = await shop.actor.call(
    "post",
    ordersPath(shop.organizationId, `/${order.orderId}/${action}`),
    { version: order.version },
  );
  expect(response.status).toBe(200);
  return response.body.data as OrderRow;
}

async function edit(
  shop: SalesShop,
  order: { orderId: string; version: number },
  body: object,
): Promise<Response> {
  return shop.actor.call("patch", ordersPath(shop.organizationId, `/${order.orderId}`), {
    version: order.version,
    ...body,
  });
}

async function cancelCall(
  shop: SalesShop,
  order: { orderId: string; version: number },
  reason = "Customer changed mind",
): Promise<Response> {
  return shop.actor.call("post", ordersPath(shop.organizationId, `/${order.orderId}/cancel`), {
    version: order.version,
    reason,
  });
}

describe("the stock an order holds", () => {
  it("refuses a place beyond the shelf, and allows it when negative stock is on", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const shelf = await shelfOf(shop, "short", GRAMS_OF_RICE);
    const draft = await draftOf(shop, shelf, 2);

    const refused = await place(shop, draft);
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe("INSUFFICIENT_STOCK");
    expect(refused.body.error.details).toEqual({
      inventoryItemId: shelf.riceItemId,
      available: GRAMS_OF_RICE,
    });
    expect(await levelOf(shop, shelf.riceItemId)).toEqual({ onHand: GRAMS_OF_RICE, reserved: 0 });

    await setSetting(shop, "inventory.allowNegativeStock", true);
    expect((await place(shop, draft)).status).toBe(200);
    expect(await levelOf(shop, shelf.riceItemId)).toEqual({
      onHand: GRAMS_OF_RICE,
      reserved: 2 * GRAMS_OF_RICE,
    });
  });

  it("lets only one of two parallel places take the last pack", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const shelf = await shelfOf(shop, "last", GRAMS_OF_RICE);
    const drafts = [await draftOf(shop, shelf, 1), await draftOf(shop, shelf, 1)];

    const attempts = await Promise.all(drafts.map((draft) => place(shop, draft)));
    const statuses = attempts.map((response) => response.status).sort();
    expect(statuses).toEqual([200, 409]);
    expect(attempts.find((response) => response.status === 409)?.body.error.code).toBe(
      "INSUFFICIENT_STOCK",
    );
    expect(await levelOf(shop, shelf.riceItemId)).toEqual({
      onHand: GRAMS_OF_RICE,
      reserved: GRAMS_OF_RICE,
    });
  });

  it("re-reserves the difference when a placed or confirmed order is edited", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const shelf = await shelfOf(shop, "edit", 5 * GRAMS_OF_RICE);
    const draft = await draftOf(shop, shelf, 2);
    const placed = await place(shop, draft);
    expect(placed.status).toBe(200);

    const grown = await edit(shop, placed.body.data, {
      lines: [lineOf(shelf.pack, 3)],
    });
    expect(grown.status).toBe(200);
    expect(await levelOf(shop, shelf.riceItemId)).toEqual({
      onHand: 5 * GRAMS_OF_RICE,
      reserved: 3 * GRAMS_OF_RICE,
    });

    const confirmed = await step(shop, grown.body.data, "confirm");
    const shrunk = await edit(shop, confirmed, { lines: [lineOf(shelf.pack, 1)] });
    expect(shrunk.status).toBe(200);
    expect(await levelOf(shop, shelf.riceItemId)).toEqual({
      onHand: 5 * GRAMS_OF_RICE,
      reserved: GRAMS_OF_RICE,
    });
  });

  it("releases the reservation when the order is cancelled", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const shelf = await shelfOf(shop, "cancel", 3 * GRAMS_OF_RICE);
    const draft = await draftOf(shop, shelf, 2);
    const placed = await place(shop, draft);
    expect(placed.status).toBe(200);

    const cancelled = await cancelCall(shop, placed.body.data);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.status).toBe("CANCELLED");
    expect(await levelOf(shop, shelf.riceItemId)).toEqual({
      onHand: 3 * GRAMS_OF_RICE,
      reserved: 0,
    });
  });

  it("never reserves twice when the same place request is retried", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const shelf = await shelfOf(shop, "retry", 3 * GRAMS_OF_RICE);
    const draft = await draftOf(shop, shelf, 1);
    const key = newId();

    const first = await placeCall(shop, draft, key);
    const again = await placeCall(shop, draft, key);
    expect(first.status).toBe(200);
    expect(again.status).toBe(200);
    expect(again.headers["idempotency-replayed"]).toBe("true");
    expect(await levelOf(shop, shelf.riceItemId)).toEqual({
      onHand: 3 * GRAMS_OF_RICE,
      reserved: GRAMS_OF_RICE,
    });
  });

  it("sells loose rice and a packed bag from the one item", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const shelf = await shelfOf(shop, "loose", 3 * GRAMS_OF_RICE);
    const loose = await looseRiceOf(shop, shelf.riceItemId, "loose");

    const draft = await draftOrder(shop, {
      locationId: shop.locationId,
      contactId: shelf.contactId,
      lines: [lineOf(shelf.pack, 1), lineOf(loose, 1)],
    });
    const placed = await place(shop, draft);
    expect(placed.status).toBe(200);
    expect(await levelOf(shop, shelf.riceItemId)).toEqual({
      onHand: 3 * GRAMS_OF_RICE,
      reserved: GRAMS_OF_RICE + LOOSE_RICE_GRAMS,
    });

    const confirmed = await step(shop, placed.body.data, "confirm");
    const completed = await step(shop, confirmed, "complete");
    expect(completed.status).toBe("COMPLETED");
    expect(await levelOf(shop, shelf.riceItemId)).toEqual({
      onHand: 2 * GRAMS_OF_RICE - LOOSE_RICE_GRAMS,
      reserved: 0,
    });
  });
});
