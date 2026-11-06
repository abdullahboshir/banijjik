import { ERROR_CODE, SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { ORDER_STATUS } from "@banijjik/contracts/sales";
import {
  SALES_DELIVERY_FAIL_REASON,
  SALES_DELIVERY_RULE_KEY,
} from "@banijjik/contracts/sales/delivery";
import { asId, newId, type OrderId, type OrganizationId, type UserId } from "@banijjik/ids";
import type { Response } from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  memberWithRole,
  startCatalogApi,
  worldFor,
} from "../../../../test-support/catalog-world.js";
import { registerIamApiModels, type IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import type { OrderRow } from "../../../../test-support/sales-api-rows.js";
import {
  addCustomer,
  addInventoryItem,
  confirmOrder,
  draftOrder as baseDraftOrder,
  getOrder,
  levelOf,
  ordersPath,
  placeOrder,
  publishOffering,
  receiveStock,
  setSetting,
  shopOf,
  transitionOrder,
  type SalesShop,
} from "../../../../test-support/sales-api-world.js";
import { runInOrganizationContext } from "../../../../kernel/tenancy/index.js";
import { buildAuditRecorder } from "../../../core/audit/index.js";
import { buildIndustryTemplateReader } from "../../../platform/industry/index.js";
import { buildModuleRegistry } from "../../../../routes/module-registry.js";
import {
  buildOrganizationConfigPorts,
  buildResolvedConfigSources,
} from "../../../../routes/organization-config-ports.js";
import { buildOrgConfigService } from "../../../platform/entitlement/index.js";
import { buildSalesTenantPorts } from "../../../../routes/sales-tenant-router.js";
import { buildSalesDependencies } from "../sales-wiring.js";
import { ShipOrderUseCase } from "../application/use-cases/ship-order.use-cases.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };
const ITEM_PRICE = 5_000;
const PACK_GRAMS = 1_000;
const CUSTOMER_PHONE = "+8801700000001";

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
  harness = await startCatalogApi();
});

afterAll(async () => {
  await harness.dispose();
});

interface Offering {
  readonly offeringId: string;
  readonly variantId: string;
  readonly inventoryItemId?: string;
}

async function productOf(shop: SalesShop, name: string): Promise<Offering> {
  const itemId = await addInventoryItem(shop, `${name} item`);
  await receiveStock(shop, [{ inventoryItemId: itemId, quantity: 10 * PACK_GRAMS, unitCostAmount: 2_000 }]);
  const off = await publishOffering(shop, {
    kind: "PRODUCT",
    name,
    priceAmount: ITEM_PRICE,
    stockComponents: [{ inventoryItemId: itemId, quantity: PACK_GRAMS }],
  });
  return { ...off, inventoryItemId: itemId };
}

async function untrackedProductOf(shop: SalesShop, name: string): Promise<Offering> {
  return publishOffering(shop, { kind: "PRODUCT", name, priceAmount: ITEM_PRICE });
}

function linesOf(item: Offering) {
  return [{ offeringId: item.offeringId, variantId: item.variantId, quantity: 1 }];
}

function requireItemId(item: Offering): string {
  if (item.inventoryItemId === undefined) throw new Error("inventoryItemId missing");
  return item.inventoryItemId;
}

async function ensureZone(shop: SalesShop): Promise<void> {
  await shop.actor.callWith({
    method: "post",
    path: `/orgs/${shop.organizationId}/sales/delivery-zones`,
    idempotencyKey: newId(),
    body: {
      zoneKey: `zone-${newId().slice(-8)}`,
      name: { bn: "ঢাকা", en: "Dhaka" },
      areaCodes: [DHAKA_ADDRESS.areaCode],
      feeMinor: 60,
      status: "ACTIVE",
    },
  });
}

async function draftDeliveryOrder(
  shop: SalesShop,
  item: Offering,
  method: "COURIER" | "OWN_RIDER" = "COURIER",
): Promise<OrderRow> {
  await ensureZone(shop);
  const contactId = await addCustomer(shop, "Rahim", CUSTOMER_PHONE);
  return baseDraftOrder(shop, {
    locationId: shop.locationId,
    contactId,
    fulfillmentMethod: method,
    deliveryAddress: DHAKA_ADDRESS,
    lines: linesOf(item),
  });
}

function testSales(h: IamApiHarness) {
  const registry = buildModuleRegistry();
  const orgConfig = buildOrgConfigService({
    registry,
    clock: h.clock,
    ...buildResolvedConfigSources(registry),
    ...buildOrganizationConfigPorts(),
    templates: buildIndustryTemplateReader(h.clock),
  });
  const ports = buildSalesTenantPorts({
    clock: h.clock,
    audit: buildAuditRecorder(h.clock),
    permission: () => (_req, _res, next) => next(),
    permissions: { locationsWith: async () => "ALL" },
    idempotency: (_req, _res, next) => next(),
    orgConfig,
    manifests: registry.all(),
  });
  return buildSalesDependencies(ports);
}

function shipOrder(shop: SalesShop, order: OrderRow, dispatch: { method: "COURIER" | "OWN_RIDER"; id?: string }) {
  return runInOrganizationContext(shop.organizationId, () => {
    const useCase = new ShipOrderUseCase(testSales(harness));
    const dispatchPayload =
      dispatch.method === "COURIER"
        ? { method: "COURIER" as const, consignmentId: dispatch.id ?? newId() }
        : { method: "OWN_RIDER" as const, deliveryAssignmentId: dispatch.id ?? newId() };

    return useCase.execute({
      organizationId: asId<OrganizationId>(shop.organizationId),
      allowedLocationIds: "ALL",
      actorUserId: asId<UserId>(shop.actor.person.me.userId),
      orderId: asId<OrderId>(order.orderId),
      body: {
        version: order.version,
        dispatch: dispatchPayload,
      },
    });
  });
}

function failDeliveryCall(shop: SalesShop, orderId: string, body: object, idempotencyKey = newId()): Promise<Response> {
  return shop.actor.callWith({
    method: "post",
    path: ordersPath(shop.organizationId, `/${orderId}/delivery-failed`),
    idempotencyKey,
    body,
  });
}

function reshipCall(shop: SalesShop, orderId: string, body: object, idempotencyKey = newId()): Promise<Response> {
  return shop.actor.callWith({
    method: "post",
    path: ordersPath(shop.organizationId, `/${orderId}/reship`),
    idempotencyKey,
    body,
  });
}

function attemptsCall(shop: SalesShop, orderId: string, query = ""): Promise<Response> {
  return shop.actor.call("get", ordersPath(shop.organizationId, `/${orderId}/delivery-attempts${query}`));
}

describe("4.3 COD S1f: Ship, Fail, Reship state machine transitions", () => {
  it("ships a CONFIRMED order: commits stock, records attempt 1, freezes firstShipment facts", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const item = await productOf(shop, "Ship product");
    const draft = await draftDeliveryOrder(shop, item, "COURIER");
    const placed = await placeOrder(shop, { orderId: draft.orderId, version: draft.version });
    const confirmed = await confirmOrder(shop, { orderId: draft.orderId, version: placed.order.version });

    const beforeStock = await levelOf(shop, requireItemId(item));
    expect(beforeStock.reserved).toBe(PACK_GRAMS);

    const shipped = await shipOrder(shop, confirmed, { method: "COURIER" });
    expect(shipped.status).toBe(ORDER_STATUS.SHIPPED);
    expect(shipped.delivery?.currentDeliveryAttemptId).toBeDefined();
    expect(shipped.delivery?.deliveryAttemptCount).toBe(1);
    expect(shipped.delivery?.shippedAt).toBeDefined();

    const facts = shipped.delivery?.firstShipment;
    expect(facts).not.toBeNull();
    expect(facts?.shipmentEventId).toBeDefined();
    expect(facts?.deliveryAttemptId).toBe(shipped.delivery?.currentDeliveryAttemptId);
    expect(facts?.netRevenue.amount).toBe(ITEM_PRICE);
    expect(facts?.deliveryIncome.amount).toBe(60);

    const afterStock = await levelOf(shop, requireItemId(item));
    expect(afterStock.reserved).toBe(0);
    expect(afterStock.onHand).toBe(9 * PACK_GRAMS);
  });

  it("ships a PACKED order with OWN_RIDER dispatch", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    await setSetting(shop, "sales.usePacking", true);
    const item = await productOf(shop, "Rider pack");
    const draft = await draftDeliveryOrder(shop, item, "OWN_RIDER");
    const placed = await placeOrder(shop, { orderId: draft.orderId, version: draft.version });
    const confirmed = await confirmOrder(shop, { orderId: draft.orderId, version: placed.order.version });
    const packed = await transitionOrder(shop, {
      orderId: draft.orderId,
      action: "pack",
      version: confirmed.version,
    });

    const shipped = await shipOrder(shop, packed.order, { method: "OWN_RIDER" });
    expect(shipped.status).toBe(ORDER_STATUS.SHIPPED);
    expect(shipped.delivery?.deliveryAttemptCount).toBe(1);
  });

  it("refuses ship on DRAFT, PLACED or already SHIPPED orders", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const item = await productOf(shop, "Invalid ship order");
    const draft = await draftDeliveryOrder(shop, item);

    await expect(shipOrder(shop, draft, { method: "COURIER" })).rejects.toThrow();

    const placed = await placeOrder(shop, { orderId: draft.orderId, version: draft.version });
    await expect(shipOrder(shop, placed.order, { method: "COURIER" })).rejects.toThrow();

    const confirmed = await confirmOrder(shop, { orderId: draft.orderId, version: placed.order.version });
    await shipOrder(shop, confirmed, { method: "COURIER" });
    const shippedOrder = await getOrder(shop, draft.orderId);

    await expect(shipOrder(shop, shippedOrder, { method: "COURIER" })).rejects.toThrow();
  });

  it("refuses ship when dispatch method mismatches order fulfillment method", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const item = await productOf(shop, "Mismatch item");
    const draft = await draftDeliveryOrder(shop, item, "COURIER");
    const placed = await placeOrder(shop, { orderId: draft.orderId, version: draft.version });
    const confirmed = await confirmOrder(shop, { orderId: draft.orderId, version: placed.order.version });

    await expect(shipOrder(shop, confirmed, { method: "OWN_RIDER" })).rejects.toMatchObject({
      code: ERROR_CODE.BUSINESS_RULE,
      details: { ruleKey: SALES_DELIVERY_RULE_KEY.DISPATCH_METHOD_MISMATCH },
    });
  });

  it("refuses ship on PICKUP orders", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const item = await productOf(shop, "Pickup item");
    const contactId = await addCustomer(shop, "Rahim", CUSTOMER_PHONE);
    const draft = await baseDraftOrder(shop, {
      locationId: shop.locationId,
      contactId,
      fulfillmentMethod: "PICKUP",
      lines: linesOf(item),
    });
    const placed = await placeOrder(shop, { orderId: draft.orderId, version: draft.version });
    const confirmed = await confirmOrder(shop, { orderId: draft.orderId, version: placed.order.version });

    await expect(shipOrder(shop, confirmed, { method: "COURIER" })).rejects.toMatchObject({
      code: ERROR_CODE.BUSINESS_RULE,
      details: { ruleKey: SALES_DELIVERY_RULE_KEY.DELIVERY_METHOD_NOT_COMPLETABLE },
    });
  });

  it("skips stock ledger commit when order has no stock lines", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const item = await untrackedProductOf(shop, "Untracked delivery");
    const draft = await draftDeliveryOrder(shop, item, "COURIER");
    const placed = await placeOrder(shop, { orderId: draft.orderId, version: draft.version });
    const confirmed = await confirmOrder(shop, { orderId: draft.orderId, version: placed.order.version });

    const shipped = await shipOrder(shop, confirmed, { method: "COURIER" });
    expect(shipped.status).toBe(ORDER_STATUS.SHIPPED);
    expect(shipped.delivery?.deliveryAttemptCount).toBe(1);
    expect(shipped.delivery?.firstShipment?.netRevenue.amount).toBe(ITEM_PRICE);
  });

  it("marks delivery failed: keeps stock/totals, updates attempt, emits event", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const item = await productOf(shop, "Fail product");
    const draft = await draftDeliveryOrder(shop, item);
    const placed = await placeOrder(shop, { orderId: draft.orderId, version: draft.version });
    const confirmed = await confirmOrder(shop, { orderId: draft.orderId, version: placed.order.version });
    await shipOrder(shop, confirmed, { method: "COURIER" });
    const orderBefore = await getOrder(shop, draft.orderId);

    const failRes = await failDeliveryCall(shop, draft.orderId, {
      version: orderBefore.version,
      reasonKey: SALES_DELIVERY_FAIL_REASON.RECIPIENT_UNAVAILABLE,
    });
    expect(failRes.status).toBe(200);
    expect(failRes.body.data.status).toBe(ORDER_STATUS.DELIVERY_FAILED);
    expect(failRes.body.data.totals.grandTotal.amount).toBe(orderBefore.totals.grandTotal.amount);

    const stock = await levelOf(shop, requireItemId(item));
    expect(stock.onHand).toBe(9 * PACK_GRAMS);

    const attemptsRes = await attemptsCall(shop, draft.orderId);
    expect(attemptsRes.status).toBe(200);
    expect(attemptsRes.body.data).toHaveLength(1);
    expect(attemptsRes.body.data[0].ordinal).toBe(1);
    expect(attemptsRes.body.data[0].failedAt).toBeDefined();
    expect(attemptsRes.body.data[0].reasonKey).toBe(SALES_DELIVERY_FAIL_REASON.RECIPIENT_UNAVAILABLE);
  });

  it("reships a DELIVERY_FAILED order: creates attempt 2, reuses firstShipment facts, does not re-commit stock", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const item = await productOf(shop, "Reship product");
    const draft = await draftDeliveryOrder(shop, item);
    const placed = await placeOrder(shop, { orderId: draft.orderId, version: draft.version });
    const confirmed = await confirmOrder(shop, { orderId: draft.orderId, version: placed.order.version });
    await shipOrder(shop, confirmed, { method: "COURIER" });
    const shipped = await getOrder(shop, draft.orderId);

    const failedRes = await failDeliveryCall(shop, draft.orderId, {
      version: shipped.version,
      reasonKey: SALES_DELIVERY_FAIL_REASON.REFUSED,
    });
    expect(failedRes.status).toBe(200);

    const failedOrder = failedRes.body.data;
    const reshipRes = await reshipCall(shop, draft.orderId, {
      version: failedOrder.version,
      dispatch: { method: "COURIER", consignmentId: newId() },
    });
    expect(reshipRes.status).toBe(200);
    expect(reshipRes.body.data.status).toBe(ORDER_STATUS.SHIPPED);
    expect(reshipRes.body.data.delivery.deliveryAttemptCount).toBe(2);
    expect(reshipRes.body.data.delivery.firstShipment.shipmentEventId).toBe(
      shipped.delivery?.firstShipment?.shipmentEventId,
    );

    const stock = await levelOf(shop, requireItemId(item));
    expect(stock.onHand).toBe(9 * PACK_GRAMS);

    const attemptsPage = await attemptsCall(shop, draft.orderId, "?page=1&limit=1");
    expect(attemptsPage.status).toBe(200);
    expect(attemptsPage.body.data).toHaveLength(1);
    expect(attemptsPage.body.data[0].ordinal).toBe(1);
    expect(attemptsPage.body.meta.hasNext).toBe(true);

    const attemptsPage2 = await attemptsCall(shop, draft.orderId, "?page=2&limit=1");
    expect(attemptsPage2.status).toBe(200);
    expect(attemptsPage2.body.data).toHaveLength(1);
    expect(attemptsPage2.body.data[0].ordinal).toBe(2);
    expect(attemptsPage2.body.meta.hasNext).toBe(false);
  });

  it("refuses reship outside DELIVERY_FAILED status", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const item = await productOf(shop, "Reship invalid status");
    const draft = await draftDeliveryOrder(shop, item);
    const placed = await placeOrder(shop, { orderId: draft.orderId, version: draft.version });
    const confirmed = await confirmOrder(shop, { orderId: draft.orderId, version: placed.order.version });

    const reshipPlaced = await reshipCall(shop, draft.orderId, {
      version: placed.order.version,
      dispatch: { method: "COURIER", consignmentId: newId() },
    });
    expect(reshipPlaced.status).toBe(409);

    await shipOrder(shop, confirmed, { method: "COURIER" });
    const shipped = await getOrder(shop, draft.orderId);

    const reshipShipped = await reshipCall(shop, draft.orderId, {
      version: shipped.version,
      dispatch: { method: "COURIER", consignmentId: newId() },
    });
    expect(reshipShipped.status).toBe(409);
  });

  it("complete still refuses after failed and reshipped delivery", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const item = await productOf(shop, "No complete for delivery");
    const draft = await draftDeliveryOrder(shop, item);
    const placed = await placeOrder(shop, { orderId: draft.orderId, version: draft.version });
    const confirmed = await confirmOrder(shop, { orderId: draft.orderId, version: placed.order.version });
    await shipOrder(shop, confirmed, { method: "COURIER" });
    const shipped = await getOrder(shop, draft.orderId);

    const failed = await failDeliveryCall(shop, draft.orderId, {
      version: shipped.version,
      reasonKey: SALES_DELIVERY_FAIL_REASON.ADDRESS_INVALID,
    });
    const completeFailed = await shop.actor.call("post", ordersPath(shop.organizationId, `/${draft.orderId}/complete`), {
      version: failed.body.data.version,
    });
    expect(completeFailed.status).toBe(409);

    const reshipped = await reshipCall(shop, draft.orderId, {
      version: failed.body.data.version,
      dispatch: { method: "COURIER", consignmentId: newId() },
    });
    const completeReshipped = await shop.actor.call("post", ordersPath(shop.organizationId, `/${draft.orderId}/complete`), {
      version: reshipped.body.data.version,
    });
    expect(completeReshipped.status).toBe(409);
  });

  it("handles concurrent fail and reship with 409 stale version", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const item = await productOf(shop, "Concurrent order");
    const draft = await draftDeliveryOrder(shop, item);
    const placed = await placeOrder(shop, { orderId: draft.orderId, version: draft.version });
    const confirmed = await confirmOrder(shop, { orderId: draft.orderId, version: placed.order.version });
    await shipOrder(shop, confirmed, { method: "COURIER" });
    const shipped = await getOrder(shop, draft.orderId);

    const [firstFail, secondFail] = await Promise.all([
      failDeliveryCall(shop, draft.orderId, {
        version: shipped.version,
        reasonKey: SALES_DELIVERY_FAIL_REASON.RECIPIENT_UNAVAILABLE,
      }),
      failDeliveryCall(shop, draft.orderId, {
        version: shipped.version,
        reasonKey: SALES_DELIVERY_FAIL_REASON.REFUSED,
      }),
    ]);
    const statuses = [firstFail.status, secondFail.status].sort();
    expect(statuses).toEqual([200, 409]);
  });

  it("replays idempotently on fail and reship; refuses altered payload with conflict", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const item = await productOf(shop, "Idempotent delivery");
    const draft = await draftDeliveryOrder(shop, item);
    const placed = await placeOrder(shop, { orderId: draft.orderId, version: draft.version });
    const confirmed = await confirmOrder(shop, { orderId: draft.orderId, version: placed.order.version });
    await shipOrder(shop, confirmed, { method: "COURIER" });
    const shipped = await getOrder(shop, draft.orderId);

    const failKey = newId();
    const failBody = {
      version: shipped.version,
      reasonKey: SALES_DELIVERY_FAIL_REASON.RECIPIENT_UNAVAILABLE,
    };
    const firstFail = await failDeliveryCall(shop, draft.orderId, failBody, failKey);
    expect(firstFail.status).toBe(200);

    const replayFail = await failDeliveryCall(shop, draft.orderId, failBody, failKey);
    expect(replayFail.status).toBe(200);
    expect(replayFail.headers["idempotency-replayed"]).toBe("true");

    const conflictingFail = await failDeliveryCall(
      shop,
      draft.orderId,
      { ...failBody, reasonKey: SALES_DELIVERY_FAIL_REASON.REFUSED },
      failKey,
    );
    expect(conflictingFail.status).toBe(422);
    expect(conflictingFail.body.error.code).toBe(ERROR_CODE.IDEMPOTENCY_MISMATCH);
  });

  it("validates fail, reship and list requests strictly", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const item = await productOf(shop, "Validation check");
    const draft = await draftDeliveryOrder(shop, item);
    const placed = await placeOrder(shop, { orderId: draft.orderId, version: draft.version });
    const confirmed = await confirmOrder(shop, { orderId: draft.orderId, version: placed.order.version });
    await shipOrder(shop, confirmed, { method: "COURIER" });
    const shipped = await getOrder(shop, draft.orderId);

    const missingKey = await shop.actor.callWith({
      method: "post",
      path: ordersPath(shop.organizationId, `/${draft.orderId}/delivery-failed`),
      idempotencyKey: null,
      body: { version: shipped.version, reasonKey: SALES_DELIVERY_FAIL_REASON.REFUSED },
    });
    expect(missingKey.status).toBe(400);
    expect(missingKey.body.error.code).toBe(ERROR_CODE.VALIDATION_ERROR);
    expect(missingKey.body.error.details.fields[0].path).toBe("Idempotency-Key");

    const missingVersion = await failDeliveryCall(shop, draft.orderId, {
      reasonKey: SALES_DELIVERY_FAIL_REASON.REFUSED,
    });
    expect(missingVersion.status).toBe(400);

    const emptyOtherNote = await failDeliveryCall(shop, draft.orderId, {
      version: shipped.version,
      reasonKey: SALES_DELIVERY_FAIL_REASON.OTHER,
      note: "   ",
    });
    expect(emptyOtherNote.status).toBe(400);

    const longNote = await failDeliveryCall(shop, draft.orderId, {
      version: shipped.version,
      reasonKey: SALES_DELIVERY_FAIL_REASON.OTHER,
      note: "x".repeat(201),
    });
    expect(longNote.status).toBe(400);

    const invalidReason = await failDeliveryCall(shop, draft.orderId, {
      version: shipped.version,
      reasonKey: "INVALID_REASON",
    });
    expect(invalidReason.status).toBe(400);

    const excessiveLimit = await attemptsCall(shop, draft.orderId, "?limit=101");
    expect(excessiveLimit.status).toBe(400);
  });

  it("enforces cross-organization isolation and permissions", async () => {
    const world = await worldFor(harness, RETAIL);
    const shopA = shopOf(world);
    const shopB: SalesShop = {
      actor: world.bob,
      organizationId: world.organizationB,
      locationId: world.locationB1,
    };
    const item = await productOf(shopA, "Cross-org item");
    const draft = await draftDeliveryOrder(shopA, item);
    const placed = await placeOrder(shopA, { orderId: draft.orderId, version: draft.version });
    const confirmed = await confirmOrder(shopA, { orderId: draft.orderId, version: placed.order.version });
    await shipOrder(shopA, confirmed, { method: "COURIER" });
    const shipped = await getOrder(shopA, draft.orderId);

    const crossFail = await failDeliveryCall(shopB, draft.orderId, {
      version: shipped.version,
      reasonKey: SALES_DELIVERY_FAIL_REASON.RECIPIENT_UNAVAILABLE,
    });
    expect(crossFail.status).toBe(404);

    const crossAttempts = await attemptsCall(shopB, draft.orderId);
    expect(crossAttempts.status).toBe(404);

    const readonlyMember = await memberWithRole(harness, world, SYSTEM_ROLE_KEY.VIEWER);
    const unauthorizedFail = await readonlyMember.callWith({
      method: "post",
      path: ordersPath(shopA.organizationId, `/${draft.orderId}/delivery-failed`),
      idempotencyKey: newId(),
      body: {
        version: shipped.version,
        reasonKey: SALES_DELIVERY_FAIL_REASON.RECIPIENT_UNAVAILABLE,
      },
    });
    expect(unauthorizedFail.status).toBe(403);
  });
});
