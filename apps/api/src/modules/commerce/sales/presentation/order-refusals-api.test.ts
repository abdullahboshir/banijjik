import { SALES_RULE_KEY } from "@banijjik/contracts/sales";
import type { Response } from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startCatalogApi, worldFor } from "../../../../test-support/catalog-world.js";
import { registerIamApiModels } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import {
  addCustomer,
  draftOrder,
  listOrders,
  ordersPath,
  placeOrder,
  publishOffering,
  setSetting,
  shopOf,
} from "../../../../test-support/sales-api-world.js";
import type { SalesShop } from "../../../../test-support/sales-api-world.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };
/** Lets the test publish a SERVICE and a PLAN, so the sales guard — not the catalog — answers. */
const GYM = { industryTemplateKey: "GYM" };

const ITEM_PRICE = 5_000;
const SERVICE_MINUTES = 45;
const PLAN_PERIOD = { billingPeriod: { unit: "MONTH", count: 1 } };
const RAHIM_PHONE = "+8801700000001";

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startCatalogApi();
});

afterAll(async () => {
  await harness.dispose();
});

/** An order the test only needs to name in a request: which one, and at which version. */
interface OrderRef {
  readonly orderId: string;
  readonly version: number;
}

interface Offering {
  readonly offeringId: string;
  readonly variantId: string;
}

function linesOf(offering: Offering, quantity = 1) {
  return [{ offeringId: offering.offeringId, variantId: offering.variantId, quantity }];
}

function bodyOf(shop: SalesShop, offering: Offering, extra: object = {}) {
  return { locationId: shop.locationId, lines: linesOf(offering), ...extra };
}

/** A product that draws no stock: these refusals are about status and rules, not inventory. */
async function counterItemOf(shop: SalesShop, name: string): Promise<Offering> {
  return publishOffering(shop, { kind: "PRODUCT", name, priceAmount: ITEM_PRICE });
}

function expectRefused(
  response: Response,
  status: number,
  code: string,
  details: Record<string, unknown>,
): void {
  expect(response.status).toBe(status);
  expect(response.body.error.code).toBe(code);
  expect(response.body.error.details).toMatchObject(details);
}

function callDraft(shop: SalesShop, body: object): Promise<Response> {
  return shop.actor.call("post", ordersPath(shop.organizationId), body);
}

function callInstant(shop: SalesShop, body: object): Promise<Response> {
  return shop.actor.call("post", ordersPath(shop.organizationId, "/instant"), body);
}

function callPlace(shop: SalesShop, order: OrderRef): Promise<Response> {
  return transitionCall(shop, order, "place");
}

function transitionCall(shop: SalesShop, order: OrderRef, action: string): Promise<Response> {
  return shop.actor.call("post", ordersPath(shop.organizationId, `/${order.orderId}/${action}`), {
    version: order.version,
  });
}

function callPatch(shop: SalesShop, order: OrderRef, body: object): Promise<Response> {
  return shop.actor.call("patch", ordersPath(shop.organizationId, `/${order.orderId}`), {
    version: order.version,
    ...body,
  });
}

function callDelete(shop: SalesShop, order: OrderRef): Promise<Response> {
  return shop.actor.call(
    "delete",
    `${ordersPath(shop.organizationId, `/${order.orderId}`)}?version=${order.version}`,
  );
}

/** Runs a step the test expects to succeed and returns the order as the next version sees it. */
async function stepOf(shop: SalesShop, order: OrderRef, action: string): Promise<OrderRef> {
  const response = await transitionCall(shop, order, action);
  expect(response.status).toBe(200);
  return response.body.data as OrderRef;
}

async function draftedItemOrder(
  shop: SalesShop,
  name: string,
): Promise<{ item: Offering; draft: OrderRef }> {
  const item = await counterItemOf(shop, name);
  // A draft hands over by pickup, and a pickup order needs a contact the shop can call.
  const contactId = await addCustomer(shop, `Rahim ${name}`, RAHIM_PHONE);
  return { item, draft: await draftOrder(shop, bodyOf(shop, item, { contactId })) };
}

function callCancel(shop: SalesShop, order: OrderRef, reason: string): Promise<Response> {
  return shop.actor.call("post", ordersPath(shop.organizationId, `/${order.orderId}/cancel`), {
    version: order.version,
    reason,
  });
}

describe("the sales refusals", () => {
  it("declines a SERVICE in a draft and a PLAN in both draft and instant orders", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL, GYM));
    const service = await publishOffering(shop, {
      kind: "SERVICE",
      name: "Personal training",
      priceAmount: ITEM_PRICE,
      kindDetails: { durationMinutes: SERVICE_MINUTES },
    });
    const plan = await publishOffering(shop, {
      kind: "PLAN",
      name: "Monthly membership",
      priceAmount: ITEM_PRICE,
      kindDetails: PLAN_PERIOD,
    });

    const refusedService = await callDraft(shop, bodyOf(shop, service));
    expectRefused(refusedService, 422, "BUSINESS_RULE", {
      ruleKey: SALES_RULE_KEY.KIND_NEEDS_BOOKING,
      offeringId: service.offeringId,
      kind: "SERVICE",
    });
    const refusedPlan = await callDraft(shop, bodyOf(shop, plan));
    expectRefused(refusedPlan, 422, "BUSINESS_RULE", {
      ruleKey: SALES_RULE_KEY.KIND_NEEDS_BOOKING,
      kind: "PLAN",
    });
    expectRefused(await callInstant(shop, bodyOf(shop, plan)), 422, "BUSINESS_RULE", {
      ruleKey: SALES_RULE_KEY.KIND_NEEDS_BOOKING,
      kind: "PLAN",
    });
    expect(await listOrders(shop)).toEqual([]);
  });

  it("declines a fulfillment method the counter does not serve", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const item = await counterItemOf(shop, "Refusal tea");

    for (const method of ["COURIER", "OWN_RIDER"]) {
      const refused = await callDraft(shop, bodyOf(shop, item, { fulfillmentMethod: method }));
      expectRefused(refused, 422, "BUSINESS_RULE", {
        ruleKey: SALES_RULE_KEY.FULFILLMENT_METHOD_UNSUPPORTED,
        method,
      });
    }
    const refusedInstant = await callInstant(
      shop,
      bodyOf(shop, item, { fulfillmentMethod: "COURIER" }),
    );
    expectRefused(refusedInstant, 422, "BUSINESS_RULE", {
      ruleKey: SALES_RULE_KEY.FULFILLMENT_METHOD_UNSUPPORTED,
      method: "COURIER",
    });
    expect(await listOrders(shop)).toEqual([]);
  });

  it("refuses to place a draft that has no lines", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const draft = await draftOrder(shop, { locationId: shop.locationId });
    expect(draft.lines).toEqual([]);

    expectRefused(await callPlace(shop, draft), 422, "BUSINESS_RULE", {
      ruleKey: SALES_RULE_KEY.ORDER_NEEDS_LINE,
    });
  });

  it("refuses a pickup order the shop has no number to call", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const item = await counterItemOf(shop, "Refusal biscuit");

    const withoutContact = await draftOrder(shop, bodyOf(shop, item));
    expectRefused(await callPlace(shop, withoutContact), 422, "BUSINESS_RULE", {
      ruleKey: SALES_RULE_KEY.CONTACT_PHONE_REQUIRED,
      contactId: "",
    });

    const phoneless = await shop.actor.call("post", `/orgs/${shop.organizationId}/contacts`, {
      contactType: "PERSON",
      name: "Karim",
      contactRoles: ["CUSTOMER"],
    });
    expect(phoneless.status).toBe(201);
    const contactId = phoneless.body.data.contactId as string;
    const withContact = await draftOrder(shop, bodyOf(shop, item, { contactId }));
    expectRefused(await callPlace(shop, withContact), 422, "BUSINESS_RULE", {
      ruleKey: SALES_RULE_KEY.CONTACT_PHONE_REQUIRED,
      contactId,
    });
  });

  it("refuses every transition the status table does not allow", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const { draft } = await draftedItemOrder(shop, "Refusal lamp");

    const confirmDraft = await transitionCall(shop, draft, "confirm");
    expectRefused(confirmDraft, 409, "INVALID_TRANSITION", { currentStatus: "DRAFT" });

    const placed = await placeOrder(shop, { orderId: draft.orderId, version: draft.version });
    expect(placed.status).toBe(200);
    const placedRef = placed.order as OrderRef;

    for (const action of ["place", "complete", "pack"]) {
      expectRefused(await transitionCall(shop, placedRef, action), 409, "INVALID_TRANSITION", {
        currentStatus: "PLACED",
      });
    }
    expectRefused(await callDelete(shop, placedRef), 409, "INVALID_TRANSITION", {
      currentStatus: "PLACED",
    });

    const confirmed = await stepOf(shop, placedRef, "confirm");
    const completed = await stepOf(shop, confirmed, "complete");

    expectRefused(await callPatch(shop, completed, { note: "closed" }), 409, "INVALID_TRANSITION", {
      currentStatus: "COMPLETED",
    });
    expectRefused(
      await callCancel(shop, completed, "Customer changed mind"),
      409,
      "INVALID_TRANSITION",
      { currentStatus: "COMPLETED" },
    );
  });

  it("packs only once the organization uses packing", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const { draft } = await draftedItemOrder(shop, "Refusal crate");
    const placed = await placeOrder(shop, { orderId: draft.orderId, version: draft.version });
    const confirmed = await stepOf(shop, placed.order as OrderRef, "confirm");

    expectRefused(await transitionCall(shop, confirmed, "pack"), 422, "BUSINESS_RULE", {
      ruleKey: SALES_RULE_KEY.PACKING_DISABLED,
    });

    await setSetting(shop, "sales.usePacking", true);
    const packed = await transitionCall(shop, confirmed, "pack");
    expect(packed.status).toBe(200);
    expect(packed.body.data.status).toBe("PACKED");
  });

  it("requires an idempotency key for a counter sale", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const item = await counterItemOf(shop, "Refusal key");

    const noKey = await shop.actor.callWith({
      method: "post",
      path: ordersPath(shop.organizationId, "/instant"),
      body: bodyOf(shop, item),
      idempotencyKey: null,
    });
    expect(noKey.status).toBe(400);
    expect(noKey.body.error.details.fields).toEqual([
      { path: "Idempotency-Key", messageKey: "validation.idempotency_key_required" },
    ]);
    expect(await listOrders(shop)).toEqual([]);
  });
});
