import { ORDER_STATUS } from "@banijjik/contracts/sales";
import { asId, newId, type OrderId, type OrganizationId, type UserId } from "@banijjik/ids";
import type { Response } from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  startCatalogApi,
  worldFor,
} from "../../../../test-support/catalog-world.js";
import { registerIamApiModels, type IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import type { TwoOrganizations } from "../../../../test-support/two-organizations.js";
import type { OrderRow } from "../../../../test-support/sales-api-rows.js";
import {
  addCustomer,
  addInventoryItem,
  confirmOrder,
  draftOrder as baseDraftOrder,
  getOrder,
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
const APPROVAL_PIN = "5678";

const DHAKA_ADDRESS = {
  recipientName: "Rahim Loss",
  phoneE164: "01712345678",
  addressLine: "House 20, Road 5",
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
  const itemId = await addInventoryItem(shop, `${name} item`);
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

function failDeliveryCall(shop: SalesShop, orderId: string, body: object): Promise<Response> {
  return shop.actor.call("post", ordersPath(shop.organizationId, `/${orderId}/delivery-failed`), body);
}

function closeLossCall(
  shop: SalesShop,
  orderId: string,
  body: object,
  idempotencyKey?: string,
): Promise<Response> {
  return shop.actor.callWith({
    method: "post",
    path: ordersPath(shop.organizationId, `/${orderId}/delivery-loss/close`),
    idempotencyKey: idempotencyKey ?? newId(),
    body,
  });
}

function recoverLossCall(
  shop: SalesShop,
  orderId: string,
  body: object,
  idempotencyKey?: string,
): Promise<Response> {
  return shop.actor.callWith({
    method: "post",
    path: ordersPath(shop.organizationId, `/${orderId}/delivery-loss/recover`),
    idempotencyKey: idempotencyKey ?? newId(),
    body,
  });
}

function getLossCall(shop: SalesShop, orderId: string): Promise<Response> {
  return shop.actor.call("get", ordersPath(shop.organizationId, `/${orderId}/delivery-loss`));
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
  quantity = 2,
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

async function approverMember(world: TwoOrganizations, locationId: string): Promise<string> {
  await world.alice.call("put", `/orgs/${world.organizationA}/me/approval-pin`, {
    currentPassword: world.alice.person.password,
    pin: APPROVAL_PIN,
  });
  const approvers = await world.alice.call(
    "get",
    `/orgs/${world.organizationA}/approvers?locationId=${locationId}`,
  );
  expect(approvers.status).toBe(200);
  return approvers.body.data[0].memberId as string;
}

async function lossApprovalToken(
  shop: SalesShop,
  input: {
    readonly action: "DELIVERY_LOSS_CLOSE" | "DELIVERY_LOSS_RECOVER";
    readonly approverMemberId: string;
    readonly subjectKey: string;
    readonly locationId: string;
    readonly amount?: { readonly amount: number; readonly currency: string };
  },
): Promise<string> {
  const response = await shop.actor.call("post", `/orgs/${shop.organizationId}/approvals`, {
    action: input.action,
    subjectKey: input.subjectKey,
    locationId: input.locationId,
    approverMemberId: input.approverMemberId,
    pin: APPROVAL_PIN,
    ...(input.amount === undefined ? {} : { amount: input.amount }),
  });
  expect(response.status).toBe(200);
  return response.body.data.approvalToken as string;
}

describe("4.3 COD S3: Sales Delivery Loss Closure and Physical Recovery", () => {
  it("transitions DELIVERY_FAILED order to DELIVERY_LOSS_CLOSED, restocks received units and leaves lost out", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const item = await itemWithStockOf(shop, "Loss Reconciled Tea", 10 * PACK_GRAMS);
    const shipped = await prepareShippedOrder(shop, item, 3);

    const firstLine = shipped.lines[0];
    expect(firstLine).toBeDefined();
    if (!firstLine) throw new Error("expected order line");

    const failed = await failDeliveryCall(shop, shipped.orderId, {
      version: shipped.version,
      reasonKey: "OTHER",
      note: "Package lost",
    });
    expect(failed.status).toBe(200);

    const approverMemberId = await approverMember(world, shop.locationId);
    const unitCost = firstLine.unitCostSnapshot?.amount ?? 0;
    const lostQuantity = 1;
    const restockQuantity = 1;
    const damagedQuantity = 1;
    const lostCost = unitCost * lostQuantity;

    const approvalToken = await lossApprovalToken(shop, {
      action: "DELIVERY_LOSS_CLOSE",
      approverMemberId,
      subjectKey: shipped.orderId,
      locationId: shop.locationId,
      amount: { amount: lostCost, currency: shipped.totals.grandTotal.currency },
    });

    const closeRes = await closeLossCall(shop, shipped.orderId, {
      expectedVersion: failed.body.data.version,
      reasonKey: "COURIER_REPORTED_LOST",
      approvalToken,
      lines: [
        {
          orderLineId: firstLine.orderLineId,
          restockQuantity,
          damagedQuantity,
          lostQuantity,
        },
      ],
    });
    expect(closeRes.status).toBe(200);
    expect(closeRes.body.data.deliveryLossClosureId).toBeTruthy();
    expect(closeRes.body.data.lines[0].lostQuantity).toBe(1);
    expect(closeRes.body.data.lines[0].recoveredQuantity).toBe(0);

    const refreshedOrder = await getOrder(shop, shipped.orderId);
    expect(refreshedOrder.status).toBe(ORDER_STATUS.DELIVERY_LOSS_CLOSED);

    const stockLevels = await stockLevelsOf(shop);
    const level = stockLevels.find((entry) => entry.inventoryItemId === item.itemId);
    // 10 originally, 3 shipped (7 on hand).
    // Closure: 1 restocked -> 8 on hand, 1 damaged -> 1 damaged. 1 lost stays out.
    expect(level).toMatchObject({
      onHand: 8 * PACK_GRAMS,
      damaged: 1 * PACK_GRAMS,
      reserved: 0,
    });
  });

  it("recovers lost goods partially and updates recovered quantity", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const item = await itemWithStockOf(shop, "Recoverable Tea", 10 * PACK_GRAMS);
    const shipped = await prepareShippedOrder(shop, item, 2);

    const firstLine = shipped.lines[0];
    expect(firstLine).toBeDefined();
    if (!firstLine) throw new Error("expected order line");

    const failed = await failDeliveryCall(shop, shipped.orderId, {
      version: shipped.version,
      reasonKey: "OTHER",
      note: "Package lost",
    });

    const approverMemberId = await approverMember(world, shop.locationId);
    const unitCost = firstLine.unitCostSnapshot?.amount ?? 0;
    const approvalToken = await lossApprovalToken(shop, {
      action: "DELIVERY_LOSS_CLOSE",
      approverMemberId,
      subjectKey: shipped.orderId,
      locationId: shop.locationId,
      amount: { amount: unitCost * 2, currency: shipped.totals.grandTotal.currency },
    });

    const closeRes = await closeLossCall(shop, shipped.orderId, {
      expectedVersion: failed.body.data.version,
      reasonKey: "ALL_LOST",
      approvalToken,
      lines: [
        {
          orderLineId: firstLine.orderLineId,
          restockQuantity: 0,
          damagedQuantity: 0,
          lostQuantity: 2,
        },
      ],
    });
    expect(closeRes.status).toBe(200);

    const recoveryApproval = await lossApprovalToken(shop, {
      action: "DELIVERY_LOSS_RECOVER",
      approverMemberId,
      subjectKey: closeRes.body.data.deliveryLossClosureId,
      locationId: shop.locationId,
      amount: { amount: unitCost * 1, currency: shipped.totals.grandTotal.currency },
    });

    const recoverRes = await recoverLossCall(shop, shipped.orderId, {
      expectedVersion: 1,
      approvalToken: recoveryApproval,
      lines: [
        {
          orderLineId: firstLine.orderLineId,
          restockQuantity: 1,
          damagedQuantity: 0,
        },
      ],
    });
    expect(recoverRes.status).toBe(200);
    expect(recoverRes.body.data.lines[0].restockQuantity).toBe(1);

    const details = await getLossCall(shop, shipped.orderId);
    expect(details.status).toBe(200);
    expect(details.body.data.closure.lines[0].recoveredQuantity).toBe(1);
    expect(details.body.data.recoveries).toHaveLength(1);

    const stockLevels = await stockLevelsOf(shop);
    const level = stockLevels.find((entry) => entry.inventoryItemId === item.itemId);
    // 10 originally, 2 shipped (8 on hand). Closure had 0 restock. Recovery had 1 restock -> 9 on hand.
    expect(level).toMatchObject({
      onHand: 9 * PACK_GRAMS,
      reserved: 0,
    });
  });

  it("refuses reconcile loss when 0 units are lost (directs to RTS)", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const item = await itemWithStockOf(shop, "Zero Loss Tea");
    const shipped = await prepareShippedOrder(shop, item, 1);
    const firstLine = shipped.lines[0];
    if (!firstLine) throw new Error("expected order line");

    const failed = await failDeliveryCall(shop, shipped.orderId, {
      version: shipped.version,
      reasonKey: "RECIPIENT_UNAVAILABLE",
    });

    const res = await closeLossCall(shop, shipped.orderId, {
      expectedVersion: failed.body.data.version,
      reasonKey: "NOT_LOST",
      approvalToken: "dummy",
      lines: [
        {
          orderLineId: firstLine.orderLineId,
          restockQuantity: 1,
          damagedQuantity: 0,
          lostQuantity: 0,
        },
      ],
    });
    expect(res.status).toBe(400);
  });

  it("refuses reconcile loss when line quantities do not match shipped order line", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const item = await itemWithStockOf(shop, "Mismatch Loss Tea");
    const shipped = await prepareShippedOrder(shop, item, 2);
    const firstLine = shipped.lines[0];
    if (!firstLine) throw new Error("expected order line");

    const failed = await failDeliveryCall(shop, shipped.orderId, {
      version: shipped.version,
      reasonKey: "OTHER",
      note: "Package lost",
    });

    const approverMemberId = await approverMember(world, shop.locationId);
    const approvalToken = await lossApprovalToken(shop, {
      action: "DELIVERY_LOSS_CLOSE",
      approverMemberId,
      subjectKey: shipped.orderId,
      locationId: shop.locationId,
    });

    const res = await closeLossCall(shop, shipped.orderId, {
      expectedVersion: failed.body.data.version,
      reasonKey: "MISMATCH",
      approvalToken,
      lines: [
        {
          orderLineId: firstLine.orderLineId,
          restockQuantity: 0,
          damagedQuantity: 0,
          lostQuantity: 1, // shipped was 2!
        },
      ],
    });
    expect(res.status).toBe(422);
  });

  it("refuses reconcile loss outside DELIVERY_FAILED status", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const item = await itemWithStockOf(shop, "Status Loss Tea");
    const shipped = await prepareShippedOrder(shop, item, 1);
    const firstLine = shipped.lines[0];
    if (!firstLine) throw new Error("expected order line");

    const approverMemberId = await approverMember(world, shop.locationId);
    const approvalToken = await lossApprovalToken(shop, {
      action: "DELIVERY_LOSS_CLOSE",
      approverMemberId,
      subjectKey: shipped.orderId,
      locationId: shop.locationId,
    });

    const res = await closeLossCall(shop, shipped.orderId, {
      expectedVersion: shipped.version,
      reasonKey: "DIRECT_LOSS",
      approvalToken,
      lines: [
        {
          orderLineId: firstLine.orderLineId,
          restockQuantity: 0,
          damagedQuantity: 0,
          lostQuantity: 1,
        },
      ],
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INVALID_TRANSITION");
  });

  it("refuses physical recovery exceeding outstanding lost quantity", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const item = await itemWithStockOf(shop, "Excess Recovery Tea");
    const shipped = await prepareShippedOrder(shop, item, 1);
    const firstLine = shipped.lines[0];
    if (!firstLine) throw new Error("expected order line");

    const failed = await failDeliveryCall(shop, shipped.orderId, {
      version: shipped.version,
      reasonKey: "OTHER",
      note: "Package lost",
    });

    const approverMemberId = await approverMember(world, shop.locationId);
    const unitCost = firstLine.unitCostSnapshot?.amount ?? 0;
    const approvalToken = await lossApprovalToken(shop, {
      action: "DELIVERY_LOSS_CLOSE",
      approverMemberId,
      subjectKey: shipped.orderId,
      locationId: shop.locationId,
      amount: { amount: unitCost, currency: shipped.totals.grandTotal.currency },
    });

    const closeRes = await closeLossCall(shop, shipped.orderId, {
      expectedVersion: failed.body.data.version,
      reasonKey: "LOST",
      approvalToken,
      lines: [
        {
          orderLineId: firstLine.orderLineId,
          restockQuantity: 0,
          damagedQuantity: 0,
          lostQuantity: 1,
        },
      ],
    });
    expect(closeRes.status).toBe(200);

    const recoveryApproval = await lossApprovalToken(shop, {
      action: "DELIVERY_LOSS_RECOVER",
      approverMemberId,
      subjectKey: closeRes.body.data.deliveryLossClosureId,
      locationId: shop.locationId,
      amount: { amount: unitCost * 2, currency: shipped.totals.grandTotal.currency },
    });

    const recoverRes = await recoverLossCall(shop, shipped.orderId, {
      expectedVersion: 1,
      approvalToken: recoveryApproval,
      lines: [
        {
          orderLineId: firstLine.orderLineId,
          restockQuantity: 2, // only 1 was lost!
          damagedQuantity: 0,
        },
      ],
    });
    expect(recoverRes.status).toBe(422);
  });

  it("enforces cross-organization isolation and location permissions", async () => {
    const world = await worldFor(harness, RETAIL);
    const shopA = shopOf(world);
    const item = await itemWithStockOf(shopA, "Cross Org Tea");
    const shipped = await prepareShippedOrder(shopA, item, 1);

    const foreign = await world.bob.call(
      "get",
      ordersPath(world.organizationA, `/${shipped.orderId}/delivery-loss`),
    );
    expect(foreign.status).toBe(404);
  });

  it("replays reconcile loss idempotently with identical Idempotency-Key", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const item = await itemWithStockOf(shop, "Idempotent Loss Tea");
    const shipped = await prepareShippedOrder(shop, item, 1);
    const firstLine = shipped.lines[0];
    if (!firstLine) throw new Error("expected order line");

    const failed = await failDeliveryCall(shop, shipped.orderId, {
      version: shipped.version,
      reasonKey: "OTHER",
      note: "Package lost",
    });

    const approverMemberId = await approverMember(world, shop.locationId);
    const unitCost = firstLine.unitCostSnapshot?.amount ?? 0;
    const approvalToken = await lossApprovalToken(shop, {
      action: "DELIVERY_LOSS_CLOSE",
      approverMemberId,
      subjectKey: shipped.orderId,
      locationId: shop.locationId,
      amount: { amount: unitCost, currency: shipped.totals.grandTotal.currency },
    });

    const key = newId();
    const payload = {
      expectedVersion: failed.body.data.version,
      reasonKey: "IDEMPOTENT_LOST",
      approvalToken,
      lines: [
        {
          orderLineId: firstLine.orderLineId,
          restockQuantity: 0,
          damagedQuantity: 0,
          lostQuantity: 1,
        },
      ],
    };

    const first = await closeLossCall(shop, shipped.orderId, payload, key);
    expect(first.status).toBe(200);

    const second = await closeLossCall(shop, shipped.orderId, payload, key);
    expect(second.status).toBe(200);
    expect(second.body.data.deliveryLossClosureId).toBe(first.body.data.deliveryLossClosureId);
  });
});
