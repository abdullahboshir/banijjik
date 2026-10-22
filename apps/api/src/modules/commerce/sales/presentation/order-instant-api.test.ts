import { ALL_LOCATIONS, AUDIT_ACTION, SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { INSTANT_ORDER_APPROVAL_SUBJECT, SALES_EVENT_TYPE } from "@banijjik/contracts/sales";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { API_PASSWORD } from "../../../../test-support/auth-api-scenarios.js";
import { money, startCatalogApi, worldFor } from "../../../../test-support/catalog-world.js";
import { registerIamApiModels } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import {
  countAuditRows,
  countOutboxRows,
} from "../../../../test-support/organization-tenant-world.js";
import { addMemberWithAssignments, findSystemRoleId } from "../../../../test-support/rbac-world.js";
import {
  addCustomer,
  addInventoryItem,
  approvalTokenFor,
  instantOrder,
  levelOf,
  listOrders,
  movementsOf,
  publishOffering,
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
/** Over the 10 % approval threshold of the pricing defaults. */
const BIG_DISCOUNT_BP = 2_000;
const ONE_PACK_IN_STOCK = 1;
const FIRST_NUMBER = "000001";
const LOST_THEN_SECOND_NUMBER = "000002";

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

/** A shelf with the given number of packs of rice on it. */
async function shelfOf(shop: SalesShop, packs: number): Promise<Pack> {
  const riceItemId = await addInventoryItem(shop, `Rice ${packs}`);
  const pack = await publishOffering(shop, {
    kind: "PRODUCT",
    name: `Rice 1kg pack ${packs}`,
    priceAmount: PACK_PRICE,
    stockComponents: [{ inventoryItemId: riceItemId, quantity: PACK_GRAMS }],
  });
  await receiveStock(shop, [
    {
      inventoryItemId: riceItemId,
      quantity: packs * PACK_GRAMS,
      unitCostAmount: RICE_COST_PER_GRAM,
    },
  ]);
  return { ...pack, riceItemId };
}

function linesOf(pack: Pack, quantity: number) {
  return [{ offeringId: pack.offeringId, variantId: pack.variantId, quantity }];
}

/** What a sale leaves behind when it goes through; an aborted one must leave none of it. */
const NO_TRACE = { orders: 0, saleMovements: 0, events: 0, audit: 0 };

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

/** Nothing an instant sale ever writes: an order row, a SALE movement, an event, an audit entry. */
async function tracesOf(shop: SalesShop): Promise<Record<string, number>> {
  const sales = (await movementsOf(shop)).filter((row) => row.reason === "SALE");
  return {
    orders: (await listOrders(shop)).length,
    saleMovements: sales.length,
    events: await countOutboxRows(harness.connections, {
      organizationId: shop.organizationId,
      type: { $in: [SALES_EVENT_TYPE.ORDER_PLACED, SALES_EVENT_TYPE.ORDER_COMPLETED] },
    }),
    audit: await countAuditRows(harness.connections, {
      organizationId: shop.organizationId,
      action: { $in: [AUDIT_ACTION.ORDER_PLACED, AUDIT_ACTION.ORDER_COMPLETED] },
    }),
  };
}

describe("the instant counter sale", () => {
  it("leaves no order, movement, event or audit row when the stock is not there", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const pack = await shelfOf(shop, ONE_PACK_IN_STOCK);
    const contactId = await addCustomer(shop, "Rahim", RAHIM_PHONE);

    const tooMany = await instantOrder(shop, {
      locationId: shop.locationId,
      contactId,
      lines: linesOf(pack, 2),
    });

    expect(tooMany.status).toBe(409);
    expect(tooMany.order).toBeUndefined();
    expect(await tracesOf(shop)).toEqual(NO_TRACE);
    expect(await levelOf(shop, pack.riceItemId)).toEqual({
      onHand: ONE_PACK_IN_STOCK * PACK_GRAMS,
      reserved: 0,
    });

    const fits = await instantOrder(shop, {
      locationId: shop.locationId,
      contactId,
      lines: linesOf(pack, 1),
    });

    // ORDER is a FAST sequence, so the number of the aborted sale is lost; INVOICE is gapless
    // inside the transaction, so it rolled back and the first invoice is still 000001.
    expect(fits.status).toBe(201);
    expect(fits.order.orderNumber).toBe(LOST_THEN_SECOND_NUMBER);
    expect(fits.order.invoiceNumber).toBe(FIRST_NUMBER);
    expect(await tracesOf(shop)).toEqual({
      ...NO_TRACE,
      orders: 1,
      saleMovements: 1,
      events: 2,
      audit: 2,
    });
  });

  it("consumes no order number when a discount approval is missing, then takes the instant token", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const approverMemberId = await approverOf(world);
    await setSetting(shop, "sales.discountOwnerWithoutApproval", false);
    const pack = await shelfOf(shop, ONE_PACK_IN_STOCK);
    const lines = [
      { ...linesOf(pack, 1)[0], manualDiscount: { type: "PERCENT", value: BIG_DISCOUNT_BP } },
    ];

    const refused = await instantOrder(shop, { locationId: shop.locationId, lines });
    expect(refused.status).toBe(403);
    expect(refused.order).toBeUndefined();
    expect(await tracesOf(shop)).toEqual(NO_TRACE);
    expect(await levelOf(shop, pack.riceItemId)).toEqual({
      onHand: PACK_GRAMS,
      reserved: 0,
    });

    // The order of an instant sale does not exist when the token is asked for, so every counter
    // sale shares one subject (ADR-131).
    const token = await approvalTokenFor(world.alice, shop.organizationId, {
      approverMemberId,
      subjectKey: INSTANT_ORDER_APPROVAL_SUBJECT,
      locationId: shop.locationId,
      pin: APPROVAL_PIN,
    });
    const sold = await instantOrder(shop, {
      locationId: shop.locationId,
      lines,
      approvalToken: token,
    });

    expect(sold.status).toBe(201);
    expect(sold.order.orderNumber).toBe(FIRST_NUMBER);
    expect(sold.order.approval).toMatchObject({ approverMemberId });
    expect(sold.order.totals.discountTotal).toEqual(money(2_000));
    expect(await levelOf(shop, pack.riceItemId)).toEqual({ onHand: 0, reserved: 0 });
  });
});
