import { ALL_LOCATIONS, SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { APPROVAL_ACTION } from "@banijjik/contracts/iam";
import { orderApprovalSubject } from "@banijjik/contracts/sales";
import type { Response } from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { API_PASSWORD } from "../../../../test-support/auth-api-scenarios.js";
import { money, startCatalogApi, worldFor } from "../../../../test-support/catalog-world.js";
import { registerIamApiModels } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import { addMemberWithAssignments, findSystemRoleId } from "../../../../test-support/rbac-world.js";
import {
  addCustomer,
  addInventoryItem,
  approvalTokenFor,
  draftOrder,
  getOrder,
  levelOf,
  ordersPath,
  placeOrder,
  publishOffering,
  quoteOf,
  receiveStock,
  setSetting,
  shopOf,
} from "../../../../test-support/sales-api-world.js";
import type { SalesShop } from "../../../../test-support/sales-api-world.js";
import type { TwoOrganizations } from "../../../../test-support/two-organizations.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };

const PACK_GRAMS = 1_000;
const PACK_PRICE = 10_000;
const RICE_COST_PER_GRAM = 60;
const RAHIM_PHONE = "+8801700000001";
const APPROVAL_PIN = "4321";
/** The default approval threshold is above 10 %, so 20 % needs a token and 10 % does not. */
const BIG_DISCOUNT_BP = 2_000;
const TEN_PERCENT_BP = 1_000;
const VAT_BASIS_POINTS = 750;

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startCatalogApi();
});

afterAll(async () => {
  await harness.dispose();
});

/** A published offering and the one variant every test sells from. */
interface Selling {
  readonly offeringId: string;
  readonly variantId: string;
}

interface Pack extends Selling {
  readonly riceItemId: string;
}

interface OrderRef {
  readonly orderId: string;
  readonly version: number;
}

function linesOf(offering: Selling, quantity: number) {
  return [{ offeringId: offering.offeringId, variantId: offering.variantId, quantity }];
}

/** A pack of rice the counter can sell ten of, with the item it draws from. */
async function packOf(shop: SalesShop, label: string): Promise<Pack> {
  const riceItemId = await addInventoryItem(shop, `Rice ${label}`);
  const published = await publishOffering(shop, {
    kind: "PRODUCT",
    name: `Rice 1kg pack ${label}`,
    priceAmount: PACK_PRICE,
    stockComponents: [{ inventoryItemId: riceItemId, quantity: PACK_GRAMS }],
  });
  await receiveStock(shop, [
    {
      inventoryItemId: riceItemId,
      quantity: 10 * PACK_GRAMS,
      unitCostAmount: RICE_COST_PER_GRAM,
    },
  ]);
  return { ...published, riceItemId };
}

/** A member who may grant an approval, with a PIN, so a discount can be approved over the counter. */
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

function placeCall(shop: SalesShop, order: OrderRef): Promise<Response> {
  return shop.actor.call("post", ordersPath(shop.organizationId, `/${order.orderId}/place`), {
    version: order.version,
  });
}

async function changePackPrice(shop: SalesShop, pack: Pack, newPrice: number): Promise<void> {
  const current = await shop.actor.call(
    "get",
    `/orgs/${shop.organizationId}/offerings/${pack.offeringId}`,
  );
  expect(current.status).toBe(200);
  const edited = await shop.actor.call(
    "patch",
    `/orgs/${shop.organizationId}/offerings/${pack.offeringId}`,
    {
      version: current.body.data.version as number,
      variants: [{ variantId: pack.variantId, price: money(newPrice), unitKey: "PIECE" }],
    },
  );
  expect(edited.status).toBe(200);
}

function discountedLines(offering: Selling) {
  return [
    {
      ...linesOf(offering, 1)[0],
      manualDiscount: { type: "PERCENT", value: BIG_DISCOUNT_BP },
    },
  ];
}

describe("the money an order keeps", () => {
  it("refuses a price the client tries to send with a line", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const pack = await packOf(shop, "client money");

    const withPrice = await shop.actor.call("post", ordersPath(shop.organizationId), {
      locationId: shop.locationId,
      lines: [{ ...linesOf(pack, 1)[0], unitPrice: money(1) }],
    });
    expect(withPrice.status).toBe(400);
    expect(withPrice.body.error.details.fields).toContainEqual({
      path: "lines.0",
      messageKey: "validation.unrecognized_keys",
    });

    const draft = await draftOrder(shop, {
      locationId: shop.locationId,
      lines: linesOf(pack, 3),
    });
    expect(draft.totals.subtotal).toEqual(money(3 * PACK_PRICE));
  });

  it("keeps the quoted price when the catalog price changes later", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const pack = await packOf(shop, "frozen price");
    const contactId = await addCustomer(shop, "Rahim", RAHIM_PHONE);
    const draft = await draftOrder(shop, {
      locationId: shop.locationId,
      contactId,
      lines: linesOf(pack, 2),
    });
    const placed = await placeOrder(shop, { orderId: draft.orderId, version: draft.version });
    expect(placed.order.totals.subtotal).toEqual(money(2 * PACK_PRICE));

    await changePackPrice(shop, pack, 2 * PACK_PRICE);

    const quote = await quoteOf(shop, linesOf(pack, 2));
    expect(quote.totals.subtotal).toEqual(money(4 * PACK_PRICE));
    const stored = await getOrder(shop, draft.orderId);
    expect(stored.totals.subtotal).toEqual(money(2 * PACK_PRICE));
    expect(stored.lines[0]?.unitPrice).toEqual(money(PACK_PRICE));
  });

  it("carries a promotion and a tax class exactly as the quoter answers", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    // Bangladesh seeds prices as tax-inclusive; the exclusive setting makes the VAT a
    // separate, checkable number on top of the discounted line.
    await setSetting(shop, "pricing.taxInclusive", false);
    const taxClass = await shop.actor.call("post", `/orgs/${shop.organizationId}/tax-classes`, {
      taxClassKey: "vat-standard",
      name: "VAT 7.5%",
      rateBasisPoints: VAT_BASIS_POINTS,
    });
    expect(taxClass.status).toBe(201);
    const riceItemId = await addInventoryItem(shop, "Rice vat");
    const pack = await publishOffering(shop, {
      kind: "PRODUCT",
      name: "Rice 1kg pack vat",
      priceAmount: PACK_PRICE,
      taxClassKey: "vat-standard",
      stockComponents: [{ inventoryItemId: riceItemId, quantity: PACK_GRAMS }],
    });
    const created = await shop.actor.call("post", `/orgs/${shop.organizationId}/promotions`, {
      name: "Ten percent off packs",
      priority: 10,
      target: { scope: "OFFERING", ids: [pack.offeringId] },
      benefit: { type: "PERCENT", value: TEN_PERCENT_BP },
    });
    expect(created.status).toBe(201);
    const promotionId = created.body.data.promotionId as string;
    const activated = await shop.actor.call(
      "patch",
      `/orgs/${shop.organizationId}/promotions/${promotionId}`,
      { version: 1, status: "ACTIVE" },
    );
    expect(activated.status).toBe(200);

    const quote = await quoteOf(shop, linesOf(pack, 2));
    const draft = await draftOrder(shop, {
      locationId: shop.locationId,
      lines: linesOf(pack, 2),
    });
    expect(draft.totals).toMatchObject(quote.totals);
    expect(draft.lines[0]?.promotionIds).toEqual([promotionId]);
    expect(draft.lines[0]?.taxClassKey).toBe("vat-standard");
    expect(draft.totals.subtotal).toEqual(money(2 * PACK_PRICE));
    expect(draft.totals.discountTotal).toEqual(money(2_000));
    expect(draft.totals.taxTotal).toEqual(money(1_350));
    expect(draft.totals.grandTotal).toEqual(money(19_350));
  });

  it("refuses a large discount without a token, then takes the approved one", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const approverMemberId = await approverOf(world);
    await setSetting(shop, "sales.discountOwnerWithoutApproval", false);
    const pack = await packOf(shop, "approval");
    const contactId = await addCustomer(shop, "Rahim", RAHIM_PHONE);
    const body = { locationId: shop.locationId, contactId, lines: discountedLines(pack) };

    const first = await draftOrder(shop, body);
    const refused = await placeCall(shop, first);
    expect(refused.status).toBe(403);
    expect(refused.body.error.code).toBe("APPROVAL_REQUIRED");
    expect(refused.body.error.details).toEqual({ action: APPROVAL_ACTION.DISCOUNT });
    expect(await levelOf(shop, pack.riceItemId)).toEqual({
      onHand: 10 * PACK_GRAMS,
      reserved: 0,
    });

    const token = await approvalTokenFor(world.alice, shop.organizationId, {
      approverMemberId,
      subjectKey: orderApprovalSubject(first.orderId),
      locationId: shop.locationId,
      pin: APPROVAL_PIN,
    });
    const approved = await placeOrder(shop, {
      orderId: first.orderId,
      version: first.version,
      approvalToken: token,
    });
    expect(approved.status).toBe(200);
    expect(approved.order.approval).toMatchObject({
      approverMemberId,
      action: APPROVAL_ACTION.DISCOUNT,
    });

    const second = await draftOrder(shop, body);
    const reused = await placeOrder(shop, {
      orderId: second.orderId,
      version: second.version,
      approvalToken: token,
    });
    expect(reused.status).toBe(403);
    expect(await levelOf(shop, pack.riceItemId)).toEqual({
      onHand: 10 * PACK_GRAMS,
      reserved: PACK_GRAMS,
    });
  });

  it("lets the OWNER give a large discount without a token by default", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const pack = await packOf(shop, "owner exempt");
    const contactId = await addCustomer(shop, "Rahim", RAHIM_PHONE);

    const draft = await draftOrder(shop, {
      locationId: shop.locationId,
      contactId,
      lines: discountedLines(pack),
    });
    const placed = await placeOrder(shop, { orderId: draft.orderId, version: draft.version });

    expect(placed.status).toBe(200);
    expect(placed.order.approval).toBeNull();
    expect(placed.order.totals.discountTotal).toEqual(money(2_000));
  });
});
