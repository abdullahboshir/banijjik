import {
  ALL_LOCATIONS,
  PERMISSION_KEY,
  SYSTEM_ROLE_KEY,
  type SystemRoleKey,
} from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerIamApiModels, startIamApi } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import {
  countAuditRows,
  countOutboxRows,
  createCustomRoleAs,
} from "../../../../test-support/organization-tenant-world.js";
import { addMemberWithAssignments, findSystemRoleId } from "../../../../test-support/rbac-world.js";
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

function membersPath(organizationId: string, suffix = ""): string {
  return `/orgs/${organizationId}/members${suffix}`;
}

function roleId(organizationId: string, roleKey: SystemRoleKey): Promise<string> {
  return findSystemRoleId(harness.connections, organizationId, roleKey);
}

/** A manager at every location, who is not the owner. */
async function addManager(world: TwoOrganizations) {
  const manager = await roleId(world.organizationA, SYSTEM_ROLE_KEY.MANAGER);
  return addMemberWithAssignments(harness.app, world.organizationA, [
    { locationId: ALL_LOCATIONS, roleId: manager },
  ]);
}

async function ownerMemberId(world: TwoOrganizations): Promise<string> {
  const list = await world.alice.call("get", membersPath(world.organizationA));
  const owner = list.body.data.find((row: { userId: string }) => row.userId === world.alice.userId);
  return owner.memberId as string;
}

describe("GET /members", () => {
  it("lists the staff of the business with their assignments, sorted by name", async () => {
    const world = await aWorld();

    const response = await world.alice.call("get", membersPath(world.organizationA));

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.data[0]).toMatchObject({ status: "ACTIVE", version: 1 });
    expect(response.body.data[0].assignments[0]).toHaveProperty("roleId");
    expect(response.body.meta).toEqual({ page: 1, limit: 20, hasNext: false });
  });

  it("filters by status and by a part of the display name", async () => {
    const world = await aWorld();
    await world.alice.call(
      "post",
      membersPath(world.organizationA, `/${world.samMemberId}/suspend`),
      {
        version: 1,
      },
    );

    const suspended = await world.alice.call(
      "get",
      `${membersPath(world.organizationA)}?status=SUSPENDED`,
    );
    const byName = await world.alice.call("get", `${membersPath(world.organizationA)}?q=sa`);

    expect(suspended.body.data.map((row: { memberId: string }) => row.memberId)).toEqual([
      world.samMemberId,
    ]);
    expect(byName.body.data.map((row: { displayName: string }) => row.displayName)).toEqual([
      "Sam",
    ]);
  });

  it("refuses a limit above 100 and staff without the read permission", async () => {
    const world = await aWorld();

    const tooMany = await world.alice.call("get", `${membersPath(world.organizationA)}?limit=101`);
    const staff = await world.sam.call("get", membersPath(world.organizationA));

    expect(tooMany.status).toBe(400);
    expect(staff.status).toBe(403);
  });

  it("never lists the members of another business", async () => {
    const world = await aWorld();

    const response = await world.bob.call("get", membersPath(world.organizationB));

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].userId).toBe(world.bob.userId);
  });
});

describe("GET /members/{memberId}", () => {
  it("shows one member and answers 404 for a member of another business", async () => {
    const world = await aWorld();

    const own = await world.alice.call(
      "get",
      membersPath(world.organizationA, `/${world.samMemberId}`),
    );
    const foreign = await world.bob.call(
      "get",
      membersPath(world.organizationB, `/${world.samMemberId}`),
    );

    expect(own.status).toBe(200);
    expect(own.body.data.displayName).toBe("Sam");
    expect(foreign.status).toBe(404);
  });
});

describe("PATCH /members/{memberId}", () => {
  it("changes the display name and job title without publishing an assignments event", async () => {
    const world = await aWorld();

    const response = await world.alice.call(
      "patch",
      membersPath(world.organizationA, `/${world.samMemberId}`),
      {
        displayName: "Samir",
        jobTitle: "Shop assistant",
        version: 1,
      },
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      displayName: "Samir",
      jobTitle: "Shop assistant",
      version: 2,
    });
    const filter = { organizationId: world.organizationA, entityId: world.samMemberId };
    expect(
      await countAuditRows(harness.connections, {
        ...filter,
        action: "organization.member.updated",
      }),
    ).toBe(1);
    expect(
      await countOutboxRows(harness.connections, {
        organizationId: world.organizationA,
        type: "organization.member.assignmentsChanged",
      }),
    ).toBe(0);
  });

  it("applies new assignments to the very next request of that member", async () => {
    const world = await aWorld();
    const roles = () => world.sam.call("get", `/orgs/${world.organizationA}/roles`);
    const before = await roles();
    const manager = await roleId(world.organizationA, SYSTEM_ROLE_KEY.MANAGER);

    const response = await world.alice.call(
      "patch",
      membersPath(world.organizationA, `/${world.samMemberId}`),
      {
        assignments: [{ locationId: world.locationA1, roleId: manager }],
        version: 1,
      },
    );
    const after = await roles();

    expect(before.status).toBe(403);
    expect(response.status).toBe(200);
    expect(response.body.data.version).toBe(2);
    expect(after.status).toBe(200);
    expect(
      await countOutboxRows(harness.connections, {
        organizationId: world.organizationA,
        type: "organization.member.assignmentsChanged",
      }),
    ).toBe(1);
  });

  interface BodyContext {
    readonly staff: string;
    readonly location: string;
  }

  it.each([
    ["no change at all", () => ({ version: 1 })],
    ["an empty assignment list", () => ({ assignments: [], version: 1 })],
    [
      "a location that does not exist",
      ({ staff }: BodyContext) => ({
        assignments: [{ locationId: newId(), roleId: staff }],
        version: 1,
      }),
    ],
    [
      "the same location twice",
      ({ staff, location }: BodyContext) => ({
        assignments: [
          { locationId: location, roleId: staff },
          { locationId: location, roleId: staff },
        ],
        version: 1,
      }),
    ],
    [
      "ALL next to a specific location",
      ({ staff, location }: BodyContext) => ({
        assignments: [
          { locationId: ALL_LOCATIONS, roleId: staff },
          { locationId: location, roleId: staff },
        ],
        version: 1,
      }),
    ],
  ])("refuses %s with a validation error", async (_description, makeBody) => {
    const world = await aWorld();
    const staff = await roleId(world.organizationA, SYSTEM_ROLE_KEY.STAFF);

    const response = await world.alice.call(
      "patch",
      membersPath(world.organizationA, `/${world.samMemberId}`),
      makeBody({ staff, location: world.locationA1 }),
    );

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("refuses staff, answers 404 across businesses and 409 for a stale version", async () => {
    const world = await aWorld();
    const path = membersPath(world.organizationA, `/${world.samMemberId}`);

    const staff = await world.sam.call("patch", path, { displayName: "Boss", version: 1 });
    const foreign = await world.bob.call(
      "patch",
      membersPath(world.organizationB, `/${world.samMemberId}`),
      {
        displayName: "Boss",
        version: 1,
      },
    );
    const stale = await world.alice.call("patch", path, { displayName: "Boss", version: 5 });

    expect(staff.status).toBe(403);
    expect(foreign.status).toBe(404);
    expect(stale.status).toBe(409);
    expect(stale.body.error.details).toEqual({ currentVersion: 1 });
  });
});

describe("assignment rules", () => {
  it("never lets the owner role be assigned", async () => {
    const world = await aWorld();
    const owner = await roleId(world.organizationA, SYSTEM_ROLE_KEY.OWNER);

    const response = await world.alice.call(
      "patch",
      membersPath(world.organizationA, `/${world.samMemberId}`),
      {
        assignments: [{ locationId: world.locationA1, roleId: owner }],
        version: 1,
      },
    );

    expect(response.status).toBe(422);
    expect(response.body.error.details).toMatchObject({ ruleKey: "ROLE_NOT_GRANTABLE" });
  });

  it("refuses an archived role and a role of another business", async () => {
    const world = await aWorld();
    const roleToArchive = await createCustomRoleAs(world.alice, {
      organizationId: world.organizationA,
      name: "Old role",
      permissionKeys: [PERMISSION_KEY.ORGANIZATION_MEMBER_READ],
    });
    await world.alice.call("post", `/orgs/${world.organizationA}/roles/${roleToArchive}/archive`, {
      version: 1,
    });
    const foreignRole = await roleId(world.organizationB, SYSTEM_ROLE_KEY.STAFF);
    const path = membersPath(world.organizationA, `/${world.samMemberId}`);

    const archived = await world.alice.call("patch", path, {
      assignments: [{ locationId: world.locationA1, roleId: roleToArchive }],
      version: 1,
    });
    const foreign = await world.alice.call("patch", path, {
      assignments: [{ locationId: world.locationA1, roleId: foreignRole }],
      version: 1,
    });

    expect(archived.status).toBe(422);
    expect(foreign.status).toBe(422);
    expect(foreign.body.error.details).toMatchObject({ ruleKey: "ROLE_NOT_GRANTABLE" });
  });

  it("does not let a member change their own assignments, but lets them rename themselves", async () => {
    const world = await aWorld();
    const manager = await addManager(world);
    const staff = await roleId(world.organizationA, SYSTEM_ROLE_KEY.STAFF);
    const path = membersPath(world.organizationA, `/${manager.memberId}`);

    const assignments = await manager.actor.call("patch", path, {
      assignments: [{ locationId: ALL_LOCATIONS, roleId: staff }],
      version: 1,
    });
    const rename = await manager.actor.call("patch", path, { displayName: "Mia", version: 1 });

    expect(assignments.status).toBe(422);
    expect(assignments.body.error.details).toEqual({ ruleKey: "CANNOT_CHANGE_SELF" });
    expect(rename.status).toBe(200);
  });

  it("protects the owner member from edits, suspension and removal by anyone else", async () => {
    const world = await aWorld();
    const manager = await addManager(world);
    const ownerId = await ownerMemberId(world);
    const path = membersPath(world.organizationA, `/${ownerId}`);
    const staff = await roleId(world.organizationA, SYSTEM_ROLE_KEY.STAFF);

    const edit = await manager.actor.call("patch", path, { displayName: "Taken over", version: 1 });
    const demote = await manager.actor.call("patch", path, {
      assignments: [{ locationId: ALL_LOCATIONS, roleId: staff }],
      version: 1,
    });
    const suspend = await manager.actor.call("post", `${path}/suspend`, { version: 1 });
    const remove = await manager.actor.call("post", `${path}/remove`, { version: 1 });
    const bySelf = await world.alice.call("post", `${path}/suspend`, { version: 1 });

    for (const response of [edit, demote, suspend, remove, bySelf]) {
      expect(response.status).toBe(422);
      expect(response.body.error.details).toEqual({ ruleKey: "OWNER_IS_PROTECTED" });
    }
  });
});

describe("suspend, reactivate and remove", () => {
  it("takes access away on the very next request and gives it back on reactivation", async () => {
    const world = await aWorld();
    const ownProfile = `/orgs/${world.organizationA}/profile`;
    const base = membersPath(world.organizationA, `/${world.samMemberId}`);

    const suspended = await world.alice.call("post", `${base}/suspend`, { version: 1 });
    const whileSuspended = await world.sam.call("get", ownProfile);
    const reactivated = await world.alice.call("post", `${base}/reactivate`, { version: 2 });
    const afterwards = await world.sam.call("get", ownProfile);

    expect(suspended.body.data).toMatchObject({ status: "SUSPENDED", version: 2 });
    expect(whileSuspended.status).toBe(404);
    expect(reactivated.body.data).toMatchObject({ status: "ACTIVE", version: 3 });
    expect(afterwards.status).toBe(200);
  });

  it("removes a member but keeps the record, and the member loses access", async () => {
    const world = await aWorld();
    const base = membersPath(world.organizationA, `/${world.samMemberId}`);

    const removed = await world.alice.call("post", `${base}/remove`, { version: 1 });
    const access = await world.sam.call("get", `/orgs/${world.organizationA}/profile`);
    const kept = await world.alice.call("get", base);

    expect(removed.body.data.status).toBe("REMOVED");
    expect(access.status).toBe(404);
    expect(kept.body.data.status).toBe("REMOVED");
    const filter = { organizationId: world.organizationA, entityId: world.samMemberId };
    expect(
      await countAuditRows(harness.connections, {
        ...filter,
        action: "organization.member.removed",
      }),
    ).toBe(1);
    expect(
      await countOutboxRows(harness.connections, {
        organizationId: world.organizationA,
        type: "organization.member.removed",
      }),
    ).toBe(1);
  });

  it("refuses a transition that is not allowed from the current status", async () => {
    const world = await aWorld();
    const base = membersPath(world.organizationA, `/${world.samMemberId}`);

    const reactivateActive = await world.alice.call("post", `${base}/reactivate`, { version: 1 });
    await world.alice.call("post", `${base}/remove`, { version: 1 });
    const suspendRemoved = await world.alice.call("post", `${base}/suspend`, { version: 2 });

    expect(reactivateActive.status).toBe(409);
    expect(reactivateActive.body.error).toMatchObject({
      code: "INVALID_TRANSITION",
      details: { currentStatus: "ACTIVE" },
    });
    expect(suspendRemoved.status).toBe(409);
  });

  it("needs the remove permission to remove, stays 404 across businesses and 409 when stale", async () => {
    const world = await aWorld();
    const updater = await createCustomRoleAs(world.alice, {
      organizationId: world.organizationA,
      name: "Updater",
      permissionKeys: [
        PERMISSION_KEY.ORGANIZATION_MEMBER_READ,
        PERMISSION_KEY.ORGANIZATION_MEMBER_UPDATE,
      ],
    });
    const helper = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: ALL_LOCATIONS, roleId: updater },
    ]);
    const base = membersPath(world.organizationA, `/${world.samMemberId}`);

    const denied = await helper.actor.call("post", `${base}/remove`, { version: 1 });
    const foreign = await world.alice.call(
      "post",
      membersPath(world.organizationB, `/${world.samMemberId}/remove`),
      {
        version: 1,
      },
    );
    const stale = await world.alice.call("post", `${base}/suspend`, { version: 9 });

    expect(denied.status).toBe(403);
    expect(foreign.status).toBe(404);
    expect(stale.status).toBe(409);
  });
});
