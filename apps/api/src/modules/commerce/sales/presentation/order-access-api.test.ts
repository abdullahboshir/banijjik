import { PACKAGE_KEY, SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  memberWithRole,
  startCatalogApi,
  worldFor,
} from "../../../../test-support/catalog-world.js";
import { loginViaApi } from "../../../../test-support/auth-api-scenarios.js";
import { registerIamApiModels } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import type { MutableClock } from "../../../../test-support/mutable-clock.js";
import { addMemberWithAssignments, findSystemRoleId } from "../../../../test-support/rbac-world.js";
import {
  addCustomer,
  addInventoryItem,
  draftOrder,
  ordersPath,
  publishOffering,
  receiveStock,
  shopOf,
} from "../../../../test-support/sales-api-world.js";
import type { SalesShop } from "../../../../test-support/sales-api-world.js";
import { ApiActor, type TwoOrganizations } from "../../../../test-support/two-organizations.js";
import { PACKAGE_CATALOG_REFRESH_MILLISECONDS } from "../../../platform/entitlement/index.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };
const PACK_GRAMS = 1_000;
const PACK_PRICE = 10_000;
const RICE_COST_PER_GRAM = 60;
const RAHIM_PHONE = "+8801700000001";
/** Tightened on the BUNDLE package below, so one placed order fills the month. */
const ORDERS_PER_MONTH = 1;
const MILLISECONDS_PER_SECOND = 1000;
const HOURS_IN_SECONDS = 3_600;
/** Bangladesh stays on a fixed +06 all year, so the month flip is an exact UTC instant. */
const DHAKA_UTC_OFFSET_HOURS = 6;

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startCatalogApi();
  // This file has its own database, so the BUNDLE package can be tightened for all its tests.
  await harness.connections.platform
    .collection("packages")
    .updateOne(
      { packageKey: PACKAGE_KEY.BUNDLE },
      { $set: { "limits.ordersPerMonth": ORDERS_PER_MONTH }, $inc: { version: 1 } },
    );
  harness.clock.advanceSeconds(PACKAGE_CATALOG_REFRESH_MILLISECONDS / MILLISECONDS_PER_SECOND + 1);
});

afterAll(async () => {
  await harness.dispose();
});

interface Pack {
  readonly offeringId: string;
  readonly variantId: string;
}

interface Draft {
  readonly orderId: string;
  readonly version: number;
}

/** One pack of rice on the shelf, with ten of them in stock. */
async function shelfOf(shop: SalesShop): Promise<Pack> {
  const riceItemId = await addInventoryItem(shop, "Rice");
  const pack = await publishOffering(shop, {
    kind: "PRODUCT",
    name: "Rice 1kg pack",
    priceAmount: PACK_PRICE,
    stockComponents: [{ inventoryItemId: riceItemId, quantity: PACK_GRAMS }],
  });
  await receiveStock(shop, [
    { inventoryItemId: riceItemId, quantity: 10 * PACK_GRAMS, unitCostAmount: RICE_COST_PER_GRAM },
  ]);
  return pack;
}

/** A draft of one pack for the given customer: a pickup order needs a contact with a phone. */
async function draftOnePack(shop: SalesShop, pack: Pack, contactId: string): Promise<Draft> {
  return draftOrder(shop, {
    locationId: shop.locationId,
    contactId,
    lines: [{ offeringId: pack.offeringId, variantId: pack.variantId, quantity: 1 }],
  });
}

function placeCall(shop: SalesShop, draft: Draft) {
  return shop.actor.call("post", ordersPath(shop.organizationId, `/${draft.orderId}/place`), {
    version: draft.version,
  });
}

/** Moves the clock `hours` away from the next Dhaka month flip: negative is the old month. */
function moveClockToDhakaMonthFlip(clock: MutableClock, hours: number): void {
  const now = clock.now();
  const flip =
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1) -
    DHAKA_UTC_OFFSET_HOURS * HOURS_IN_SECONDS * MILLISECONDS_PER_SECOND;
  clock.advanceSeconds(
    Math.round(
      (flip + hours * HOURS_IN_SECONDS * MILLISECONDS_PER_SECOND - now.getTime()) /
        MILLISECONDS_PER_SECOND,
    ),
  );
}

/** A fresh sign-in for the owner: the clock jump ages the session cookie the API issued. */
async function relogin(world: TwoOrganizations): Promise<ApiActor> {
  const session = await loginViaApi(harness.app, world.alice.person);
  return new ApiActor(harness.app, { ...world.alice.person, session });
}

describe("who may reach the orders API", () => {
  it("refuses a create by a viewer, who may still list", async () => {
    const world: TwoOrganizations = await worldFor(harness, RETAIL);
    const viewer = await memberWithRole(harness, world, SYSTEM_ROLE_KEY.VIEWER);

    const denied = await viewer.call("post", ordersPath(world.organizationA), {
      locationId: world.locationA1,
      lines: [],
    });
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe("FORBIDDEN");

    const listed = await viewer.call("get", `${ordersPath(world.organizationA)}?limit=50`);
    expect(listed.status).toBe(200);
  });

  it("hides an order of another organization", async () => {
    const world = await worldFor(harness, RETAIL);
    const foreign = await world.bob.call("post", ordersPath(world.organizationB), {
      locationId: world.locationB1,
      lines: [],
    });
    expect(foreign.status).toBe(201);
    const foreignOrderId = foreign.body.data.orderId as string;

    const read = await world.alice.call(
      "get",
      ordersPath(world.organizationA, `/${foreignOrderId}`),
    );
    expect(read.status).toBe(404);
    expect(read.body.error.code).toBe("NOT_FOUND");

    const listed = await world.alice.call("get", `${ordersPath(world.organizationA)}?limit=50`);
    expect(listed.body.data).toEqual([]);
  });

  it("refuses a location the member is not assigned to", async () => {
    const world = await worldFor(harness, RETAIL);
    const staffRoleId = await findSystemRoleId(
      harness.connections,
      world.organizationA,
      SYSTEM_ROLE_KEY.STAFF,
    );
    const staff = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: world.locationA2, roleId: staffRoleId },
    ]);

    const atHome = await staff.actor.call("post", ordersPath(world.organizationA), {
      locationId: world.locationA2,
      lines: [],
    });
    expect(atHome.status).toBe(201);

    const elsewhere = await staff.actor.call("post", ordersPath(world.organizationA), {
      locationId: world.locationA1,
      lines: [],
    });
    expect(elsewhere.status).toBe(403);
    expect(elsewhere.body.error.code).toBe("LOCATION_FORBIDDEN");
  });
});

describe("the monthly order limit", () => {
  it("refuses the order past the limit of the package, naming the key and the limit", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const pack = await shelfOf(shop);
    const contactId = await addCustomer(shop, "Rahim", RAHIM_PHONE);
    const first = await draftOnePack(shop, pack, contactId);
    expect((await placeCall(shop, first)).status).toBe(200);

    const second = await draftOnePack(shop, pack, contactId);
    const refused = await placeCall(shop, second);

    expect(refused.status).toBe(422);
    expect(refused.body.error).toMatchObject({
      code: "LIMIT_REACHED",
      details: { limitKey: "ordersPerMonth", limit: ORDERS_PER_MONTH },
    });
  });

  it("lets only one of two concurrent places through at the edge", async () => {
    const shop = shopOf(await worldFor(harness, RETAIL));
    const pack = await shelfOf(shop);
    const contactId = await addCustomer(shop, "Rahim", RAHIM_PHONE);
    const drafts = await Promise.all([
      draftOnePack(shop, pack, contactId),
      draftOnePack(shop, pack, contactId),
    ]);

    const placed = await Promise.all(drafts.map((draft) => placeCall(shop, draft)));

    expect(placed.map((response) => response.status).sort()).toEqual([200, 422]);
  });

  it("starts the monthly count again when the organization's month turns in Dhaka", async () => {
    const world = await worldFor(harness, RETAIL);
    const shop = shopOf(world);
    const pack = await shelfOf(shop);
    const contactId = await addCustomer(shop, "Rahim", RAHIM_PHONE);

    // 18:00 on the month's last Dhaka day; the jump ages the issued session, so sign in again.
    moveClockToDhakaMonthFlip(harness.clock, -DHAKA_UTC_OFFSET_HOURS);
    const october = { ...shop, actor: await relogin(world) };
    const lastDay = await draftOnePack(october, pack, contactId);
    expect((await placeCall(october, lastDay)).status).toBe(200);

    // 01:00 on the 1st, inside the 00:00–06:00 stretch the month counter must not lose.
    moveClockToDhakaMonthFlip(harness.clock, 1);
    const november = { ...shop, actor: await relogin(world) };
    const firstDay = await draftOnePack(november, pack, contactId);
    expect((await placeCall(november, firstDay)).status).toBe(200);

    const over = await draftOnePack(november, pack, contactId);
    const refused = await placeCall(november, over);
    expect(refused.status).toBe(422);
    expect(refused.body.error).toMatchObject({
      code: "LIMIT_REACHED",
      details: { limitKey: "ordersPerMonth", limit: ORDERS_PER_MONTH },
    });
  });
});
