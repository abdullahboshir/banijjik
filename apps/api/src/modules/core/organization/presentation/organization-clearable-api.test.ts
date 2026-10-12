import { AUDIT_ACTION } from "@banijjik/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerIamApiModels, startIamApi } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
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

const ADDRESS = { line1: "12 Station Road", district: "Dhaka" };

/** Newest first by insertion order: the test clock gives several entries the same createdAt. */
async function latestAuditChanges(action: string, entityId: string) {
  const row = await harness.connections.tenantShared
    .collection("audit_logs")
    .find({ action, entityId })
    .sort({ _id: -1 })
    .limit(1)
    .next();
  return row?.["changes"];
}

describe("PATCH /profile clears optional fields with null", () => {
  it("sets a field, clears it with null, and reads it back absent while the others stay", async () => {
    const world = await aWorld();
    const path = `/orgs/${world.organizationA}/profile`;
    await world.alice.call("patch", path, {
      profile: { legalName: "Rahim Traders Ltd", phoneE164: "01712345678", address: ADDRESS },
      version: 1,
    });

    const cleared = await world.alice.call("patch", path, {
      profile: { legalName: null, address: null },
      version: 2,
    });
    const readBack = await world.alice.call("get", path);

    expect(cleared.status).toBe(200);
    expect(readBack.body.data.profile).toEqual({ phoneE164: "+8801712345678" });
    expect(readBack.body.data.version).toBe(3);
  });

  it("leaves a field alone when its key is absent", async () => {
    const world = await aWorld();
    const path = `/orgs/${world.organizationA}/profile`;
    await world.alice.call("patch", path, {
      profile: { legalName: "Rahim Traders Ltd", legalType: "Partnership" },
      version: 1,
    });

    await world.alice.call("patch", path, { profile: { legalType: null }, version: 2 });
    const readBack = await world.alice.call("get", path);

    expect(readBack.body.data.profile).toEqual({ legalName: "Rahim Traders Ltd" });
  });

  it("refuses null on the name and the default language with 400", async () => {
    const world = await aWorld();
    const path = `/orgs/${world.organizationA}/profile`;

    const name = await world.alice.call("patch", path, { name: null, version: 1 });
    const locale = await world.alice.call("patch", path, { defaultLocale: null, version: 1 });

    expect(name.status).toBe(400);
    expect(locale.status).toBe(400);
  });

  it("shows the clearing in the audit entry as to: null", async () => {
    const world = await aWorld();
    const path = `/orgs/${world.organizationA}/profile`;
    await world.alice.call("patch", path, {
      profile: { legalName: "Rahim Traders Ltd" },
      version: 1,
    });

    await world.alice.call("patch", path, { profile: { legalName: null }, version: 2 });

    expect(
      await latestAuditChanges(AUDIT_ACTION.ORGANIZATION_UPDATED, world.organizationA),
    ).toEqual({ "profile.legalName": { from: "Rahim Traders Ltd", to: null } });
  });
});

describe("PATCH /locations/{locationId} clears optional fields with null", () => {
  /** The second location of the world (version 1) filled with every optional field: version 2 now. */
  async function aFilledLocation(world: TwoOrganizations): Promise<string> {
    const filled = await world.alice.call(
      "patch",
      `/orgs/${world.organizationA}/locations/${world.locationA2}`,
      {
        name: "Mirpur Shop",
        address: ADDRESS,
        phoneE164: "01712345678",
        timezone: "Asia/Dhaka",
        version: 1,
      },
    );
    expect(filled.status).toBe(200);
    return world.locationA2;
  }

  it("clears the address, phone and timezone, reads them back absent, and keeps the name", async () => {
    const world = await aWorld();
    const locationId = await aFilledLocation(world);
    const path = `/orgs/${world.organizationA}/locations/${locationId}`;

    const cleared = await world.alice.call("patch", path, {
      address: null,
      phoneE164: null,
      timezone: null,
      version: 2,
    });
    const list = await world.alice.call("get", `/orgs/${world.organizationA}/locations`);

    const location = list.body.data.find(
      (row: { locationId: string }) => row.locationId === locationId,
    );
    expect(cleared.status).toBe(200);
    expect(location).toMatchObject({ name: "Mirpur Shop", version: 3 });
    for (const field of ["address", "phoneE164", "timezone"])
      expect(location).not.toHaveProperty(field);
  });

  it("leaves a field alone when its key is absent", async () => {
    const world = await aWorld();
    const locationId = await aFilledLocation(world);
    const path = `/orgs/${world.organizationA}/locations/${locationId}`;

    const cleared = await world.alice.call("patch", path, { phoneE164: null, version: 2 });

    expect(cleared.body.data).toMatchObject({ address: ADDRESS, timezone: "Asia/Dhaka" });
    expect(cleared.body.data).not.toHaveProperty("phoneE164");
  });

  it("refuses null on the name and the type with 400", async () => {
    const world = await aWorld();
    const locationId = await aFilledLocation(world);
    const path = `/orgs/${world.organizationA}/locations/${locationId}`;

    const name = await world.alice.call("patch", path, { name: null, version: 2 });
    const type = await world.alice.call("patch", path, { locationType: null, version: 2 });

    expect(name.status).toBe(400);
    expect(type.status).toBe(400);
  });

  it("shows the clearing in the audit entry as to: null", async () => {
    const world = await aWorld();
    const locationId = await aFilledLocation(world);
    const path = `/orgs/${world.organizationA}/locations/${locationId}`;

    await world.alice.call("patch", path, { phoneE164: null, version: 2 });

    expect(await latestAuditChanges(AUDIT_ACTION.LOCATION_UPDATED, locationId)).toEqual({
      phoneE164: { from: "+8801712345678", to: null },
    });
  });
});
