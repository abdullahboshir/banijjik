import { PACKAGE_KEY } from "@banijjik/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  money,
  offeringsPath,
  startCatalogApi,
  worldFor,
} from "../../../../test-support/catalog-world.js";
import { registerIamApiModels } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import type { TwoOrganizations } from "../../../../test-support/two-organizations.js";
import { PACKAGE_CATALOG_REFRESH_MILLISECONDS } from "../../../platform/entitlement/index.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };
const OFFERING_LIMIT = 2;
const MILLISECONDS_PER_SECOND = 1000;
let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startCatalogApi();
  // This file has its own database, so the BUNDLE package can be tightened for all its tests.
  await harness.connections.platform
    .collection("packages")
    .updateOne(
      { packageKey: PACKAGE_KEY.BUNDLE },
      { $set: { "limits.offerings": OFFERING_LIMIT }, $inc: { version: 1 } },
    );
  harness.clock.advanceSeconds(PACKAGE_CATALOG_REFRESH_MILLISECONDS / MILLISECONDS_PER_SECOND + 1);
});

afterAll(async () => {
  await harness.dispose();
});

function add(world: TwoOrganizations, name: string) {
  return world.alice.call("post", offeringsPath(world.organizationA), {
    kind: "PRODUCT",
    name,
    price: money(100),
  });
}

describe("the offering limit of the package", () => {
  it("refuses the offering past the limit with LIMIT_REACHED, naming the key and the limit", async () => {
    const world = await worldFor(harness, RETAIL);
    expect((await add(world, "One")).status).toBe(201);
    expect((await add(world, "Two")).status).toBe(201);

    const third = await add(world, "Three");

    expect(third.status).toBe(422);
    expect(third.body.error).toMatchObject({
      code: "LIMIT_REACHED",
      details: { limitKey: "offerings", limit: OFFERING_LIMIT },
    });
  });

  it("gives a place back when an offering is archived, so the next one fits", async () => {
    const world = await worldFor(harness, RETAIL);
    const one = await add(world, "One");
    await add(world, "Two");
    expect((await add(world, "Three")).status).toBe(422);

    await world.alice.call(
      "post",
      offeringsPath(world.organizationA, `/${one.body.data.offeringId}/archive`),
      { version: 1 },
    );
    const fits = await add(world, "Four");

    expect(fits.status).toBe(201);
  });

  it("counts each organization on its own", async () => {
    const world = await worldFor(harness, RETAIL);
    await add(world, "One");
    await add(world, "Two");

    const other = await world.bob.call("post", offeringsPath(world.organizationB), {
      kind: "PRODUCT",
      name: "Theirs",
      price: money(100),
    });

    expect(other.status).toBe(201);
  });

  it("lets only one of two concurrent creates through at the edge", async () => {
    const world = await worldFor(harness, RETAIL);
    await add(world, "One");

    const responses = await Promise.all([add(world, "Race A"), add(world, "Race B")]);

    expect(responses.map((response) => response.status).sort()).toEqual([201, 422]);
  });

  it("does not use up a place for a create that is refused", async () => {
    const world = await worldFor(harness, RETAIL);
    await add(world, "One");
    const refused = await world.alice.call("post", offeringsPath(world.organizationA), {
      kind: "SERVICE",
      name: "Haircut",
      price: money(100),
      unitKey: "SESSION",
    });

    const fits = await add(world, "Two");

    expect(refused.status).toBe(400);
    expect(fits.status).toBe(201);
  });
});
