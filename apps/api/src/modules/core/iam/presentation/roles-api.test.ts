import { PERMISSION_KEY, SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerIamApiModels, startIamApi } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import { addMemberWithAssignments, findSystemRoleId } from "../../../../test-support/rbac-world.js";
import {
  buildPermissionProbeRouter,
  registerTenantNoteModel,
} from "../../../../test-support/tenant-probe.js";
import {
  createTwoOrganizations,
  type ApiActor,
  type TwoOrganizations,
} from "../../../../test-support/two-organizations.js";

registerIamApiModels();
registerTenantNoteModel();

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startIamApi({ tenantRouterFactories: [buildPermissionProbeRouter] });
});

afterAll(async () => {
  await harness.dispose();
});

function aWorld(): Promise<TwoOrganizations> {
  return createTwoOrganizations(harness.app, harness.connections, {
    industryTemplateKey: "RETAIL",
  });
}

function rolesPath(organizationId: string, suffix = ""): string {
  return `/orgs/${organizationId}/roles${suffix}`;
}

interface RoleBody {
  roleId: string;
  roleKey: string;
  name?: string;
  nameKey?: string;
  status: string;
  permissionKeys: string[];
  version: number;
  memberCount?: number;
}

async function createRole(
  owner: ApiActor,
  organizationId: string,
  name: string,
  permissionKeys: string[],
): Promise<RoleBody> {
  const response = await owner.call("post", rolesPath(organizationId), { name, permissionKeys });
  if (response.status !== 201) throw new Error(`create role failed: ${response.status}`);
  return response.body.data as RoleBody;
}

describe("GET /roles", () => {
  it("lists the six system roles for the owner with their effective keys and member counts", async () => {
    const world = await aWorld();

    const response = await world.alice.call("get", rolesPath(world.organizationA));

    expect(response.status).toBe(200);
    const roles = response.body.data as RoleBody[];
    expect(roles.map((role) => role.roleKey)).toEqual(Object.values(SYSTEM_ROLE_KEY));
    const owner = roles.find((role) => role.roleKey === SYSTEM_ROLE_KEY.OWNER);
    expect(owner?.permissionKeys).toEqual(Object.values(PERMISSION_KEY).sort());
    expect(owner?.memberCount).toBe(1);
    expect(roles.find((role) => role.roleKey === SYSTEM_ROLE_KEY.STAFF)?.memberCount).toBe(1);
    expect(roles.find((role) => role.roleKey === SYSTEM_ROLE_KEY.CASHIER)?.memberCount).toBe(0);
    expect(response.body.meta).toEqual({ page: 1, limit: 20, hasNext: false });
  });

  it("shows the manager grants of the code template", async () => {
    const world = await aWorld();

    const response = await world.alice.call("get", rolesPath(world.organizationA));

    const manager = (response.body.data as RoleBody[]).find(
      (role) => role.roleKey === SYSTEM_ROLE_KEY.MANAGER,
    );
    expect(manager?.permissionKeys).toContain(PERMISSION_KEY.IAM_ROLE_READ);
    expect(manager?.permissionKeys).not.toContain(PERMISSION_KEY.IAM_ROLE_CREATE);
    expect(manager?.permissionKeys).not.toContain(PERMISSION_KEY.ORGANIZATION_OWNERSHIP_TRANSFER);
  });

  it("paginates with a limit of at most 100 and reports hasNext", async () => {
    const world = await aWorld();

    const firstPage = await world.alice.call("get", `${rolesPath(world.organizationA)}?limit=4`);
    const secondPage = await world.alice.call(
      "get",
      `${rolesPath(world.organizationA)}?limit=4&page=2`,
    );
    const tooBig = await world.alice.call("get", `${rolesPath(world.organizationA)}?limit=101`);

    expect(firstPage.body.data).toHaveLength(4);
    expect(firstPage.body.meta.hasNext).toBe(true);
    expect(secondPage.body.data).toHaveLength(2);
    expect(secondPage.body.meta.hasNext).toBe(false);
    expect(tooBig.status).toBe(400);
    expect(tooBig.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("denies staff, who hold no role permission, with 403 FORBIDDEN", async () => {
    const world = await aWorld();

    const response = await world.sam.call("get", rolesPath(world.organizationA));

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("lets a manager read roles but not create them", async () => {
    const world = await aWorld();
    const managerRoleId = await findSystemRoleId(
      harness.connections,
      world.organizationA,
      SYSTEM_ROLE_KEY.MANAGER,
    );
    const manager = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: "ALL", roleId: managerRoleId },
    ]);

    const read = await manager.actor.call("get", rolesPath(world.organizationA));
    const create = await manager.actor.call("post", rolesPath(world.organizationA), {
      name: "Sneaky role",
      permissionKeys: [],
    });

    expect(read.status).toBe(200);
    expect(create.status).toBe(403);
    expect(create.body.error.code).toBe("FORBIDDEN");
  });
});

describe("custom roles", () => {
  it("lets the owner create, update and archive a custom role", async () => {
    const world = await aWorld();

    const created = await world.alice.call("post", rolesPath(world.organizationA), {
      name: "Shift lead",
      permissionKeys: [PERMISSION_KEY.IAM_ROLE_READ],
    });
    const role = created.body.data as RoleBody;
    const updated = await world.alice.call(
      "patch",
      rolesPath(world.organizationA, `/${role.roleId}`),
      {
        name: "Shift supervisor",
        permissionKeys: [PERMISSION_KEY.IAM_ROLE_READ, PERMISSION_KEY.ORGANIZATION_LOCATION_READ],
        version: role.version,
      },
    );
    const archived = await world.alice.call(
      "post",
      rolesPath(world.organizationA, `/${role.roleId}/archive`),
      { version: (updated.body.data as RoleBody).version },
    );

    expect(created.status).toBe(201);
    expect(role).toMatchObject({ name: "Shift lead", status: "ACTIVE", version: 1 });
    expect(role.roleKey).toBe(`custom.${role.roleId}`);
    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({ name: "Shift supervisor", version: 2 });
    expect(updated.body.data.permissionKeys).toEqual([
      PERMISSION_KEY.IAM_ROLE_READ,
      PERMISSION_KEY.ORGANIZATION_LOCATION_READ,
    ]);
    expect(archived.status).toBe(200);
    expect(archived.body.data).toMatchObject({ status: "ARCHIVED", version: 3 });
  });

  it("answers 400 for an unknown permission key and for an empty name", async () => {
    const world = await aWorld();
    const path = rolesPath(world.organizationA);

    const unknownKey = await world.alice.call("post", path, {
      name: "Shift lead",
      permissionKeys: ["platform.tenant.read"],
    });
    const emptyName = await world.alice.call("post", path, { name: "", permissionKeys: [] });

    expect(unknownKey.status).toBe(400);
    expect(unknownKey.body.error.code).toBe("VALIDATION_ERROR");
    expect(emptyName.status).toBe(400);
  });

  it("answers 409 DUPLICATE for the name of another active role and frees it after archive", async () => {
    const world = await aWorld();
    const first = await createRole(world.alice, world.organizationA, "Night guard", []);

    const duplicate = await world.alice.call("post", rolesPath(world.organizationA), {
      name: "Night guard",
      permissionKeys: [],
    });
    await world.alice.call("post", rolesPath(world.organizationA, `/${first.roleId}/archive`), {
      version: first.version,
    });
    const reused = await world.alice.call("post", rolesPath(world.organizationA), {
      name: "Night guard",
      permissionKeys: [],
    });

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("DUPLICATE");
    expect(reused.status).toBe(201);
  });

  it("refuses to change or archive a system role with 422 SYSTEM_ROLE_IMMUTABLE", async () => {
    const world = await aWorld();
    const listed = await world.alice.call("get", rolesPath(world.organizationA));
    const staff = (listed.body.data as RoleBody[]).find((role) => role.roleKey === "STAFF");

    const update = await world.alice.call(
      "patch",
      rolesPath(world.organizationA, `/${staff?.roleId}`),
      { name: "Renamed", version: 1 },
    );
    const archive = await world.alice.call(
      "post",
      rolesPath(world.organizationA, `/${staff?.roleId}/archive`),
      { version: 1 },
    );

    for (const response of [update, archive]) {
      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe("BUSINESS_RULE");
      expect(response.body.error.details.ruleKey).toBe("SYSTEM_ROLE_IMMUTABLE");
    }
  });

  it("refuses to archive a role an active member holds with 422 ROLE_IN_USE", async () => {
    const world = await aWorld();
    const role = await createRole(world.alice, world.organizationA, "Cashier plus", []);
    await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: "ALL", roleId: role.roleId },
    ]);

    const response = await world.alice.call(
      "post",
      rolesPath(world.organizationA, `/${role.roleId}/archive`),
      { version: role.version },
    );

    expect(response.status).toBe(422);
    expect(response.body.error.details.ruleKey).toBe("ROLE_IN_USE");
  });

  it("answers 409 CONFLICT for a stale version", async () => {
    const world = await aWorld();
    const role = await createRole(world.alice, world.organizationA, "Shift lead", []);
    await world.alice.call("patch", rolesPath(world.organizationA, `/${role.roleId}`), {
      name: "Shift lead 2",
      version: role.version,
    });

    const stale = await world.alice.call(
      "patch",
      rolesPath(world.organizationA, `/${role.roleId}`),
      {
        name: "Shift lead 3",
        version: role.version,
      },
    );

    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("CONFLICT");
    expect(stale.body.error.details.currentVersion).toBe(2);
  });

  it("answers 409 INVALID_TRANSITION when an archived role is changed", async () => {
    const world = await aWorld();
    const role = await createRole(world.alice, world.organizationA, "Old role", []);
    await world.alice.call("post", rolesPath(world.organizationA, `/${role.roleId}/archive`), {
      version: role.version,
    });

    const response = await world.alice.call(
      "patch",
      rolesPath(world.organizationA, `/${role.roleId}`),
      { name: "Revived", version: 2 },
    );

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("INVALID_TRANSITION");
  });

  it("answers 404 for an unknown role and for a role of another organization", async () => {
    const world = await aWorld();
    const roleOfB = await createRole(world.bob, world.organizationB, "Only in B", []);

    const unknown = await world.alice.call("patch", rolesPath(world.organizationA, `/${newId()}`), {
      name: "Nope",
      version: 1,
    });
    const foreignUpdate = await world.alice.call(
      "patch",
      rolesPath(world.organizationA, `/${roleOfB.roleId}`),
      { name: "Hijacked", version: 1 },
    );
    const foreignArchive = await world.alice.call(
      "post",
      rolesPath(world.organizationA, `/${roleOfB.roleId}/archive`),
      { version: 1 },
    );
    const foreignOrganization = await world.alice.call("get", rolesPath(world.organizationB));

    for (const response of [unknown, foreignUpdate, foreignArchive, foreignOrganization]) {
      expect(response.status).toBe(404);
    }
    const bobRoles = await world.bob.call("get", rolesPath(world.organizationB));
    expect(
      (bobRoles.body.data as RoleBody[]).find((role) => role.roleId === roleOfB.roleId)?.name,
    ).toBe("Only in B");
  });
});

describe("location-aware permission", () => {
  async function memberWithReadAtL1Only(world: TwoOrganizations) {
    const reader = await createRole(world.alice, world.organizationA, "Reader at L1", [
      PERMISSION_KEY.IAM_ROLE_READ,
    ]);
    const staffRoleId = await findSystemRoleId(harness.connections, world.organizationA);
    return addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: world.locationA1, roleId: reader.roleId },
      { locationId: world.locationA2, roleId: staffRoleId },
    ]);
  }

  it("narrows the request to the locations that grant the permission", async () => {
    const world = await aWorld();
    const member = await memberWithReadAtL1Only(world);

    const response = await member.actor.call("get", `/orgs/${world.organizationA}/guarded/probe`);

    expect(response.status).toBe(200);
    expect(response.body.data.allowedLocationIds).toEqual([world.locationA1]);
  });

  it("answers 403 for ?location of a location where the permission is not granted", async () => {
    const world = await aWorld();
    const member = await memberWithReadAtL1Only(world);
    const base = `/orgs/${world.organizationA}/guarded/probe`;

    const notGranted = await member.actor.call("get", `${base}?location=${world.locationA2}`);
    const granted = await member.actor.call("get", `${base}?location=${world.locationA1}`);

    expect(notGranted.status).toBe(403);
    expect(notGranted.body.error.code).toBe("FORBIDDEN");
    expect(granted.status).toBe(200);
  });

  it("makes the location plugin refuse a write at a location without the permission", async () => {
    const world = await aWorld();
    const member = await memberWithReadAtL1Only(world);
    const path = `/orgs/${world.organizationA}/guarded/notes`;

    const refused = await member.actor.call("post", path, {
      label: "at-l2",
      locationId: world.locationA2,
    });
    const accepted = await member.actor.call("post", path, {
      label: "at-l1",
      locationId: world.locationA1,
    });

    expect(refused.status).toBe(403);
    expect(refused.body.error.code).toBe("LOCATION_FORBIDDEN");
    expect(accepted.status).toBe(201);
  });

  it("denies a member who holds the permission nowhere", async () => {
    const world = await aWorld();

    const response = await world.sam.call("get", `/orgs/${world.organizationA}/guarded/probe`);

    expect(response.status).toBe(403);
  });
});
