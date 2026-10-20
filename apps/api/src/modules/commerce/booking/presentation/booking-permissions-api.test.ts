import { SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  memberWithRole,
  startCatalogApi,
  worldFor,
} from "../../../../test-support/catalog-world.js";
import { registerIamApiModels } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";

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

describe("booking permissions", () => {
  it("denies booking create for a viewer", async () => {
    const world = await worldFor(harness, RETAIL, SALON);
    const viewer = await memberWithRole(harness, world, SYSTEM_ROLE_KEY.VIEWER);
    const denied = await viewer.call("post", `/orgs/${world.organizationA}/bookings`, {
      offeringId: "00000000-0000-7000-8000-000000000001",
      variantId: "00000000-0000-7000-8000-000000000002",
      locationId: world.locationA1,
      startsAt: "2026-11-01T04:00:00.000Z",
      contactId: "00000000-0000-7000-8000-000000000003",
    });
    expect(denied.status).toBe(403);
    expect(denied.body.error?.code).toBe("FORBIDDEN");
  });
});
