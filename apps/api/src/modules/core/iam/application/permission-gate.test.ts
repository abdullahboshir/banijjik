import { PERMISSION_KEY, SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { newId, type OrganizationId, type RoleId, type UserId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import { runWithRequestContext } from "../../../../kernel/context/index.js";
import { organizationManifest } from "../../organization/index.js";
import { iamManifest } from "../index.js";
import type { GrantMap } from "../domain/grant-map.js";
import { Role } from "../domain/role.entity.js";
import { buildPermissionCatalog } from "./permission-catalog.js";
import { IamPermissionGate } from "./permission-gate.js";
import { PermissionResolver } from "./permission-resolver.js";
import type { MemberAssignment } from "./ports/member-access-reader.js";
import type { PermissionCache } from "./ports/permission-cache.js";

const ORGANIZATION_ID = newId<OrganizationId>();
const MEMBER_ID = "member-1";
const catalog = buildPermissionCatalog([iamManifest, organizationManifest]);

/** The simplest possible cache, so this test covers the gate and not the LRU adapter. */
class MapCache implements PermissionCache {
  private readonly entries = new Map<string, GrantMap>();

  async get(key: string): Promise<GrantMap | undefined> {
    return this.entries.get(key);
  }

  async set(key: string, value: GrantMap): Promise<void> {
    this.entries.set(key, value);
  }
}

interface World {
  readonly gate: IamPermissionGate;
  readonly roleReads: () => number;
  readonly memberReads: () => number;
  setAssignments(assignments: readonly MemberAssignment[]): void;
}

function aSystemRole(roleKey: Parameters<typeof Role.createSystem>[0]["roleKey"]): Role {
  return Role.createSystem({
    organizationId: ORGANIZATION_ID,
    roleKey,
    createdByUserId: newId<UserId>(),
    now: new Date(),
  });
}

function buildWorld(roles: readonly Role[], initial: readonly MemberAssignment[]): World {
  let assignments = initial;
  let roleReadCount = 0;
  let memberReadCount = 0;
  const gate = new IamPermissionGate({
    catalog,
    resolver: new PermissionResolver(catalog),
    cache: new MapCache(),
    roles: {
      findByIds: async (roleIds: readonly RoleId[]) => {
        roleReadCount += 1;
        return roles.filter((role) => roleIds.includes(role.roleId));
      },
    },
    members: {
      findAssignments: async () => {
        memberReadCount += 1;
        return assignments;
      },
    },
  });
  return {
    gate,
    roleReads: () => roleReadCount,
    memberReads: () => memberReadCount,
    setAssignments: (next) => {
      assignments = next;
    },
  };
}

function asCaller<Result>(accessVersion: string | undefined, work: () => Promise<Result>) {
  return runWithRequestContext(
    {
      requestId: "request-1",
      organizationId: ORGANIZATION_ID,
      memberId: MEMBER_ID,
      ...(accessVersion === undefined ? {} : { accessVersion }),
    },
    work,
  );
}

describe("IamPermissionGate", () => {
  it("answers ALL for an owner and an empty list for staff", async () => {
    const owner = aSystemRole(SYSTEM_ROLE_KEY.OWNER);
    const staff = aSystemRole(SYSTEM_ROLE_KEY.STAFF);
    const ownerWorld = buildWorld([owner], [{ locationId: "ALL", roleId: owner.roleId }]);
    const staffWorld = buildWorld([staff], [{ locationId: "L1", roleId: staff.roleId }]);

    const ownerAnswer = await asCaller("1.1", () =>
      ownerWorld.gate.locationsWith(PERMISSION_KEY.IAM_ROLE_CREATE),
    );
    const staffAnswer = await asCaller("1.1", () =>
      staffWorld.gate.locationsWith(PERMISSION_KEY.IAM_ROLE_READ),
    );

    expect(ownerAnswer).toBe("ALL");
    expect(staffAnswer).toEqual([]);
  });

  it("reads members and roles once and serves the second identical check from the cache", async () => {
    const manager = aSystemRole(SYSTEM_ROLE_KEY.MANAGER);
    const world = buildWorld([manager], [{ locationId: "L1", roleId: manager.roleId }]);

    const first = await asCaller("1.1", () => world.gate.locationsWith("iam.role.read"));
    const second = await asCaller("1.1", () => world.gate.locationsWith("iam.role.read"));

    expect(first).toEqual(["L1"]);
    expect(second).toEqual(["L1"]);
    expect(world.roleReads()).toBe(1);
    expect(world.memberReads()).toBe(1);
  });

  it("reads again when the access version changes, so a stale grant is never served", async () => {
    const manager = aSystemRole(SYSTEM_ROLE_KEY.MANAGER);
    const staff = aSystemRole(SYSTEM_ROLE_KEY.STAFF);
    const world = buildWorld([manager, staff], [{ locationId: "ALL", roleId: manager.roleId }]);
    const before = await asCaller("1.1", () => world.gate.locationsWith("iam.role.read"));

    world.setAssignments([{ locationId: "ALL", roleId: staff.roleId }]);
    const sameVersion = await asCaller("1.1", () => world.gate.locationsWith("iam.role.read"));
    const newVersion = await asCaller("2.1", () => world.gate.locationsWith("iam.role.read"));

    expect(before).toBe("ALL");
    expect(sameVersion).toBe("ALL");
    expect(newVersion).toEqual([]);
    expect(world.roleReads()).toBe(2);
  });

  it("does not share cache entries between members of the same version", async () => {
    const manager = aSystemRole(SYSTEM_ROLE_KEY.MANAGER);
    const world = buildWorld([manager], [{ locationId: "ALL", roleId: manager.roleId }]);
    await asCaller("1.1", () => world.gate.locationsWith("iam.role.read"));

    await runWithRequestContext(
      {
        requestId: "request-2",
        organizationId: ORGANIZATION_ID,
        memberId: "member-2",
        accessVersion: "1.1",
      },
      () => world.gate.locationsWith("iam.role.read"),
    );

    expect(world.memberReads()).toBe(2);
  });

  it("refuses to run without the tenant context", async () => {
    const world = buildWorld([], []);

    await expect(
      asCaller(undefined, () => world.gate.locationsWith("iam.role.read")),
    ).rejects.toThrow(/missing_tenant_context/);
  });

  it("gives a member with no assignments nothing", async () => {
    const world = buildWorld([], []);

    const answer = await asCaller("1.1", () => world.gate.locationsWith("iam.role.read"));

    expect(answer).toEqual([]);
  });
});
