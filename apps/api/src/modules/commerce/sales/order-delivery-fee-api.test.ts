import { ALL_LOCATIONS, CURRENCY_CODE, SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { PAYMENT_REQUEST_TYPE } from "@banijjik/contracts/payment";
import {
  RETURN_DISPOSITION,
  SALES_RETURN_REASON,
  orderApprovalSubject,
} from "@banijjik/contracts/sales";
import { DELIVERY_ZONE_STATUS, SALES_DELIVERY_RULE_KEY } from "@banijjik/contracts/sales/delivery";
import { asId, newId, type OrganizationId, type UserId } from "@banijjik/ids";
import type { Response } from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { API_PASSWORD } from "../../../test-support/auth-api-scenarios.js";
import { money, startCatalogApi, worldFor } from "../../../test-support/catalog-world.js";
import { registerIamApiModels } from "../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../test-support/iam-api-harness.js";
import { models } from "../../../kernel/db/index.js";
import { runInOrganizationContext } from "../../../kernel/tenancy/index.js";
import { MongoPaymentSummaryRepository } from "../payment/index.js";
import { addMemberWithAssignments, findSystemRoleId } from "../../../test-support/rbac-world.js";
import type { OrderRow } from "../../../test-support/sales-api-rows.js";
import {
  addCustomer,
  addInventoryItem,
  approvalTokenFor,
  draftOrder,
  levelOf,
  movementsOf,
  ordersPath,
  placeOrder,
  publishOffering,
  receiveStock,
  setSetting,
  shopOf,
  type SalesShop,
} from "../../../test-support/sales-api-world.js";
import type { TwoOrganizations } from "../../../test-support/two-organizations.js";
import { DeliveryZone } from "./domain/delivery-zone.entity.js";
import { planSalesReturn } from "./domain/sales-return-plan.js";
import { DELIVERY_ZONE_MODEL_NAME } from "./infrastructure/delivery-zone.schema.js";
import { MongoDeliveryZoneRepository } from "./infrastructure/mongo-delivery-zone.repository.js";
import { MongoOrderRepository } from "./infrastructure/mongo-order.repositories.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };
const ITEM_PRICE = 10_000;
const PACK_GRAMS = 1_000;
const ZONE_FEE = 800;
const OTHER_FEE = 1_200;
const RAHIM_PHONE = "+8801700000001";
const LOCAL_PHONE = "01712345678";
const STORED_PHONE = "+8801712345678";
const APPROVAL_PIN = "4321";
const TWENTY_PERCENT_BP = 2_000;
const DISCOUNT_MINOR = 2_000;

const DHAKA_ADDRESS = {
  recipientName: "Rahim Uddin",
  phoneE164: LOCAL_PHONE,
  addressLine: "House 12, Road 4",
  districtCode: "dhaka",
  areaCode: "dhanmondi",
  postalCode: "1209",
} as const;

const GULSHAN_ADDRESS = {
  ...DHAKA_ADDRESS,
  addressLine: "House 99",
  areaCode: "gulshan",
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
}

interface DeliveryView {
  readonly address: { readonly phoneE164: string; readonly areaCode: string } | null;
  readonly deliveryZoneId: string | null;
}

function deliveryOf(order: OrderRow): DeliveryView | null {
  return (order as OrderRow & { delivery: DeliveryView | null }).delivery;
}

function linesOf(item: Offering) {
  return [{ offeringId: item.offeringId, variantId: item.variantId, quantity: 1 }];
}

function expectRule(response: Response, ruleKey: string): void {
  expect(response.status).toBe(422);
  expect(response.body.error.code).toBe("BUSINESS_RULE");
  expect(response.body.error.details.ruleKey).toBe(ruleKey);
}

async function counterItemOf(shop: SalesShop, name: string): Promise<Offering> {
  return publishOffering(shop, { kind: "PRODUCT", name, priceAmount: ITEM_PRICE });
}

async function createZone(
  shop: SalesShop,
  areaCodes: readonly string[],
  feeMinor: number,
): Promise<{ readonly deliveryZoneId: string; readonly feeMinor: number }> {
  const created = await shop.actor.callWith({
    method: "post",
    path: `/orgs/${shop.organizationId}/sales/delivery-zones`,
    idempotencyKey: newId(),
    body: {
      zoneKey: `zone-${newId().slice(-12)}`,
      name: { bn: "ঢাকা", en: "Dhaka" },
      areaCodes,
      feeMinor,
      status: DELIVERY_ZONE_STATUS.ACTIVE,
    },
  });
  expect(created.status).toBe(201);
  return { deliveryZoneId: created.body.data.deliveryZoneId as string, feeMinor };
}

async function paymentOf(shop: SalesShop, orderId: string) {
  return runInOrganizationContext(shop.organizationId, () =>
    new MongoPaymentSummaryRepository().findByRequest(
      asId<OrganizationId>(shop.organizationId),
      PAYMENT_REQUEST_TYPE.ORDER,
      orderId,
    ),
  );
}

async function storedOrder(shop: SalesShop, orderId: string) {
  return runInOrganizationContext(shop.organizationId, () =>
    new MongoOrderRepository().findById(asId(orderId)),
  );
}

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

describe("zone-priced delivery fee", () => {
  it("quotes the delivery fee from the active zone covering the address", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const zone = await createZone(shop, ["dhanmondi"], ZONE_FEE);
    const item = await counterItemOf(shop, "Zone tea");
    const contactId = await addCustomer(shop, "Rahim", RAHIM_PHONE);
    const draft = await draftOrder(shop, {
      locationId: shop.locationId,
      contactId,
      fulfillmentMethod: "COURIER",
      deliveryAddress: DHAKA_ADDRESS,
      lines: linesOf(item),
    });
    expect(draft.totals.subtotal.amount).toBe(ITEM_PRICE);
    expect(draft.totals.taxTotal.amount).toBe(0);
    expect(draft.totals.deliveryCharge.amount).toBe(ZONE_FEE);
    expect(draft.totals.grandTotal.amount).toBe(ITEM_PRICE + ZONE_FEE);
    expect(deliveryOf(draft)?.deliveryZoneId).toBe(zone.deliveryZoneId);
    expect(deliveryOf(draft)?.address?.phoneE164).toBe(STORED_PHONE);

    const placed = await placeOrder(shop, { orderId: draft.orderId, version: draft.version });
    expect(placed.status).toBe(200);
    expect(placed.order.totals.subtotal.amount).toBe(ITEM_PRICE);
    expect(placed.order.totals.taxTotal.amount).toBe(0);
    expect(placed.order.totals.grandTotal.amount - ITEM_PRICE).toBe(ZONE_FEE);
    const summary = await paymentOf(shop, placed.order.orderId);
    expect(summary?.total.amount).toBe(ITEM_PRICE + ZONE_FEE);
    expect(summary?.due.amount).toBe(ITEM_PRICE + ZONE_FEE);
  });

  it("refuses a valid area code no ACTIVE zone carries with DELIVERY_ZONE_UNAVAILABLE", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const item = await counterItemOf(shop, "Uncovered tea");
    const refused = await shop.actor.call("post", ordersPath(shop.organizationId), {
      locationId: shop.locationId,
      fulfillmentMethod: "COURIER",
      deliveryAddress: DHAKA_ADDRESS,
      lines: linesOf(item),
    });
    expectRule(refused, SALES_DELIVERY_RULE_KEY.DELIVERY_ZONE_UNAVAILABLE);
    expect(refused.body.error.details.areaCode).toBe("dhanmondi");
  });

  it("does not accept another organization's zone for the same area code", async () => {
    const world = await worldFor(harness, RETAIL);
    const shopA = shopOf(world);
    const shopB: SalesShop = {
      actor: world.bob,
      organizationId: world.organizationB,
      locationId: world.locationB1,
    };
    await createZone(shopB, ["dhanmondi"], ZONE_FEE);
    const item = await counterItemOf(shopA, "Cross-org zone tea");
    const refused = await shopA.actor.call("post", ordersPath(shopA.organizationId), {
      locationId: shopA.locationId,
      fulfillmentMethod: "COURIER",
      deliveryAddress: DHAKA_ADDRESS,
      lines: linesOf(item),
    });
    expectRule(refused, SALES_DELIVERY_RULE_KEY.DELIVERY_ZONE_UNAVAILABLE);
  });

  it("prices pickup at delivery fee 0", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    await createZone(shop, ["dhanmondi"], ZONE_FEE);
    const item = await counterItemOf(shop, "Pickup tea");
    const contactId = await addCustomer(shop, "Rahim pickup", RAHIM_PHONE);
    const draft = await draftOrder(shop, {
      locationId: shop.locationId,
      contactId,
      fulfillmentMethod: "PICKUP",
      lines: linesOf(item),
    });
    expect(draft.totals.deliveryCharge.amount).toBe(0);
    expect(draft.totals.grandTotal.amount).toBe(ITEM_PRICE);
    expect(deliveryOf(draft)).toBeNull();
  });

  it("re-prices the fee and due when the address is edited", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    await createZone(shop, ["dhanmondi"], ZONE_FEE);
    await createZone(shop, ["gulshan"], OTHER_FEE);
    const item = await counterItemOf(shop, "Address reprice tea");
    const contactId = await addCustomer(shop, "Rahim reprice", RAHIM_PHONE);
    const draft = await draftOrder(shop, {
      locationId: shop.locationId,
      contactId,
      fulfillmentMethod: "COURIER",
      deliveryAddress: DHAKA_ADDRESS,
      lines: linesOf(item),
    });
    const placed = await placeOrder(shop, { orderId: draft.orderId, version: draft.version });
    expect(placed.order.totals.deliveryCharge.amount).toBe(ZONE_FEE);
    const patched = await shop.actor.call("patch", ordersPath(shop.organizationId, `/${draft.orderId}`), {
      version: placed.order.version,
      deliveryAddress: GULSHAN_ADDRESS,
    });
    expect(patched.status).toBe(200);
    expect(patched.body.data.totals.deliveryCharge.amount).toBe(OTHER_FEE);
    expect(patched.body.data.totals.grandTotal.amount).toBe(ITEM_PRICE + OTHER_FEE);
    const summary = await paymentOf(shop, draft.orderId);
    expect(summary?.total.amount).toBe(ITEM_PRICE + OTHER_FEE);
    expect(summary?.due.amount).toBe(ITEM_PRICE + OTHER_FEE);
  });

  it("re-prices or clears the fee when the method switches between PICKUP and COURIER", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    await createZone(shop, ["dhanmondi"], ZONE_FEE);
    const item = await counterItemOf(shop, "Method reprice tea");
    const contactId = await addCustomer(shop, "Rahim method", RAHIM_PHONE);
    const pickup = await draftOrder(shop, {
      locationId: shop.locationId,
      contactId,
      fulfillmentMethod: "PICKUP",
      lines: linesOf(item),
    });
    const toCourier = await shop.actor.call(
      "patch",
      ordersPath(shop.organizationId, `/${pickup.orderId}`),
      {
        version: pickup.version,
        fulfillmentMethod: "COURIER",
        deliveryAddress: DHAKA_ADDRESS,
      },
    );
    expect(toCourier.status).toBe(200);
    expect(toCourier.body.data.totals.deliveryCharge.amount).toBe(ZONE_FEE);
    const toPickup = await shop.actor.call(
      "patch",
      ordersPath(shop.organizationId, `/${pickup.orderId}`),
      {
        version: toCourier.body.data.version as number,
        fulfillmentMethod: "PICKUP",
      },
    );
    expect(toPickup.status).toBe(200);
    expect(toPickup.body.data.totals.deliveryCharge.amount).toBe(0);
    expect(toPickup.body.data.delivery).toBeNull();
  });

  it("does not require or consume an approval token for an address-only PATCH on a discounted order", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    await setSetting(shop, "sales.discountOwnerWithoutApproval", false);
    await createZone(shop, ["dhanmondi", "gulshan"], ZONE_FEE);
    const item = await counterItemOf(shop, "Discounted delivery tea");
    const contactId = await addCustomer(shop, "Rahim discount", RAHIM_PHONE);
    const approverMemberId = await approverOf(world);
    const draft = await draftOrder(shop, {
      locationId: shop.locationId,
      contactId,
      fulfillmentMethod: "COURIER",
      deliveryAddress: DHAKA_ADDRESS,
      lines: [
        {
          ...linesOf(item)[0],
          manualDiscount: { type: "PERCENT", value: TWENTY_PERCENT_BP },
        },
      ],
    });
    const token = await approvalTokenFor(world.alice, shop.organizationId, {
      approverMemberId,
      subjectKey: orderApprovalSubject(draft.orderId),
      locationId: shop.locationId,
      pin: APPROVAL_PIN,
      amount: money(DISCOUNT_MINOR),
    });
    const placed = await placeOrder(shop, {
      orderId: draft.orderId,
      version: draft.version,
      approvalToken: token,
    });
    expect(placed.status).toBe(200);
    const unused = await approvalTokenFor(world.alice, shop.organizationId, {
      approverMemberId,
      subjectKey: orderApprovalSubject(draft.orderId),
      locationId: shop.locationId,
      pin: APPROVAL_PIN,
      amount: money(DISCOUNT_MINOR),
    });
    const patched = await shop.actor.call("patch", ordersPath(shop.organizationId, `/${draft.orderId}`), {
      version: placed.order.version,
      deliveryAddress: GULSHAN_ADDRESS,
      approvalToken: unused,
    });
    expect(patched.status).toBe(200);
    expect(patched.body.data.error).toBeUndefined();
    expect(patched.body.data.approval).toMatchObject({
      approverMemberId,
      action: "DISCOUNT",
    });
    const lineEdit = await shop.actor.call(
      "patch",
      ordersPath(shop.organizationId, `/${draft.orderId}`),
      {
        version: patched.body.data.version as number,
        lines: [
          {
            ...linesOf(item)[0],
            quantity: 1,
            manualDiscount: { type: "PERCENT", value: TWENTY_PERCENT_BP },
          },
        ],
        approvalToken: unused,
      },
    );
    expect(lineEdit.status).toBe(200);
  });

  it("leaves every orderLineId byte-identical after a delivery-only PATCH so a return plan still resolves", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    await createZone(shop, ["dhanmondi", "gulshan"], ZONE_FEE);
    const item = await counterItemOf(shop, "Stable line tea");
    const contactId = await addCustomer(shop, "Rahim lines", RAHIM_PHONE);
    const draft = await draftOrder(shop, {
      locationId: shop.locationId,
      contactId,
      fulfillmentMethod: "COURIER",
      deliveryAddress: DHAKA_ADDRESS,
      lines: linesOf(item),
    });
    const placed = await placeOrder(shop, { orderId: draft.orderId, version: draft.version });
    const lineIds = placed.order.lines.map((line) => line.orderLineId);
    const patched = await shop.actor.call("patch", ordersPath(shop.organizationId, `/${draft.orderId}`), {
      version: placed.order.version,
      deliveryAddress: GULSHAN_ADDRESS,
    });
    expect(patched.status).toBe(200);
    expect(patched.body.data.lines.map((line: { orderLineId: string }) => line.orderLineId)).toEqual(
      lineIds,
    );
    const stored = await storedOrder(shop, draft.orderId);
    expect(stored).toBeDefined();
    if (!stored) {
      throw new Error("stored order missing");
    }
    const plan = planSalesReturn({
      lines: stored.lines,
      totals: stored.totals,
      requestLines: [
        {
          orderLineId: lineIds[0] ?? "",
          quantity: 1,
          disposition: RETURN_DISPOSITION.RESTOCK,
        },
      ],
      returnDeliveryCharge: false,
      reasonKey: SALES_RETURN_REASON.CHANGED_MIND,
      note: null,
      deliveryReturnedBefore: {
        amount: 0,
        currency: stored.totals.grandTotal.currency ?? CURRENCY_CODE.BDT,
      },
    });
    expect(plan.lines[0]?.orderLineId).toBe(lineIds[0]);
  });

  it("refuses a zone whose stored fee currency differs from the order currency", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const areaCode = "foreign-area";
    await runInOrganizationContext(shop.organizationId, async () => {
      const zone = DeliveryZone.create({
        organizationId: asId<OrganizationId>(shop.organizationId),
        zoneKey: `fx-${newId().slice(-10)}`,
        name: { bn: "বিদেশি", en: "Foreign" },
        areaCodes: [areaCode],
        fee: { amount: ZONE_FEE, currency: CURRENCY_CODE.BDT },
        status: DELIVERY_ZONE_STATUS.ACTIVE,
        actorUserId: asId<UserId>(newId()),
        now: new Date(),
      });
      await new MongoDeliveryZoneRepository().insert(zone);
      await models({})
        .get(DELIVERY_ZONE_MODEL_NAME)
        .updateOne({ deliveryZoneId: zone.deliveryZoneId }, { $set: { "fee.currency": "USD" } });
    });
    const item = await counterItemOf(shop, "Currency mismatch tea");
    const refused = await shop.actor.call("post", ordersPath(shop.organizationId), {
      locationId: shop.locationId,
      fulfillmentMethod: "COURIER",
      deliveryAddress: { ...DHAKA_ADDRESS, areaCode },
      lines: linesOf(item),
    });
    expectRule(refused, SALES_DELIVERY_RULE_KEY.DELIVERY_ZONE_CURRENCY_MISMATCH);
    const listed = await shop.actor.call("get", ordersPath(shop.organizationId));
    expect(listed.body.data).toEqual([]);
  });

  it("keeps the zone fee currency when it matches the order and does not re-stamp", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    await createZone(shop, ["dhanmondi"], ZONE_FEE);
    const item = await counterItemOf(shop, "Matching currency tea");
    const contactId = await addCustomer(shop, "Rahim currency", RAHIM_PHONE);
    const draft = await draftOrder(shop, {
      locationId: shop.locationId,
      contactId,
      fulfillmentMethod: "COURIER",
      deliveryAddress: DHAKA_ADDRESS,
      lines: linesOf(item),
    });
    expect(draft.totals.deliveryCharge).toEqual({ amount: ZONE_FEE, currency: CURRENCY_CODE.BDT });
    expect(draft.totals.grandTotal.currency).toBe(CURRENCY_CODE.BDT);
  });

  it("does not release or re-reserve stock on an address or method-only PATCH", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    await createZone(shop, ["dhanmondi", "gulshan"], ZONE_FEE);
    const riceItemId = await addInventoryItem(shop, "Fee rice");
    const pack = await publishOffering(shop, {
      kind: "PRODUCT",
      name: "Fee rice pack",
      priceAmount: ITEM_PRICE,
      stockComponents: [{ inventoryItemId: riceItemId, quantity: PACK_GRAMS }],
    });
    await receiveStock(shop, [
      { inventoryItemId: riceItemId, quantity: 5 * PACK_GRAMS, unitCostAmount: 60 },
    ]);
    const contactId = await addCustomer(shop, "Rahim stock fee", RAHIM_PHONE);
    const draft = await draftOrder(shop, {
      locationId: shop.locationId,
      contactId,
      fulfillmentMethod: "COURIER",
      deliveryAddress: DHAKA_ADDRESS,
      lines: [{ offeringId: pack.offeringId, variantId: pack.variantId, quantity: 1 }],
    });
    const placed = await placeOrder(shop, { orderId: draft.orderId, version: draft.version });
    expect(placed.status).toBe(200);
    const reservedBefore = await levelOf(shop, riceItemId);
    const movementsBefore = await movementsOf(shop);
    const patched = await shop.actor.call("patch", ordersPath(shop.organizationId, `/${draft.orderId}`), {
      version: placed.order.version,
      deliveryAddress: GULSHAN_ADDRESS,
    });
    expect(patched.status).toBe(200);
    expect(await levelOf(shop, riceItemId)).toEqual(reservedBefore);
    expect(await movementsOf(shop)).toHaveLength(movementsBefore.length);
  });
});
