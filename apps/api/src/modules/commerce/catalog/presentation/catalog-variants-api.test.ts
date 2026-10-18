import { SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  money,
  offeringsPath,
  startCatalogApi,
  worldFor,
} from "../../../../test-support/catalog-world.js";
import { registerIamApiModels } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import { addMemberWithAssignments, findSystemRoleId } from "../../../../test-support/rbac-world.js";
import type { TwoOrganizations } from "../../../../test-support/two-organizations.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };
let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startCatalogApi();
});

afterAll(async () => {
  await harness.dispose();
});

async function aShirt(world: TwoOrganizations) {
  const created = await world.alice.call("post", offeringsPath(world.organizationA), {
    kind: "PRODUCT",
    name: "T-shirt",
    variants: [
      { optionValues: { size: "M" }, price: money(45000), sku: "TS-M", unitKey: "PIECE" },
      { optionValues: { size: "L" }, price: money(45000), sku: "TS-L", unitKey: "PIECE" },
    ],
  });
  return created.body.data;
}

function pathOf(world: TwoOrganizations, offering: { offeringId: string }, suffix = ""): string {
  return offeringsPath(world.organizationA, `/${offering.offeringId}${suffix}`);
}

describe("updating the variants by the full list", () => {
  it("keeps the ids of the variants sent, adds a new one, and archives the one left out", async () => {
    const world = await worldFor(harness, RETAIL);
    const shirt = await aShirt(world);
    const [medium, large] = shirt.variants;

    const response = await world.alice.call("patch", pathOf(world, shirt), {
      version: 1,
      variants: [
        {
          variantId: medium.variantId,
          optionValues: { size: "M" },
          price: money(47000),
          sku: "TS-M",
          unitKey: "PIECE",
        },
        { optionValues: { size: "XL" }, price: money(50000), sku: "TS-XL", unitKey: "PIECE" },
      ],
    });

    expect(response.status).toBe(200);
    const byId = new Map(
      response.body.data.variants.map((variant: { variantId: string }) => [
        variant.variantId,
        variant,
      ]),
    );
    expect(byId.get(medium.variantId)).toMatchObject({ status: "ACTIVE", price: money(47000) });
    expect(byId.get(large.variantId)).toMatchObject({ status: "ARCHIVED", sku: "TS-L" });
    expect(response.body.data.variants).toHaveLength(3);
    const added = response.body.data.variants.find(
      (variant: { sku: string }) => variant.sku === "TS-XL",
    );
    expect(added.variantId).not.toBe(large.variantId);
    expect(added.status).toBe("ACTIVE");
  });

  it("never reuses or deletes a variant id: an archived one comes back only when its id is sent", async () => {
    const world = await worldFor(harness, RETAIL);
    const shirt = await aShirt(world);
    const [medium, large] = shirt.variants;
    await world.alice.call("patch", pathOf(world, shirt), {
      version: 1,
      variants: [
        {
          variantId: medium.variantId,
          optionValues: { size: "M" },
          price: money(1),
          unitKey: "PIECE",
        },
      ],
    });

    const restored = await world.alice.call("patch", pathOf(world, shirt), {
      version: 2,
      variants: [
        {
          variantId: medium.variantId,
          optionValues: { size: "M" },
          price: money(1),
          unitKey: "PIECE",
        },
        {
          variantId: large.variantId,
          optionValues: { size: "L" },
          price: money(2),
          unitKey: "PIECE",
        },
      ],
    });

    expect(restored.body.data.variants).toHaveLength(2);
    expect(
      restored.body.data.variants.find(
        (variant: { variantId: string }) => variant.variantId === large.variantId,
      ),
    ).toMatchObject({ status: "ACTIVE", price: money(2) });
  });

  it("refuses a variant id that does not belong to the offering, at its own path", async () => {
    const world = await worldFor(harness, RETAIL);
    const shirt = await aShirt(world);

    const response = await world.alice.call("patch", pathOf(world, shirt), {
      version: 1,
      variants: [
        { variantId: "0198aaaa-0000-7000-8000-000000000009", price: money(1), unitKey: "PIECE" },
      ],
    });

    expect(response.status).toBe(400);
    expect(response.body.error.details.fields).toContainEqual({
      path: "variants.0.variantId",
      messageKey: "errors.offering_variant_unknown",
    });
  });

  it("refuses a SKU that another offering holds when a variant is edited", async () => {
    const world = await worldFor(harness, RETAIL);
    const shirt = await aShirt(world);
    const other = await world.alice.call("post", offeringsPath(world.organizationA), {
      kind: "PRODUCT",
      name: "Cap",
      variants: [{ price: money(1), sku: "CAP-1", unitKey: "PIECE" }],
    });

    const response = await world.alice.call("patch", pathOf(world, shirt), {
      version: 1,
      variants: [
        {
          variantId: shirt.variants[0].variantId,
          optionValues: { size: "M" },
          price: money(1),
          sku: "CAP-1",
          unitKey: "PIECE",
        },
      ],
    });

    expect(response.status).toBe(409);
    expect(response.body.error.details.offeringId).toBe(other.body.data.offeringId);
  });

  it("refuses to change the kind and replaces kindDetails whole after checking them against the kind", async () => {
    const world = await worldFor(harness, RETAIL);
    const shirt = await aShirt(world);

    const kind = await world.alice.call("patch", pathOf(world, shirt), {
      kind: "SERVICE",
      version: 1,
    });
    const wrong = await world.alice.call("patch", pathOf(world, shirt), {
      version: 1,
      kindDetails: { durationMinutes: 30 },
    });
    const right = await world.alice.call("patch", pathOf(world, shirt), {
      version: 1,
      kindDetails: { requiresShipping: false, weightGrams: 300 },
    });

    expect(kind.status).toBe(400);
    expect(wrong.status).toBe(400);
    expect(right.body.data.kindDetails).toEqual({ requiresShipping: false, weightGrams: 300 });
  });
});

describe("per-location availability and price", () => {
  async function aManagerOfFirstLocation(world: TwoOrganizations) {
    const roleId = await findSystemRoleId(
      harness.connections,
      world.organizationA,
      SYSTEM_ROLE_KEY.MANAGER,
    );
    const added = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: world.locationA1, roleId },
    ]);
    return added.actor;
  }

  function locationPath(
    world: TwoOrganizations,
    offering: { offeringId: string },
    locationId: string,
  ) {
    return pathOf(world, offering, `/locations/${locationId}`);
  }

  it("turns a variant off and prices it for one location, and reads that back through ?location=", async () => {
    const world = await worldFor(harness, RETAIL);
    const shirt = await aShirt(world);
    const [medium, large] = shirt.variants;
    const put = (variantId: string, body: object) =>
      world.alice.call("put", locationPath(world, shirt, world.locationA2), { variantId, ...body });

    expect(
      (await put(medium.variantId, { isAvailable: true, priceOverride: money(40000) })).status,
    ).toBe(200);
    expect((await put(large.variantId, { isAvailable: false })).status).toBe(200);
    const atTwo = await world.alice.call(
      "get",
      `${offeringsPath(world.organizationA)}?location=${world.locationA2}`,
    );
    const atOne = await world.alice.call(
      "get",
      `${offeringsPath(world.organizationA)}?location=${world.locationA1}`,
    );

    expect(atTwo.body.data[0]).toMatchObject({ isAvailable: true, priceFrom: money(40000) });
    expect(atOne.body.data[0]).toMatchObject({ isAvailable: true, priceFrom: money(45000) });
  });

  it("marks an offering unavailable at a location when nothing there can be bought, and DELETE restores the defaults", async () => {
    const world = await worldFor(harness, RETAIL);
    const shirt = await aShirt(world);
    const listAtTwo = () =>
      world.alice.call("get", `${offeringsPath(world.organizationA)}?location=${world.locationA2}`);

    await world.alice.call("put", locationPath(world, shirt, world.locationA2), {
      isAvailable: false,
    });
    const off = await listAtTwo();
    const removed = await world.alice.call("delete", locationPath(world, shirt, world.locationA2));
    const back = await listAtTwo();

    expect(off.body.data[0].isAvailable).toBe(false);
    expect(removed.status).toBe(204);
    expect(back.body.data[0].isAvailable).toBe(true);
    expect(
      (await world.alice.call("delete", locationPath(world, shirt, world.locationA2))).status,
    ).toBe(404);
  });

  it("refuses a price override without a variant, and in another currency", async () => {
    const world = await worldFor(harness, RETAIL);
    const shirt = await aShirt(world);
    const path = locationPath(world, shirt, world.locationA1);

    const wide = await world.alice.call("put", path, {
      isAvailable: true,
      priceOverride: money(1),
    });
    const foreign = await world.alice.call("put", path, {
      variantId: shirt.variants[0].variantId,
      isAvailable: true,
      priceOverride: { amount: 1, currency: "USD" },
    });

    expect(wide.status).toBe(400);
    expect(foreign.status).toBe(400);
  });

  it("refuses a location outside the caller's reach with 403, for a write and for the list filter", async () => {
    const world = await worldFor(harness, RETAIL);
    const shirt = await aShirt(world);
    const manager = await aManagerOfFirstLocation(world);

    const write = await manager.call("put", locationPath(world, shirt, world.locationA2), {
      isAvailable: false,
    });
    const read = await manager.call(
      "get",
      `${offeringsPath(world.organizationA)}?location=${world.locationA2}`,
    );
    const own = await manager.call("put", locationPath(world, shirt, world.locationA1), {
      isAvailable: false,
    });

    expect(write.status).toBe(403);
    expect(write.body.error.code).toBe("LOCATION_FORBIDDEN");
    expect(read.status).toBe(403);
    expect(own.status).toBe(200);
  });

  it("writes one audit entry per change and fires priceChanged only for a price", async () => {
    const world = await worldFor(harness, RETAIL);
    const shirt = await aShirt(world);
    const path = locationPath(world, shirt, world.locationA1);

    await world.alice.call("put", path, { isAvailable: false });
    await world.alice.call("put", path, {
      variantId: shirt.variants[0].variantId,
      isAvailable: true,
      priceOverride: money(100),
    });

    const audits = await harness.connections.tenantShared.collection("audit_logs").countDocuments({
      organizationId: world.organizationA,
      action: "catalog.availability.changed",
    });
    const events = await harness.connections.platform.collection("outbox_events").countDocuments({
      organizationId: world.organizationA,
      type: "catalog.offering.priceChanged",
      "payload.offeringId": shirt.offeringId,
    });
    expect(audits).toBe(2);
    expect(events).toBe(1);
  });
});
