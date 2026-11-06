import { SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { ORDER_STATUS } from "@banijjik/contracts/sales";
import { asId, newId, type OrderId, type OrganizationId, type UserId } from "@banijjik/ids";
import type { Response } from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  startCatalogApi,
  worldFor,
} from "../../../../test-support/catalog-world.js";
import { registerIamApiModels, type IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import { addMemberWithAssignments, findSystemRoleId } from "../../../../test-support/rbac-world.js";
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
  shopOf,
  stockLevelsOf,
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

interface ItemWithStock {
  readonly itemId: string;
  readonly offeringId: string;
  readonly variantId: string;
}

async function itemWithStockOf(
  shop: SalesShop,
  name: string,
  stockQuantity = 10 * PACK_GRAMS,
): Promise<ItemWithStock> {
  const itemId = await addInventoryItem(shop, `${name} raw item`);
  const pack = await publishOffering(shop, {
    kind: "PRODUCT",
    name: `${name} pack`,
    priceAmount: ITEM_PRICE,
    stockComponents: [{ inventoryItemId: itemId, quantity: PACK_GRAMS }],
  });
  await receiveStock(shop, [
    { inventoryItemId: itemId, quantity: stockQuantity, unitCostAmount: 50 },
  ]);
  return { itemId, offeringId: pack.offeringId, variantId: pack.variantId };
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

function shipOrder(
  shop: SalesShop,
  order: OrderRow,
  dispatch: { method: "COURIER" | "OWN_RIDER"; id?: string },
) {
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

function failDeliveryCall(
  shop: SalesShop,
  orderId: string,
  body: object,
  idempotencyKey = newId(),
): Promise<Response> {
  return shop.actor.callWith({
    method: "post",
    path: ordersPath(shop.organizationId, `/${orderId}/delivery-failed`),
    idempotencyKey,
    body,
  });
}

function rtsCall(
  shop: SalesShop,
  orderId: string,
  body: object,
  idempotencyKey = newId(),
): Promise<Response> {
  return shop.actor.callWith({
    method: "post",
    path: ordersPath(shop.organizationId, `/${orderId}/rts`),
    idempotencyKey,
    body,
  });
}

function deliverCall(
  shop: SalesShop,
  orderId: string,
  body: object,
  idempotencyKey = newId(),
): Promise<Response> {
  return shop.actor.callWith({
    method: "post",
    path: ordersPath(shop.organizationId, `/${orderId}/deliver`),
    idempotencyKey,
    body,
  });
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

async function prepareShippedOrder(
  shop: SalesShop,
  item: ItemWithStock,
  quantity = 1,
): Promise<OrderRow> {
  await ensureZone(shop);
  const contactId = await addCustomer(shop, "Customer", CUSTOMER_PHONE);
  const draft = await baseDraftOrder(shop, {
    locationId: shop.locationId,
    contactId,
    fulfillmentMethod: "COURIER",
    deliveryAddress: DHAKA_ADDRESS,
    lines: [{ offeringId: item.offeringId, variantId: item.variantId, quantity }],
  });
  const placed = await placeOrder(shop, { orderId: draft.orderId, version: draft.version });
  const confirmed = await confirmOrder(shop, {
    orderId: draft.orderId,
    version: placed.order.version,
  });
  await shipOrder(shop, confirmed, { method: "COURIER" });
  return getOrder(shop, draft.orderId);
}

describe("4.3 COD S2: Sales RTS and Delivered-return eligibility", () => {
  it("transitions DELIVERY_FAILED order to RETURNED_TO_SENDER and restores stock", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const item = await itemWithStockOf(shop, "RTS Stock Tea", 10 * PACK_GRAMS);
    const shipped = await prepareShippedOrder(shop, item, 2);

    expect(await levelOf(shop, item.itemId)).toMatchObject({
      onHand: 8 * PACK_GRAMS,
      reserved: 0,
    });

    const failed = await failDeliveryCall(shop, shipped.orderId, {
      version: shipped.version,
      reasonKey: "RECIPIENT_UNAVAILABLE",
    });
    expect(failed.status).toBe(200);

    const rts = await rtsCall(shop, shipped.orderId, {
      version: failed.body.data.version,
      reasonKey: "PACKAGE_RETURNED",
      restockDisposition: "RESTOCK",
    });
    expect(rts.status).toBe(200);
    expect(rts.body.data.status).toBe(ORDER_STATUS.RETURNED_TO_SENDER);

    const level = await levelOf(shop, item.itemId);
    expect(level).toMatchObject({
      onHand: 10 * PACK_GRAMS,
      reserved: 0,
    });

    const refreshed = await getOrder(shop, shipped.orderId);
    expect(refreshed.status).toBe(ORDER_STATUS.RETURNED_TO_SENDER);
  });

  it("restores stock with RETURN_DAMAGED disposition on RTS", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const item = await itemWithStockOf(shop, "Damaged RTS Tea", 5 * PACK_GRAMS);
    const shipped = await prepareShippedOrder(shop, item, 1);

    const failed = await failDeliveryCall(shop, shipped.orderId, {
      version: shipped.version,
      reasonKey: "REFUSED",
    });
    expect(failed.status).toBe(200);

    const rts = await rtsCall(shop, shipped.orderId, {
      version: failed.body.data.version,
      reasonKey: "DAMAGED_IN_TRANSIT",
      restockDisposition: "RETURN_DAMAGED",
    });
    expect(rts.status).toBe(200);
    expect(rts.body.data.status).toBe(ORDER_STATUS.RETURNED_TO_SENDER);

    const stockLevels = await stockLevelsOf(shop);
    const level = stockLevels.find((entry) => entry.inventoryItemId === item.itemId);
    expect(level).toMatchObject({
      onHand: 4 * PACK_GRAMS,
      damaged: 1 * PACK_GRAMS,
      reserved: 0,
    });
  });

  it("refuses RTS from non-DELIVERY_FAILED statuses", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const item = await itemWithStockOf(shop, "Invalid RTS Status Tea");
    const shipped = await prepareShippedOrder(shop, item, 1);

    const rtsDirect = await rtsCall(shop, shipped.orderId, {
      version: shipped.version,
    });
    expect(rtsDirect.status).toBe(409);
    expect(rtsDirect.body.error.code).toBe("INVALID_TRANSITION");
  });

  it("marks SHIPPED order as DELIVERED and records deliveredAt", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const item = await itemWithStockOf(shop, "Deliverable Tea");
    const shipped = await prepareShippedOrder(shop, item, 1);

    const delivered = await deliverCall(shop, shipped.orderId, {
      version: shipped.version,
      note: "Handed to customer",
    });
    expect(delivered.status).toBe(200);
    expect(delivered.body.data.status).toBe(ORDER_STATUS.DELIVERED);
    expect(delivered.body.data.delivery.deliveredAt).toBeTruthy();

    const refreshed = await getOrder(shop, shipped.orderId);
    expect(refreshed.status).toBe(ORDER_STATUS.DELIVERED);
    expect(refreshed.delivery?.deliveredAt).toBeTruthy();
  });

  it("refuses deliver from non-SHIPPED statuses", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    await ensureZone(shop);
    const item = await itemWithStockOf(shop, "Refuse Deliver Tea");
    const contactId = await addCustomer(shop, "Customer", CUSTOMER_PHONE);
    const draft = await baseDraftOrder(shop, {
      locationId: shop.locationId,
      contactId,
      fulfillmentMethod: "COURIER",
      deliveryAddress: DHAKA_ADDRESS,
      lines: [{ offeringId: item.offeringId, variantId: item.variantId, quantity: 1 }],
    });

    const deliverDraft = await deliverCall(shop, draft.orderId, { version: draft.version });
    expect(deliverDraft.status).toBe(409);
    expect(deliverDraft.body.error.code).toBe("INVALID_TRANSITION");
  });

  it("allows SalesReturn on a DELIVERED order within the return window", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const item = await itemWithStockOf(shop, "Returnable Delivered Tea");
    const shipped = await prepareShippedOrder(shop, item, 2);

    const delivered = await deliverCall(shop, shipped.orderId, { version: shipped.version });
    expect(delivered.status).toBe(200);

    const firstLine = shipped.lines[0];
    expect(firstLine).toBeDefined();
    if (!firstLine) throw new Error("expected order line");

    const returnPreview = await shop.actor.call(
      "post",
      ordersPath(shop.organizationId, `/${shipped.orderId}/returns/preview`),
      {
        lines: [
          {
            orderLineId: firstLine.orderLineId,
            quantity: 1,
            disposition: "RESTOCK",
          },
        ],
        reasonKey: "DEFECTIVE",
      },
    );
    expect(returnPreview.status).toBe(200);
    expect(returnPreview.body.data.value.amount).toBe(ITEM_PRICE);
  });

  it("enforces location permission and cross-organization isolation for RTS and Deliver", async () => {
    const world = await worldFor(harness, RETAIL);
    const shopA = shopOf(world);
    const item = await itemWithStockOf(shopA, "Isolation Tea");
    const shipped = await prepareShippedOrder(shopA, item, 1);

    const foreignDeliver = await world.bob.call(
      "post",
      ordersPath(world.organizationA, `/${shipped.orderId}/deliver`),
      { version: shipped.version },
    );
    expect(foreignDeliver.status).toBe(404);

    const staffRoleId = await findSystemRoleId(
      harness.connections,
      world.organizationA,
      SYSTEM_ROLE_KEY.STAFF,
    );
    const staffLocation2 = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: world.locationA2, roleId: staffRoleId },
    ]);
    const staffDeliverWrongLocation = await staffLocation2.actor.call(
      "post",
      ordersPath(world.organizationA, `/${shipped.orderId}/deliver`),
      { version: shipped.version },
    );
    expect(staffDeliverWrongLocation.status).toBe(404);
    expect(staffDeliverWrongLocation.body.error.code).toBe("NOT_FOUND");
  });

  it("replays RTS call with identical Idempotency-Key", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const item = await itemWithStockOf(shop, "Idempotent RTS Tea");
    const shipped = await prepareShippedOrder(shop, item, 1);

    const failed = await failDeliveryCall(shop, shipped.orderId, {
      version: shipped.version,
      reasonKey: "RECIPIENT_UNAVAILABLE",
    });
    expect(failed.status).toBe(200);

    const idempotencyKey = newId();
    const first = await rtsCall(
      shop,
      shipped.orderId,
      {
        version: failed.body.data.version,
        reasonKey: "PACKAGE_RETURNED",
      },
      idempotencyKey,
    );
    expect(first.status).toBe(200);

    const replay = await rtsCall(
      shop,
      shipped.orderId,
      {
        version: failed.body.data.version,
        reasonKey: "PACKAGE_RETURNED",
      },
      idempotencyKey,
    );
    expect(replay.status).toBe(200);
    expect(replay.body.data.version).toBe(first.body.data.version);
    expect(replay.body.data.status).toBe(ORDER_STATUS.RETURNED_TO_SENDER);
  });
});
