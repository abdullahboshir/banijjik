import { PERMISSION_KEY, SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerIamApiModels, startIamApi } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import {
  countAuditRows,
  countOutboxRows,
  createCustomRoleAs,
  inviteEmailAs,
} from "../../../../test-support/organization-tenant-world.js";
import { addMemberWithAssignments, findSystemRoleId } from "../../../../test-support/rbac-world.js";
import {
  createTwoOrganizations,
  type ApiActor,
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

function locationsPath(organizationId: string, suffix = ""): string {
  return `/orgs/${organizationId}/locations${suffix}`;
}

/** Org B has only its default location, so a second one fits the BUNDLE trial limit of 2. */
async function addLocation(owner: ApiActor, organizationId: string, name: string) {
  return owner.call("post", locationsPath(organizationId), { name, locationType: "STORE" });
}

describe("GET /locations", () => {
  it("lists every location for the owner, default first by name", async () => {
    const world = await aWorld();

    const response = await world.alice.call("get", locationsPath(world.organizationA));

    expect(response.status).toBe(200);
    expect(response.body.data.map((row: { name: string }) => row.name)).toEqual(["A-L2", "Org A"]);
    expect(response.body.meta).toEqual({ page: 1, limit: 20, hasNext: false });
  });

  it("shows a member limited to one location only that location", async () => {
    const world = await aWorld();
    const viewerRoleId = await findSystemRoleId(
      harness.connections,
      world.organizationA,
      SYSTEM_ROLE_KEY.VIEWER,
    );
    const viewer = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: world.locationA1, roleId: viewerRoleId },
    ]);

    const response = await viewer.actor.call("get", locationsPath(world.organizationA));

    expect(response.body.data.map((row: { locationId: string }) => row.locationId)).toEqual([
      world.locationA1,
    ]);
  });

  it("refuses a staff member without the location read permission", async () => {
    const world = await aWorld();

    const response = await world.sam.call("get", locationsPath(world.organizationA));

    expect(response.status).toBe(403);
  });

  it("never shows the locations of another business", async () => {
    const world = await aWorld();

    const response = await world.bob.call("get", locationsPath(world.organizationB));

    expect(response.body.data.map((row: { locationId: string }) => row.locationId)).toEqual([
      world.locationB1,
    ]);
  });
});

describe("POST /locations", () => {
  it("creates a location with one audit entry and a created event", async () => {
    const world = await aWorld();

    const response = await world.bob.call("post", locationsPath(world.organizationB), {
      name: "Warehouse",
      locationType: "WAREHOUSE",
      phoneE164: "01712345678",
      address: { district: "Dhaka" },
    });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      name: "Warehouse",
      locationType: "WAREHOUSE",
      isDefault: false,
      status: "ACTIVE",
      phoneE164: "+8801712345678",
      address: { district: "Dhaka" },
      version: 1,
    });
    const filter = { organizationId: world.organizationB };
    expect(
      await countAuditRows(harness.connections, {
        ...filter,
        action: "organization.location.created",
        entityId: response.body.data.locationId,
      }),
    ).toBe(1);
    expect(
      await countOutboxRows(harness.connections, {
        ...filter,
        type: "organization.location.created",
        "payload.locationId": response.body.data.locationId,
      }),
    ).toBe(1);
  });

  it("refuses the third location of a BUNDLE trial with LIMIT_REACHED", async () => {
    const world = await aWorld();
    const second = await addLocation(world.bob, world.organizationB, "Second");

    const third = await addLocation(world.bob, world.organizationB, "Third");

    expect(second.status).toBe(201);
    expect(third.status).toBe(422);
    expect(third.body.error).toMatchObject({
      code: "LIMIT_REACHED",
      details: { limitKey: "locations", limit: 2 },
    });
  });

  it("accepts the name of an archived location again", async () => {
    const world = await aWorld();
    const first = await addLocation(world.bob, world.organizationB, "Shop 2");
    await world.bob.call(
      "post",
      locationsPath(world.organizationB, `/${first.body.data.locationId}/archive`),
      { version: 1 },
    );

    const again = await addLocation(world.bob, world.organizationB, "Shop 2");

    expect(again.status).toBe(201);
  });

  it.each([
    ["a location type that does not exist", { name: "X", locationType: "KIOSK" }],
    ["no name", { locationType: "STORE" }],
    ["an unknown timezone", { name: "X", locationType: "STORE", timezone: "Mars/Base" }],
    ["an organization id in the body", { name: "X", locationType: "STORE", organizationId: "1" }],
  ])("refuses %s with a validation error", async (_description, body) => {
    const world = await aWorld();

    const response = await world.bob.call("post", locationsPath(world.organizationB), body);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("refuses a manager of another role set: staff cannot create", async () => {
    const world = await aWorld();

    const response = await addLocation(world.sam, world.organizationA, "Nope");

    expect(response.status).toBe(403);
  });

  it("refuses a member who holds the create permission at one location only", async () => {
    const world = await aWorld();
    const roleId = await createCustomRoleAs(world.alice, {
      organizationId: world.organizationA,
      name: "Location helper",
      permissionKeys: [
        PERMISSION_KEY.ORGANIZATION_LOCATION_READ,
        PERMISSION_KEY.ORGANIZATION_LOCATION_CREATE,
      ],
    });
    const helper = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: world.locationA1, roleId },
    ]);

    const response = await addLocation(helper.actor, world.organizationA, "Not allowed");

    expect(response.status).toBe(403);
  });
});

describe("PATCH /locations/{locationId}", () => {
  it("renames a location and publishes an updated event", async () => {
    const world = await aWorld();

    const response = await world.alice.call(
      "patch",
      locationsPath(world.organizationA, `/${world.locationA2}`),
      { name: "Uttara branch", version: 1 },
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ name: "Uttara branch", version: 2 });
    expect(
      await countOutboxRows(harness.connections, {
        organizationId: world.organizationA,
        type: "organization.location.updated",
      }),
    ).toBe(1);
  });

  it("refuses a name that another ACTIVE location already has", async () => {
    const world = await aWorld();

    const response = await world.alice.call(
      "patch",
      locationsPath(world.organizationA, `/${world.locationA2}`),
      { name: "Org A", version: 1 },
    );

    expect(response.status).toBe(409);
    expect(response.body.error).toMatchObject({ code: "DUPLICATE", details: { field: "name" } });
  });

  it("refuses an empty change and an unknown field", async () => {
    const world = await aWorld();
    const path = locationsPath(world.organizationA, `/${world.locationA2}`);

    const empty = await world.alice.call("patch", path, { version: 1 });
    const unknown = await world.alice.call("patch", path, { isDefault: true, version: 1 });

    expect(empty.status).toBe(400);
    expect(unknown.status).toBe(400);
  });

  it("refuses staff", async () => {
    const world = await aWorld();

    const response = await world.sam.call(
      "patch",
      locationsPath(world.organizationA, `/${world.locationA1}`),
      { name: "Mine now", version: 1 },
    );

    expect(response.status).toBe(403);
  });

  it("answers 404 for a location of another business and leaves it untouched", async () => {
    const world = await aWorld();

    const response = await world.alice.call(
      "patch",
      locationsPath(world.organizationB, `/${world.locationB1}`),
      { name: "Hijacked", version: 1 },
    );
    const asAliceInOwnOrg = await world.alice.call(
      "patch",
      locationsPath(world.organizationA, `/${world.locationB1}`),
      { name: "Hijacked", version: 1 },
    );

    expect(response.status).toBe(404);
    expect(asAliceInOwnOrg.status).toBe(404);
    const bobs = await world.bob.call("get", locationsPath(world.organizationB));
    expect(bobs.body.data[0]).toMatchObject({ name: "Org B", version: 1 });
  });

  it("answers 409 with the current version when the version is stale", async () => {
    const world = await aWorld();
    const path = locationsPath(world.organizationA, `/${world.locationA2}`);
    await world.alice.call("patch", path, { name: "One", version: 1 });

    const response = await world.alice.call("patch", path, { name: "Two", version: 1 });

    expect(response.status).toBe(409);
    expect(response.body.error.details).toEqual({ currentVersion: 2 });
  });
});

describe("POST /locations/{locationId}/archive", () => {
  it("archives a location nobody uses", async () => {
    const world = await aWorld();

    const response = await world.alice.call(
      "post",
      locationsPath(world.organizationA, `/${world.locationA2}/archive`),
      { version: 1 },
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ status: "ARCHIVED", version: 2 });
    expect(
      await countOutboxRows(harness.connections, {
        organizationId: world.organizationA,
        type: "organization.location.archived",
      }),
    ).toBe(1);
  });

  it("refuses to archive the default location", async () => {
    const world = await aWorld();

    const response = await world.alice.call(
      "post",
      locationsPath(world.organizationA, `/${world.locationA1}/archive`),
      { version: 1 },
    );

    expect(response.status).toBe(422);
    expect(response.body.error.details).toEqual({ ruleKey: "LOCATION_IS_DEFAULT" });
  });

  it("refuses to archive a location while an active member is assigned to it", async () => {
    const world = await aWorld();
    const staffRoleId = await findSystemRoleId(harness.connections, world.organizationA);
    await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: world.locationA2, roleId: staffRoleId },
    ]);

    const response = await world.alice.call(
      "post",
      locationsPath(world.organizationA, `/${world.locationA2}/archive`),
      { version: 1 },
    );

    expect(response.status).toBe(422);
    expect(response.body.error.details).toEqual({ ruleKey: "LOCATION_IN_USE" });
  });

  it("refuses to archive a location while a pending invitation names it", async () => {
    const world = await aWorld();
    const staffRoleId = await findSystemRoleId(harness.connections, world.organizationA);
    await inviteEmailAs(world.alice, world.organizationA, {
      email: "pending@example.com",
      assignments: [{ locationId: world.locationA2, roleId: staffRoleId }],
    });

    const response = await world.alice.call(
      "post",
      locationsPath(world.organizationA, `/${world.locationA2}/archive`),
      { version: 1 },
    );

    expect(response.status).toBe(422);
    expect(response.body.error.details).toEqual({ ruleKey: "LOCATION_IN_USE" });
  });

  it("refuses staff, answers 404 across businesses and 409 for a stale version", async () => {
    const world = await aWorld();
    const own = locationsPath(world.organizationA, `/${world.locationA2}/archive`);

    const staff = await world.sam.call("post", own, { version: 1 });
    const foreign = await world.alice.call(
      "post",
      locationsPath(world.organizationB, `/${world.locationB1}/archive`),
      { version: 1 },
    );
    const stale = await world.alice.call("post", own, { version: 7 });

    expect(staff.status).toBe(403);
    expect(foreign.status).toBe(404);
    expect(stale.status).toBe(409);
    expect(stale.body.error.details).toEqual({ currentVersion: 1 });
  });
});
