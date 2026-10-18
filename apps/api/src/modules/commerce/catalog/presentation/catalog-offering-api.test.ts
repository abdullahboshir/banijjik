import { SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  money,
  memberWithRole,
  offeringsPath,
  startCatalogApi,
  worldFor,
} from "../../../../test-support/catalog-world.js";
import { registerIamApiModels } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import {
  countAuditRows,
  countOutboxRows,
} from "../../../../test-support/organization-tenant-world.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };
const SALON = { industryTemplateKey: "SALON" };
const GYM = { industryTemplateKey: "GYM" };

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startCatalogApi();
});

afterAll(async () => {
  await harness.dispose();
});

async function effects(organizationId: string, offeringId: string, action: string) {
  return {
    audits: await countAuditRows(harness.connections, {
      organizationId,
      action,
      entityId: offeringId,
    }),
    events: await countOutboxRows(harness.connections, {
      organizationId,
      type: action,
      "payload.offeringId": offeringId,
    }),
  };
}

describe("creating an offering of every kind", () => {
  it("adds a salon service with a long-hair variant that overrides the duration", async () => {
    const world = await worldFor(harness, RETAIL, SALON);

    const response = await world.alice.call("post", offeringsPath(world.organizationA), {
      kind: "SERVICE",
      name: "Haircut",
      kindDetails: { durationMinutes: 30, requiresResource: true, resourceTypeKeys: ["STYLIST"] },
      variants: [
        { name: "Short hair", price: money(30000), unitKey: "SESSION" },
        {
          name: "Long hair",
          price: money(50000),
          unitKey: "SESSION",
          overrides: { durationMinutes: 60 },
        },
      ],
    });

    expect(response.status).toBe(201);
    const offering = response.body.data;
    expect(offering).toMatchObject({
      kind: "SERVICE",
      status: "DRAFT",
      slug: "haircut",
      kindDetails: { durationMinutes: 30, bufferAfterMinutes: 0, bookingMode: "SLOT" },
    });
    expect(offering.variants.map((v: { name: string }) => v.name)).toEqual([
      "Short hair",
      "Long hair",
    ]);
    expect(offering.variants[1].overrides).toEqual({ durationMinutes: 60 });
    expect(offering.variants[0].variantId).toMatch(/^[0-9a-f-]{36}$/);
    expect(
      await effects(world.organizationA, offering.offeringId, "catalog.offering.created"),
    ).toEqual({
      audits: 1,
      events: 1,
    });
  });

  it("adds a gym plan with two billing periods and an admission fee", async () => {
    const world = await worldFor(harness, RETAIL, GYM);

    const response = await world.alice.call("post", offeringsPath(world.organizationA), {
      kind: "PLAN",
      name: "Gym membership",
      kindDetails: {
        billingPeriod: { unit: "MONTH", count: 1 },
        admissionFee: money(100000),
        freezeAllowed: true,
        maxFreezeDaysPerYear: 30,
      },
      variants: [
        { name: "Monthly", price: money(250000), unitKey: "SESSION" },
        {
          name: "Quarterly",
          price: money(650000),
          unitKey: "SESSION",
          overrides: { billingPeriod: { unit: "MONTH", count: 3 } },
        },
      ],
    });

    expect(response.status).toBe(201);
    expect(response.body.data.kindDetails).toMatchObject({
      billingPeriod: { unit: "MONTH", count: 1 },
      admissionFee: money(100000),
      startRule: "ANY_DATE",
    });
    expect(response.body.data.variants[1].overrides).toEqual({
      billingPeriod: { unit: "MONTH", count: 3 },
    });
  });

  it("adds a retail product with size variants, SKUs and a barcode", async () => {
    const world = await worldFor(harness, RETAIL);

    const response = await world.alice.call("post", offeringsPath(world.organizationA), {
      kind: "PRODUCT",
      name: "T-shirt",
      variants: [
        {
          name: "M",
          optionValues: { size: "M" },
          price: money(45000),
          compareAtPrice: money(55000),
          sku: "TS-M",
          barcode: "8901234567890",
          unitKey: "PIECE",
        },
        { optionValues: { size: "L" }, price: money(45000), sku: "TS-L", unitKey: "PIECE" },
      ],
    });

    expect(response.status).toBe(201);
    const { variants } = response.body.data;
    expect(variants[0]).toMatchObject({ sku: "TS-M", barcode: "8901234567890" });
    expect(variants[1].name).toBe("L");
  });

  it("adds loose rice in kilograms with a quantity rule in grams", async () => {
    const world = await worldFor(harness, RETAIL);

    const response = await world.alice.call("post", offeringsPath(world.organizationA), {
      kind: "PRODUCT",
      name: "Rice",
      variants: [
        {
          name: "Loose",
          price: money(9000),
          unitKey: "KG",
          quantityRule: { min: 250, step: 250 },
        },
      ],
    });

    expect(response.status).toBe(201);
    expect(response.body.data.variants[0]).toMatchObject({
      unitKey: "KG",
      quantityRule: { min: 250, step: 250 },
    });
  });

  it("gives an offering without variants one Default variant with the request's price and unit", async () => {
    const world = await worldFor(harness, RETAIL);

    const response = await world.alice.call("post", offeringsPath(world.organizationA), {
      kind: "PRODUCT",
      name: "Pen",
      price: money(1500),
      unitKey: "BOX",
    });

    expect(response.body.data.variants).toHaveLength(1);
    expect(response.body.data.variants[0]).toMatchObject({
      name: "Default",
      price: money(1500),
      unitKey: "BOX",
      status: "ACTIVE",
    });
  });

  it("uses the organization's default unit when none is sent", async () => {
    const world = await worldFor(harness, RETAIL);

    const response = await world.alice.call("post", offeringsPath(world.organizationA), {
      kind: "PRODUCT",
      name: "Notebook",
      price: money(2000),
    });

    expect(response.body.data.variants[0].unitKey).toBe("PIECE");
  });
});

describe("refusing a bad offering", () => {
  it("refuses a kind the template does not offer, at kind", async () => {
    const world = await worldFor(harness, RETAIL);

    const response = await world.alice.call("post", offeringsPath(world.organizationA), {
      kind: "SERVICE",
      name: "Haircut",
      kindDetails: { durationMinutes: 30 },
      price: money(100),
      unitKey: "SESSION",
    });

    expect(response.status).toBe(400);
    expect(response.body.error.details.fields).toEqual([
      { path: "kind", messageKey: "errors.offering_kind_not_allowed" },
    ]);
  });

  it("refuses a service field on a product", async () => {
    const world = await worldFor(harness, RETAIL);

    const response = await world.alice.call("post", offeringsPath(world.organizationA), {
      kind: "PRODUCT",
      name: "Rice",
      price: money(100),
      kindDetails: { durationMinutes: 30 },
    });

    expect(response.status).toBe(400);
    expect(response.body.error.details.fields[0].path).toBe("kindDetails");
  });

  it("refuses a price in another currency and a price with a fraction", async () => {
    const world = await worldFor(harness, RETAIL);
    const path = offeringsPath(world.organizationA);
    const base = { kind: "PRODUCT", name: "Rice" };

    const foreign = await world.alice.call("post", path, {
      ...base,
      price: { amount: 100, currency: "USD" },
    });
    const fraction = await world.alice.call("post", path, { ...base, price: money(12.5) });

    expect(foreign.status).toBe(400);
    expect(fraction.status).toBe(400);
    expect(fraction.body.error.details.fields[0].path).toBe("price.amount");
  });

  it("refuses a compare-at price below the price", async () => {
    const world = await worldFor(harness, RETAIL);

    const response = await world.alice.call("post", offeringsPath(world.organizationA), {
      kind: "PRODUCT",
      name: "Rice",
      variants: [{ price: money(500), compareAtPrice: money(400), unitKey: "PIECE" }],
    });

    expect(response.status).toBe(400);
  });

  it("refuses two variants with the same option values, at the second", async () => {
    const world = await worldFor(harness, RETAIL);

    const response = await world.alice.call("post", offeringsPath(world.organizationA), {
      kind: "PRODUCT",
      name: "T-shirt",
      variants: [
        { optionValues: { size: "M" }, price: money(100), unitKey: "PIECE" },
        { optionValues: { size: "m" }, price: money(100), unitKey: "PIECE" },
      ],
    });

    expect(response.status).toBe(400);
    expect(response.body.error.details.fields).toContainEqual({
      path: "variants.1.optionValues",
      messageKey: "errors.offering_variant_duplicate_options",
    });
  });

  it("refuses an unknown unit and more than 100 variants", async () => {
    const world = await worldFor(harness, RETAIL);
    const path = offeringsPath(world.organizationA);

    const unit = await world.alice.call("post", path, {
      kind: "PRODUCT",
      name: "Eggs",
      price: money(100),
      unitKey: "DOZEN",
    });
    const tooMany = await world.alice.call("post", path, {
      kind: "PRODUCT",
      name: "Many",
      variants: Array.from({ length: 101 }, (_unused, index) => ({
        name: `V${index}`,
        optionValues: { n: String(index) },
        price: money(100),
        unitKey: "PIECE",
      })),
    });

    expect(unit.status).toBe(400);
    expect(tooMany.status).toBe(400);
  });

  it("refuses stock components with 422 until inventory items exist", async () => {
    const world = await worldFor(harness, RETAIL);

    const response = await world.alice.call("post", offeringsPath(world.organizationA), {
      kind: "PRODUCT",
      name: "Rice",
      variants: [
        {
          price: money(100),
          unitKey: "PIECE",
          stockComponents: [
            { inventoryItemId: "0198aaaa-0000-7000-8000-000000000001", quantity: 1 },
          ],
        },
      ],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.details.ruleKey).toBe("STOCK_COMPONENTS_NEED_INVENTORY");
  });
});

describe("publishing and archiving", () => {
  async function aDraft() {
    const world = await worldFor(harness, RETAIL);
    const created = await world.alice.call("post", offeringsPath(world.organizationA), {
      kind: "PRODUCT",
      name: "Rice",
      price: money(9000),
    });
    return { world, offering: created.body.data };
  }

  it("publishes a draft once, writes one audit entry and one event, and answers 200 without a write the second time", async () => {
    const { world, offering } = await aDraft();
    const path = offeringsPath(world.organizationA, `/${offering.offeringId}/publish`);

    const first = await world.alice.call("post", path, { version: 1 });
    const again = await world.alice.call("post", path, { version: 1 });

    expect(first.body.data).toMatchObject({ status: "ACTIVE", version: 2 });
    expect(again.status).toBe(200);
    expect(again.body.data.version).toBe(2);
    expect(
      await effects(world.organizationA, offering.offeringId, "catalog.offering.published"),
    ).toEqual({ audits: 1, events: 1 });
  });

  it("archives an offering, which is then read-only", async () => {
    const { world, offering } = await aDraft();
    const base = offeringsPath(world.organizationA, `/${offering.offeringId}`);

    const archived = await world.alice.call("post", `${base}/archive`, { version: 1 });
    const edit = await world.alice.call("patch", base, { name: "Brown rice", version: 2 });
    const publish = await world.alice.call("post", `${base}/publish`, { version: 2 });

    expect(archived.body.data.status).toBe("ARCHIVED");
    expect(edit.status).toBe(409);
    expect(publish.status).toBe(409);
    expect(
      await effects(world.organizationA, offering.offeringId, "catalog.offering.archived"),
    ).toEqual({ audits: 1, events: 1 });
  });

  it("answers 409 with the current version for a stale edit", async () => {
    const { world, offering } = await aDraft();
    const base = offeringsPath(world.organizationA, `/${offering.offeringId}`);
    await world.alice.call("patch", base, { description: "First", version: 1 });

    const stale = await world.alice.call("patch", base, { description: "Second", version: 1 });

    expect(stale.status).toBe(409);
    expect(stale.body.error.details).toMatchObject({ currentVersion: 2 });
  });

  it("fires priceChanged once when a variant price changes, and not for a rename", async () => {
    const { world, offering } = await aDraft();
    const base = offeringsPath(world.organizationA, `/${offering.offeringId}`);
    const [variant] = offering.variants;

    await world.alice.call("patch", base, { name: "Basmati rice", version: 1 });
    await world.alice.call("patch", base, {
      version: 2,
      variants: [{ variantId: variant.variantId, price: money(9500), unitKey: "PIECE" }],
    });

    expect(
      await countOutboxRows(harness.connections, {
        organizationId: world.organizationA,
        type: "catalog.offering.priceChanged",
        "payload.offeringId": offering.offeringId,
      }),
    ).toBe(1);
  });
});

describe("who may use the catalog", () => {
  it("lets a rider and a cashier read but not create", async () => {
    const world = await worldFor(harness, RETAIL);
    const rider = await memberWithRole(harness, world, SYSTEM_ROLE_KEY.RIDER);
    const cashier = await memberWithRole(harness, world, SYSTEM_ROLE_KEY.CASHIER);
    const path = offeringsPath(world.organizationA);

    expect((await rider.call("get", path)).status).toBe(200);
    for (const actor of [rider, cashier]) {
      const denied = await actor.call("post", path, {
        kind: "PRODUCT",
        name: "Rice",
        price: money(100),
      });
      expect(denied.status).toBe(403);
    }
  });

  it("answers 404 for another organization's offering on every route", async () => {
    const world = await worldFor(harness, RETAIL);
    const created = await world.alice.call("post", offeringsPath(world.organizationA), {
      kind: "PRODUCT",
      name: "Rice",
      price: money(100),
    });
    const base = offeringsPath(world.organizationB, `/${created.body.data.offeringId}`);

    const statuses = [
      (await world.bob.call("get", base)).status,
      (await world.bob.call("patch", base, { name: "x", version: 1 })).status,
      (await world.bob.call("post", `${base}/publish`, { version: 1 })).status,
      (await world.bob.call("post", `${base}/archive`, { version: 1 })).status,
    ];

    expect(statuses).toEqual([404, 404, 404, 404]);
  });
});
