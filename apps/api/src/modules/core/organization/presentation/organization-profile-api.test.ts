import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerIamApiModels, startIamApi } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import {
  countAuditRows,
  countOutboxRows,
} from "../../../../test-support/organization-tenant-world.js";
import {
  createTwoOrganizations,
  type TwoOrganizations,
} from "../../../../test-support/two-organizations.js";

registerIamApiModels();

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startIamApi();
});

afterAll(async () => {
  await harness.dispose();
});

function aWorld(): Promise<TwoOrganizations> {
  return createTwoOrganizations(harness.app, harness.connections, {
    industryTemplateKey: "RETAIL",
  });
}

describe("GET /profile", () => {
  it("shows the business profile to any active member, with no permission key", async () => {
    const world = await aWorld();

    const owner = await world.alice.call("get", `/orgs/${world.organizationA}/profile`);
    const staff = await world.sam.call("get", `/orgs/${world.organizationA}/profile`);

    expect(owner.status).toBe(200);
    expect(owner.body.data).toMatchObject({
      organizationId: world.organizationA,
      name: "Org A",
      timezone: "Asia/Dhaka",
      currencyCode: "BDT",
      profile: {},
      version: 1,
    });
    expect(staff.status).toBe(200);
  });

  it("answers 404 for the profile of another business", async () => {
    const world = await aWorld();

    const response = await world.alice.call("get", `/orgs/${world.organizationB}/profile`);

    expect(response.status).toBe(404);
  });
});

describe("PATCH /profile", () => {
  it("renames the business and saves the profile, with one audit entry and a renamed event", async () => {
    const world = await aWorld();

    const response = await world.alice.call("patch", `/orgs/${world.organizationA}/profile`, {
      name: "Rahim Traders",
      profile: { legalName: "Rahim Traders Ltd", phoneE164: "01712345678" },
      version: 1,
    });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      name: "Rahim Traders",
      profile: { legalName: "Rahim Traders Ltd", phoneE164: "+8801712345678" },
      version: 2,
    });
    const filter = { organizationId: world.organizationA };
    expect(
      await countAuditRows(harness.connections, {
        ...filter,
        action: "organization.organization.updated",
      }),
    ).toBe(1);
    expect(
      await countOutboxRows(harness.connections, {
        ...filter,
        type: "organization.organization.renamed",
      }),
    ).toBe(1);
  });

  it("keeps the other profile fields when only some are sent", async () => {
    const world = await aWorld();
    await world.alice.call("patch", `/orgs/${world.organizationA}/profile`, {
      profile: { legalName: "Legal", tradeLicenseNumber: "TL-1" },
      version: 1,
    });

    const response = await world.alice.call("patch", `/orgs/${world.organizationA}/profile`, {
      profile: { email: "Shop@Example.com" },
      version: 2,
    });

    expect(response.body.data.profile).toEqual({
      legalName: "Legal",
      tradeLicenseNumber: "TL-1",
      email: "shop@example.com",
    });
  });

  it("does not publish a renamed event when the name did not change", async () => {
    const world = await aWorld();

    await world.alice.call("patch", `/orgs/${world.organizationA}/profile`, {
      profile: { legalName: "Only legal" },
      version: 1,
    });

    expect(
      await countOutboxRows(harness.connections, {
        organizationId: world.organizationA,
        type: "organization.organization.renamed",
      }),
    ).toBe(0);
  });

  it.each([
    ["a field that is not editable here", { slug: "new-slug", version: 1 }],
    ["no version", { name: "New name" }],
    ["an empty change", { version: 1 }],
    ["a name that is too short", { name: "a", version: 1 }],
  ])("refuses %s with a validation error", async (_description, body) => {
    const world = await aWorld();

    const response = await world.alice.call("patch", `/orgs/${world.organizationA}/profile`, body);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("refuses a staff member who lacks the profile permission", async () => {
    const world = await aWorld();

    const response = await world.sam.call("patch", `/orgs/${world.organizationA}/profile`, {
      name: "Hijacked",
      version: 1,
    });

    expect(response.status).toBe(403);
  });

  it("answers 404 for another business and leaves its profile untouched", async () => {
    const world = await aWorld();

    const response = await world.alice.call("patch", `/orgs/${world.organizationB}/profile`, {
      name: "Hijacked",
      version: 1,
    });

    expect(response.status).toBe(404);
    const untouched = await world.bob.call("get", `/orgs/${world.organizationB}/profile`);
    expect(untouched.body.data).toMatchObject({ name: "Org B", version: 1 });
  });

  it("answers 409 with the current version when the version is stale", async () => {
    const world = await aWorld();
    await world.alice.call("patch", `/orgs/${world.organizationA}/profile`, {
      name: "First rename",
      version: 1,
    });

    const response = await world.alice.call("patch", `/orgs/${world.organizationA}/profile`, {
      name: "Second rename",
      version: 1,
    });

    expect(response.status).toBe(409);
    expect(response.body.error.details).toEqual({ currentVersion: 2 });
  });
});
