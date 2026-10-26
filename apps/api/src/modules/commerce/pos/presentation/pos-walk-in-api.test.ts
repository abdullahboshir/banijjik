import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  startCatalogApi,
  worldFor,
  offeringsPath,
} from "../../../../test-support/catalog-world.js";
import {
  registerIamApiModels,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";
import {
  instantOrder,
  setSetting,
  publishOffering,
  shopOf,
} from "../../../../test-support/sales-api-world.js";
import {
  openRegister,
  pairedTill,
  saleCall,
  tillCall,
} from "../../../../test-support/pos-api-world.js";
import { SUNDAY_SCHEDULE } from "../../../../test-support/booking-api-world.js";

registerIamApiModels();
const RETAIL = { industryTemplateKey: "RETAIL" };
const SALON = { industryTemplateKey: "SALON" };
let harness: IamApiHarness;
beforeAll(async () => {
  harness = await startCatalogApi();
});
afterAll(async () => {
  await harness.dispose();
});

async function scene() {
  const world = await worldFor(harness, RETAIL, SALON);
  const shop = shopOf(world);
  const people = await shop.actor.call(
    "get",
    `/orgs/${shop.organizationId}/sales/performers?locationId=${shop.locationId}`,
  );
  expect(people.status).toBe(200);
  const memberId = people.body.data[0].memberId as string;
  return { world, shop, memberId };
}

describe("walk-in services at the till and on the calendar", () => {
  it("a WALK_IN_ONLY service is sold at the till with its performer", async () => {
    const { world, shop, memberId } = await scene();
    const service = await publishOffering(shop, {
      kind: "SERVICE",
      name: "Walk-in haircut",
      priceAmount: 1000,
      kindDetails: {
        durationMinutes: 30,
        bookingMode: "WALK_IN_ONLY",
        requiresResource: true,
        resourceTypeKeys: ["STYLIST"],
      },
    });
    const product = await publishOffering(shop, {
      kind: "PRODUCT",
      name: "Comb",
      priceAmount: 500,
    });
    const till = await pairedTill(harness.app, {
      manager: world.alice,
      cashier: world.alice,
      organizationId: shop.organizationId,
      locationId: shop.locationId,
    });
    await openRegister(till);
    const sold = await saleCall(till, {
      lines: [
        { ...service, quantity: 1, performedByMemberId: memberId },
        { ...product, quantity: 1 },
      ],
      payments: [{ method: "CASH", amount: { amount: 1500, currency: "BDT" } }],
    });
    expect(sold.status, JSON.stringify(sold.body)).toBe(201);
    expect(sold.body.data.order.lines).toHaveLength(2);
    expect(sold.body.data.order.lines[0]).toMatchObject({
      kind: "SERVICE",
      performedByMemberId: memberId,
      unitCostSnapshot: null,
    });
    const stored = await harness.connections.tenantShared
      .collection("orders")
      .findOne({ orderId: sold.body.data.order.orderId });
    expect(stored?.["lines"][0].performedByMemberId).toBe(memberId);
  });

  it("the till catalog snapshot includes active services and leaves out inactive ones", async () => {
    const { world, shop } = await scene();
    const active = await publishOffering(shop, {
      kind: "SERVICE",
      name: "Haircut",
      priceAmount: 1000,
      kindDetails: { durationMinutes: 30 },
    });
    const inactive = await publishOffering(shop, {
      kind: "SERVICE",
      name: "Archived service",
      priceAmount: 500,
      kindDetails: { durationMinutes: 15 },
    });
    const read = await shop.actor.call(
      "get",
      offeringsPath(shop.organizationId, `/${inactive.offeringId}`),
    );
    const archived = await shop.actor.call(
      "post",
      offeringsPath(shop.organizationId, `/${inactive.offeringId}/archive`),
      { version: read.body.data.version },
    );
    expect(archived.status).toBe(200);
    const draft = await shop.actor.call("post", offeringsPath(shop.organizationId), {
      kind: "SERVICE",
      name: "Draft service",
      kindDetails: { durationMinutes: 15 },
      variants: [{ name: "Default", price: { amount: 100, currency: "BDT" }, unitKey: "SESSION" }],
    });
    expect(draft.status).toBe(201);
    const product = await publishOffering(shop, {
      kind: "PRODUCT",
      name: "Comb",
      priceAmount: 100,
    });
    const till = await pairedTill(harness.app, {
      manager: world.alice,
      cashier: world.alice,
      organizationId: shop.organizationId,
      locationId: shop.locationId,
    });
    const response = await tillCall(till, { method: "get", suffix: "/catalog-snapshot?limit=1" });
    expect(response.status).toBe(200);
    const items: { offeringId: string; kind: string }[] = [...response.body.data.items];
    let cursor: string | null = response.body.data.nextCursor;
    while (cursor !== null) {
      const page = await tillCall(till, {
        method: "get",
        suffix: `/catalog-snapshot?limit=1&cursor=${encodeURIComponent(cursor)}`,
      });
      expect(page.status).toBe(200);
      items.push(...page.body.data.items);
      cursor = page.body.data.nextCursor;
    }
    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ offeringId: active.offeringId, kind: "SERVICE" }),
        expect.objectContaining({ offeringId: product.offeringId, kind: "PRODUCT" }),
      ]),
    );
    expect(items).toHaveLength(2);
  });

  it("a walk-in service holds no slot", async () => {
    harness.clock.setNow(new Date("2026-11-01T04:00:00Z"));
    const { shop, memberId } = await scene();
    await setSetting(shop, "booking.minNoticeMinutes", 0);
    const service = await publishOffering(shop, {
      kind: "SERVICE",
      name: "Resource haircut",
      priceAmount: 1000,
      kindDetails: { durationMinutes: 30, requiresResource: true, resourceTypeKeys: ["STYLIST"] },
    });
    const resource = await shop.actor.call("post", `/orgs/${shop.organizationId}/resources`, {
      locationId: shop.locationId,
      memberId,
      resourceTypeKey: "STYLIST",
      name: "Stylist",
      capacity: 1,
      weeklySchedule: SUNDAY_SCHEDULE,
      offeringIds: [service.offeringId],
    });
    expect(resource.status, JSON.stringify(resource.body)).toBe(201);
    const path = `/orgs/${shop.organizationId}/availability?offeringId=${service.offeringId}&variantId=${service.variantId}&locationId=${shop.locationId}&date=2026-11-01`;
    const before = await shop.actor.call("get", path);
    expect(before.status).toBe(200);
    expect(before.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          startsAt: "2026-11-01T04:00:00.000Z",
          resourceIds: [resource.body.data.resourceId],
        }),
      ]),
    );
    const sold = await instantOrder(shop, {
      locationId: shop.locationId,
      lines: [{ ...service, quantity: 1, performedByMemberId: memberId }],
    });
    expect(sold.status).toBe(201);
    const after = await shop.actor.call("get", path);
    expect(after.status).toBe(200);
    expect(after.body.data).toEqual(before.body.data);
    for (const collection of ["resource_slot_usages", "bookings", "resource_time_offs"]) {
      expect(
        await harness.connections.tenantShared
          .collection(collection)
          .countDocuments({ organizationId: shop.organizationId }),
      ).toBe(0);
    }
  });
});
