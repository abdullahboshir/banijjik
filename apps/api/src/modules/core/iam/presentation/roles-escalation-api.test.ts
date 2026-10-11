import { PERMISSION_KEY } from "@banijjik/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerIamApiModels, startIamApi } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import { createCustomRoleAs } from "../../../../test-support/organization-tenant-world.js";
import { addMemberWithAssignments } from "../../../../test-support/rbac-world.js";
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

const ROLE_EDITOR_KEYS = [PERMISSION_KEY.IAM_ROLE_READ, PERMISSION_KEY.IAM_ROLE_UPDATE];
const EVERY_KEY = Object.values(PERMISSION_KEY);

function aWorld(): Promise<TwoOrganizations> {
  return createTwoOrganizations(harness.app, harness.connections, {
    industryTemplateKey: "RETAIL",
  });
}

function rolesPath(world: TwoOrganizations, suffix = ""): string {
  return `/orgs/${world.organizationA}/roles${suffix}`;
}

let issuedRoleNames = 0;

async function memberWithRole(
  world: TwoOrganizations,
  permissionKeys: readonly string[],
  locationId: string,
) {
  issuedRoleNames += 1;
  const roleId = await createCustomRoleAs(world.alice, {
    organizationId: world.organizationA,
    name: `Holder ${issuedRoleNames}`,
    permissionKeys,
  });
  const member = await addMemberWithAssignments(harness.app, world.organizationA, [
    { locationId, roleId },
  ]);
  return { ...member, roleId };
}

async function storedKeys(world: TwoOrganizations, roleId: string): Promise<string[]> {
  const response = await world.alice.call("get", rolesPath(world));
  const roles = response.body.data as { roleId: string; permissionKeys: string[] }[];
  return roles.find((role) => role.roleId === roleId)?.permissionKeys ?? [];
}

describe("a role editor who holds the role permission at one location (review B2, probe P1)", () => {
  it("cannot write every permission key into the role they hold", async () => {
    const world = await aWorld();
    const editor = await memberWithRole(world, ROLE_EDITOR_KEYS, world.locationA1);
    const auditPath = `/orgs/${world.organizationA}/audit-logs`;
    expect((await editor.actor.call("get", auditPath)).status).toBe(403);

    const widen = await editor.actor.call("patch", rolesPath(world, `/${editor.roleId}`), {
      version: 1,
      permissionKeys: EVERY_KEY,
    });

    expect(widen.status).toBe(403);
    expect(await storedKeys(world, editor.roleId)).toEqual([...ROLE_EDITOR_KEYS].sort());
    expect((await editor.actor.call("get", auditPath)).status).toBe(403);
  });

  it("cannot create, update or archive a role while holding the permission at one location only", async () => {
    const world = await aWorld();
    const keys = [
      ...ROLE_EDITOR_KEYS,
      PERMISSION_KEY.IAM_ROLE_CREATE,
      PERMISSION_KEY.IAM_ROLE_ARCHIVE,
    ];
    const editor = await memberWithRole(world, keys, world.locationA1);
    const target = await createCustomRoleAs(world.alice, {
      organizationId: world.organizationA,
      name: "Target",
      permissionKeys: [PERMISSION_KEY.IAM_ROLE_READ],
    });

    const created = await editor.actor.call("post", rolesPath(world), {
      name: "New",
      permissionKeys: [],
    });
    const updated = await editor.actor.call("patch", rolesPath(world, `/${target}`), {
      version: 1,
      name: "Renamed",
    });
    const archived = await editor.actor.call("post", rolesPath(world, `/${target}/archive`), {
      version: 1,
    });

    expect([created.status, updated.status, archived.status]).toEqual([403, 403, 403]);
  });
});

describe("a role editor who holds the role permission at ALL locations (ADR-092 for roles)", () => {
  const callerKeys = [
    PERMISSION_KEY.IAM_ROLE_READ,
    PERMISSION_KEY.IAM_ROLE_CREATE,
    PERMISSION_KEY.IAM_ROLE_UPDATE,
  ];

  function callerAtAll(world: TwoOrganizations) {
    return memberWithRole(world, callerKeys, "ALL");
  }

  it("cannot add a key they lack to a role, and the error lists the keys", async () => {
    const world = await aWorld();
    const caller = await callerAtAll(world);

    const response = await caller.actor.call("patch", rolesPath(world, `/${caller.roleId}`), {
      version: 1,
      permissionKeys: [...callerKeys, PERMISSION_KEY.AUDIT_LOG_READ],
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("BUSINESS_RULE");
    expect(response.body.error.details).toMatchObject({
      ruleKey: "ROLE_NOT_GRANTABLE",
      permissionKeys: [PERMISSION_KEY.AUDIT_LOG_READ],
    });
    expect(await storedKeys(world, caller.roleId)).toEqual([...callerKeys].sort());
  });

  it("cannot create a role with a key they lack, and can create one with keys they hold", async () => {
    const world = await aWorld();
    const caller = await callerAtAll(world);

    const refused = await caller.actor.call("post", rolesPath(world), {
      name: "Too much",
      permissionKeys: [PERMISSION_KEY.IAM_ROLE_READ, PERMISSION_KEY.ORGANIZATION_MEMBER_INVITE],
    });
    const accepted = await caller.actor.call("post", rolesPath(world), {
      name: "Just right",
      permissionKeys: [PERMISSION_KEY.IAM_ROLE_READ],
    });

    expect(refused.status).toBe(422);
    expect(refused.body.error.details.permissionKeys).toEqual([
      PERMISSION_KEY.ORGANIZATION_MEMBER_INVITE,
    ]);
    expect(accepted.status).toBe(201);
  });

  const held = PERMISSION_KEY.IAM_ROLE_READ;
  const alsoHeld = PERMISSION_KEY.IAM_ROLE_UPDATE;
  const lacked = PERMISSION_KEY.ORGANIZATION_MEMBER_INVITE;
  it.each([
    { name: "adds a key held", before: [held], after: [held, alsoHeld], status: 200 },
    { name: "removes a key held", before: [held, alsoHeld], after: [held], status: 200 },
    { name: "removes a key lacked", before: [held, lacked], after: [held], status: 422 },
    { name: "adds a key lacked", before: [held], after: [held, lacked], status: 422 },
    {
      name: "adds a held key and leaves a lacked key alone",
      before: [held, lacked],
      after: [held, lacked, alsoHeld],
      status: 200,
    },
  ])("$name: answers $status", async ({ before, after, status }) => {
    const world = await aWorld();
    const caller = await callerAtAll(world);
    const target = await createCustomRoleAs(world.alice, {
      organizationId: world.organizationA,
      name: "Target",
      permissionKeys: before,
    });

    const response = await caller.actor.call("patch", rolesPath(world, `/${target}`), {
      version: 1,
      permissionKeys: after,
    });

    expect(response.status).toBe(status);
    if (status === 422) expect(response.body.error.details.permissionKeys).toEqual([lacked]);
  });
});

describe("the owner", () => {
  it("can still create a role and widen it to every key", async () => {
    const world = await aWorld();

    const created = await world.alice.call("post", rolesPath(world), {
      name: "All",
      permissionKeys: [],
    });
    const widened = await world.alice.call(
      "patch",
      rolesPath(world, `/${created.body.data.roleId}`),
      { version: 1, permissionKeys: EVERY_KEY },
    );

    expect(created.status).toBe(201);
    expect(widened.status).toBe(200);
  });
});
