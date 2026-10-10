import { PERMISSION_KEY } from "@banijjik/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerIamApiModels, startIamApi } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import {
  addMemberWithAssignments,
  findSystemRoleId,
  reassignMember,
} from "../../../../test-support/rbac-world.js";
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

async function createRole(world: TwoOrganizations, permissionKeys: string[]) {
  const created = await world.alice.call("post", `/orgs/${world.organizationA}/roles`, {
    name: `Role ${permissionKeys.length}`,
    permissionKeys,
  });
  return created.body.data as { roleId: string; version: number };
}

describe("permission cache invalidation", () => {
  it("denies the very next request after a key is removed from the role", async () => {
    const world = await aWorld();
    const role = await createRole(world, [PERMISSION_KEY.IAM_ROLE_READ]);
    const holder = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: "ALL", roleId: role.roleId },
    ]);
    const rolesPath = `/orgs/${world.organizationA}/roles`;
    const before = await holder.actor.call("get", rolesPath);

    await world.alice.call("patch", `${rolesPath}/${role.roleId}`, {
      permissionKeys: [],
      version: role.version,
    });
    const after = await holder.actor.call("get", rolesPath);

    expect(before.status).toBe(200);
    expect(after.status).toBe(403);
  });

  it("bumps the roles version of the organization with every role change", async () => {
    const world = await aWorld();
    const organizations = harness.connections.platform.collection("organizations");
    const read = async () =>
      (await organizations.findOne({ organizationId: world.organizationA }))?.["rolesVersion"];
    const initial = await read();

    const role = await createRole(world, []);
    const afterCreate = await read();
    await world.alice.call("post", `/orgs/${world.organizationA}/roles/${role.roleId}/archive`, {
      version: role.version,
    });
    const afterArchive = await read();

    expect(initial).toBe(1);
    expect(afterCreate).toBe(2);
    expect(afterArchive).toBe(3);
  });

  it("does not bump the roles version when the change is refused", async () => {
    const world = await aWorld();
    const organizations = harness.connections.platform.collection("organizations");

    await world.alice.call("post", `/orgs/${world.organizationA}/roles`, {
      name: "Bad",
      permissionKeys: ["nope.nope.nope"],
    });

    const row = await organizations.findOne({ organizationId: world.organizationA });
    expect(row?.["rolesVersion"]).toBe(1);
  });

  it("reflects a changed assignment on the next request through the member version", async () => {
    const world = await aWorld();
    const role = await createRole(world, [PERMISSION_KEY.IAM_ROLE_READ]);
    const staffRoleId = await findSystemRoleId(harness.connections, world.organizationA);
    const member = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: "ALL", roleId: staffRoleId },
    ]);
    const rolesPath = `/orgs/${world.organizationA}/roles`;
    const asStaff = await member.actor.call("get", rolesPath);

    await reassignMember(harness.connections, member.memberId, [
      { locationId: "ALL", roleId: role.roleId },
    ]);
    const asReader = await member.actor.call("get", rolesPath);
    await reassignMember(harness.connections, member.memberId, [
      { locationId: "ALL", roleId: staffRoleId },
    ]);
    const asStaffAgain = await member.actor.call("get", rolesPath);

    expect(asStaff.status).toBe(403);
    expect(asReader.status).toBe(200);
    expect(asStaffAgain.status).toBe(403);
  });

  it("gives an archived custom role no permissions", async () => {
    const world = await aWorld();
    const role = await createRole(world, [PERMISSION_KEY.IAM_ROLE_READ]);
    const holder = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: "ALL", roleId: role.roleId },
    ]);
    const staffRoleId = await findSystemRoleId(harness.connections, world.organizationA);
    await reassignMember(harness.connections, holder.memberId, [
      { locationId: "ALL", roleId: staffRoleId },
    ]);
    await world.alice.call("post", `/orgs/${world.organizationA}/roles/${role.roleId}/archive`, {
      version: role.version,
    });
    await reassignMember(harness.connections, holder.memberId, [
      { locationId: "ALL", roleId: role.roleId },
    ]);

    const response = await holder.actor.call("get", `/orgs/${world.organizationA}/roles`);

    expect(response.status).toBe(403);
  });
});
