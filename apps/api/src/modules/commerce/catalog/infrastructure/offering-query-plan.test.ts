import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  money,
  offeringsPath,
  startCatalogApi,
  worldFor,
} from "../../../../test-support/catalog-world.js";
import { registerIamApiModels } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import { buildOfferingFilter } from "./mongo-offering.repository.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };
let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startCatalogApi();
});

afterAll(async () => {
  await harness.dispose();
});

describe("the offering list queries", () => {
  it("use an index for every branch of the search and for the plain list, never a collection scan", async () => {
    const world = await worldFor(harness, RETAIL);
    await world.alice.call("post", offeringsPath(world.organizationA), {
      kind: "PRODUCT",
      name: "Rice",
      price: money(100),
    });
    const collection = harness.connections.tenantShared.collection("offerings");
    const filters = [
      buildOfferingFilter({
        statuses: ["DRAFT", "ACTIVE"],
        page: 1,
        limit: 20,
        search: { prefixes: ["bas", "rice"], exact: "bas" },
      }),
      buildOfferingFilter({ statuses: ["DRAFT", "ACTIVE"], page: 1, limit: 20 }),
      buildOfferingFilter({ statuses: ["ACTIVE"], kind: "PRODUCT", page: 1, limit: 20 }),
      buildOfferingFilter({
        statuses: ["ACTIVE"],
        categoryId: world.organizationA,
        page: 1,
        limit: 20,
      }),
    ];

    for (const filter of filters) {
      const plan = await collection
        .find({ organizationId: world.organizationA, ...filter })
        .sort({ updatedAt: -1, offeringId: 1 })
        .explain("queryPlanner");
      expect(JSON.stringify(plan.queryPlanner.winningPlan)).not.toContain("COLLSCAN");
    }
  });
});
