import { SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  memberWithRole,
  startCatalogApi,
  worldFor,
} from "../../../../test-support/catalog-world.js";
import { registerIamApiModels } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import { addMemberWithAssignments, findSystemRoleId } from "../../../../test-support/rbac-world.js";
import type { OrderRow } from "../../../../test-support/sales-api-rows.js";
import {
  addCustomer,
  addInventoryItem,
  completeOrder,
  confirmOrder,
  draftOrder,
  getOrder,
  ordersPath,
  patchOrder,
  placeOrder,
  publishOffering,
  receiveStock,
  shopOf,
} from "../../../../test-support/sales-api-world.js";
import type { SalesShop } from "../../../../test-support/sales-api-world.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };
const PACK_GRAMS = 1_000;
const PACK_PRICE = 10_000;
const RICE_COST_PER_GRAM = 60;
const PACKS_IN_STOCK = 10;
const PERFORMER_NOT_AT_LOCATION = "SALES_PERFORMER_NOT_AT_LOCATION";
const RAHIM_PHONE = "+8801700000001";

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
}

async function shelfOf(shop: SalesShop): Promise<Pack> {
  const riceItemId = await addInventoryItem(shop, "Rice");
  const pack = await publishOffering(shop, {
    kind: "PRODUCT",
    name: "Rice 1kg pack",
    priceAmount: PACK_PRICE,
    stockComponents: [{ inventoryItemId: riceItemId, quantity: PACK_GRAMS }],
  });
  await receiveStock(shop, [
    {
      inventoryItemId: riceItemId,
      quantity: PACK_GRAMS * PACKS_IN_STOCK,
      unitCostAmount: RICE_COST_PER_GRAM,
    },
  ]);
  return pack;
}

/** One pack line, naming a performer when one is given. */
function lineOf(pack: Pack, performedByMemberId?: string | null) {
  return {
    offeringId: pack.offeringId,
    variantId: pack.variantId,
    quantity: 1,
    ...(performedByMemberId === undefined ? {} : { performedByMemberId }),
  };
}

/** A new member of `organizationId` with the STAFF role at one location; returns its memberId. */
async function staffAt(organizationId: string, locationId: string): Promise<string> {
  const roleId = await findSystemRoleId(harness.connections, organizationId, SYSTEM_ROLE_KEY.STAFF);
  const added = await addMemberWithAssignments(harness.app, organizationId, [
    { locationId, roleId },
  ]);
  return added.memberId;
}

function performerOf(order: OrderRow): string | null | undefined {
  return order.lines[0]?.performedByMemberId;
}

describe("the performer of an order line", () => {
  it("stores the performer on a draft line and returns it on the order", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const pack = await shelfOf(shop);
    const performer = await staffAt(world.organizationA, world.locationA1);

    const draft = await draftOrder(shop, {
      locationId: shop.locationId,
      lines: [lineOf(pack, performer)],
    });

    expect(performerOf(draft)).toBe(performer);
    expect(performerOf(await getOrder(shop, draft.orderId))).toBe(performer);
  });

  it("keeps no performer when the line names none", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const pack = await shelfOf(shop);

    const draft = await draftOrder(shop, { locationId: shop.locationId, lines: [lineOf(pack)] });

    expect(performerOf(draft)).toBeNull();
  });

  it("refuses a performer who is not assigned at the order's location", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const pack = await shelfOf(shop);
    const elsewhere = await staffAt(world.organizationA, world.locationA2);

    const refused = await shop.actor.call("post", ordersPath(shop.organizationId), {
      locationId: shop.locationId,
      lines: [lineOf(pack, elsewhere)],
    });

    expect(refused.status).toBe(422);
    expect(refused.body.error.code).toBe("BUSINESS_RULE");
    expect(refused.body.error.details.ruleKey).toBe(PERFORMER_NOT_AT_LOCATION);
  });

  it("refuses a performer of another organization and stores nothing", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const pack = await shelfOf(shop);
    const foreign = await staffAt(world.organizationB, world.locationB1);

    const refused = await shop.actor.call("post", ordersPath(shop.organizationId), {
      locationId: shop.locationId,
      lines: [lineOf(pack, foreign)],
    });

    expect(refused.status).toBe(422);
    expect(refused.body.error.details.ruleKey).toBe(PERFORMER_NOT_AT_LOCATION);
    const listed = await shop.actor.call("get", `${ordersPath(shop.organizationId)}?limit=50`);
    expect(listed.body.data).toEqual([]);
  });

  it("lets the performer change while the draft is open", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const pack = await shelfOf(shop);
    const first = await staffAt(world.organizationA, world.locationA1);
    const second = await staffAt(world.organizationA, world.locationA1);
    const draft = await draftOrder(shop, {
      locationId: shop.locationId,
      lines: [lineOf(pack, first)],
    });

    const changed = await patchOrder(shop, {
      orderId: draft.orderId,
      body: { version: draft.version, lines: [lineOf(pack, second)] },
    });

    expect(changed.status).toBe(200);
    expect(performerOf(changed.order)).toBe(second);
  });

  it("does not let the performer change after the order is completed", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const pack = await shelfOf(shop);
    const performer = await staffAt(world.organizationA, world.locationA1);
    const other = await staffAt(world.organizationA, world.locationA1);
    const contactId = await addCustomer(shop, "Rahim", RAHIM_PHONE);
    const draft = await draftOrder(shop, {
      locationId: shop.locationId,
      contactId,
      lines: [lineOf(pack, performer)],
    });
    const placed = await placeOrder(shop, { orderId: draft.orderId, version: draft.version });
    const confirmed = await confirmOrder(shop, {
      orderId: draft.orderId,
      version: placed.order.version,
    });
    const completed = await completeOrder(shop, {
      orderId: draft.orderId,
      version: confirmed.version,
    });

    const changed = await shop.actor.call(
      "patch",
      ordersPath(shop.organizationId, `/${draft.orderId}`),
      { version: completed.version, lines: [lineOf(pack, other)] },
    );

    expect(changed.status).toBe(409);
    expect(changed.body.error.code).toBe("INVALID_TRANSITION");
    expect(performerOf(await getOrder(shop, draft.orderId))).toBe(performer);
  });
});

describe("the performers lookup", () => {
  it("lists the active members of the location by name only, never another organization's", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const atHome = await staffAt(world.organizationA, world.locationA1);
    const atOtherLocation = await staffAt(world.organizationA, world.locationA2);
    const foreign = await staffAt(world.organizationB, world.locationB1);

    const listed = await shop.actor.call(
      "get",
      `/orgs/${world.organizationA}/sales/performers?locationId=${world.locationA1}`,
    );

    expect(listed.status).toBe(200);
    const rows = listed.body.data as { memberId: string; name: string }[];
    const ids = rows.map((row) => row.memberId);
    expect(ids).toContain(atHome);
    expect(ids).not.toContain(atOtherLocation);
    expect(ids).not.toContain(foreign);
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual(["memberId", "name"]);
    }
  });

  it("refuses the lookup without sales.order.create", async () => {
    const world = await worldFor(harness, RETAIL);
    const viewer = await memberWithRole(harness, world, SYSTEM_ROLE_KEY.VIEWER);

    const denied = await viewer.call(
      "get",
      `/orgs/${world.organizationA}/sales/performers?locationId=${world.locationA1}`,
    );

    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe("FORBIDDEN");
  });
});
