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
const PAGE_LIMIT_TOO_BIG = 101;
let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startCatalogApi();
});

afterAll(async () => {
  await harness.dispose();
});

async function aShirtWithBranchRows(world: TwoOrganizations) {
  const created = await world.alice.call("post", offeringsPath(world.organizationA), {
    kind: "PRODUCT",
    name: "T-shirt",
    variants: [
      { optionValues: { size: "M" }, price: money(45000), unitKey: "PIECE" },
      { optionValues: { size: "L" }, price: money(45000), unitKey: "PIECE" },
    ],
  });
  const shirt = created.body.data;
  const put = (locationId: string, body: object) =>
    world.alice.call(
      "put",
      offeringsPath(world.organizationA, `/${shirt.offeringId}/locations/${locationId}`),
      body,
    );
  await put(world.locationA1, { isAvailable: false });
  await put(world.locationA1, {
    variantId: shirt.variants[0].variantId,
    isAvailable: true,
    priceOverride: money(40000),
  });
  await put(world.locationA2, { variantId: shirt.variants[1].variantId, isAvailable: false });
  return shirt;
}

function rowsPath(world: TwoOrganizations, offeringId: string, query = ""): string {
  return offeringsPath(world.organizationA, `/${offeringId}/locations${query}`);
}

describe("reading the branch rows of one offering", () => {
  it("lists the offering-wide and the per-variant rows, and one location when asked", async () => {
    const world = await worldFor(harness, RETAIL);
    const shirt = await aShirtWithBranchRows(world);

    const all = await world.alice.call("get", rowsPath(world, shirt.offeringId));
    const atOne = await world.alice.call(
      "get",
      rowsPath(world, shirt.offeringId, `?locationId=${world.locationA1}`),
    );

    expect(all.status).toBe(200);
    expect(all.body.data).toHaveLength(3);
    expect(atOne.body.data).toHaveLength(2);
    expect(atOne.body.data).toContainEqual({
      offeringId: shirt.offeringId,
      variantId: null,
      locationId: world.locationA1,
      isAvailable: false,
      priceOverride: null,
    });
    expect(atOne.body.data).toContainEqual({
      offeringId: shirt.offeringId,
      variantId: shirt.variants[0].variantId,
      locationId: world.locationA1,
      isAvailable: true,
      priceOverride: money(40000),
    });
  });

  it("is not found for an offering of another organization", async () => {
    const world = await worldFor(harness, RETAIL);
    const shirt = await aShirtWithBranchRows(world);

    const response = await world.bob.call(
      "get",
      offeringsPath(world.organizationB, `/${shirt.offeringId}/locations`),
    );

    expect(response.status).toBe(404);
  });

  it("hides the rows of a location the caller does not reach, and refuses to name one", async () => {
    const world = await worldFor(harness, RETAIL);
    const shirt = await aShirtWithBranchRows(world);
    const roleId = await findSystemRoleId(
      harness.connections,
      world.organizationA,
      SYSTEM_ROLE_KEY.MANAGER,
    );
    const { actor: manager } = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: world.locationA1, roleId },
    ]);

    const visible = await manager.call("get", rowsPath(world, shirt.offeringId));
    const named = await manager.call(
      "get",
      rowsPath(world, shirt.offeringId, `?locationId=${world.locationA2}`),
    );

    expect(visible.body.data.map((row: { locationId: string }) => row.locationId)).toEqual([
      world.locationA1,
      world.locationA1,
    ]);
    expect(named.status).toBe(403);
    expect(named.body.error.code).toBe("LOCATION_FORBIDDEN");
  });

  it("pages the rows and refuses a limit above 100", async () => {
    const world = await worldFor(harness, RETAIL);
    const shirt = await aShirtWithBranchRows(world);

    const first = await world.alice.call("get", rowsPath(world, shirt.offeringId, "?limit=2"));
    const second = await world.alice.call(
      "get",
      rowsPath(world, shirt.offeringId, "?limit=2&page=2"),
    );
    const tooBig = await world.alice.call(
      "get",
      rowsPath(world, shirt.offeringId, `?limit=${PAGE_LIMIT_TOO_BIG}`),
    );

    expect(first.body.data).toHaveLength(2);
    expect(first.body.meta).toMatchObject({ page: 1, limit: 2, hasNext: true });
    expect(second.body.data).toHaveLength(1);
    expect(second.body.meta.hasNext).toBe(false);
    expect(tooBig.status).toBe(400);
  });
});
