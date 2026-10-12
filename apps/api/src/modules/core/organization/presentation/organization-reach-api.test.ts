import { ALL_LOCATIONS, PERMISSION_KEY, SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerIamApiModels, startIamApi } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import { createCustomRoleAs } from "../../../../test-support/organization-tenant-world.js";
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

interface ReachWorld {
  readonly world: TwoOrganizations;
  /** MANAGER at A-L1 only. */
  readonly manager: ApiActor;
  readonly managerMemberId: string;
  /** STAFF at A-L1 and A-L2. */
  readonly twoLocationMemberId: string;
  /** STAFF at A-L2 only. */
  readonly otherLocationMemberId: string;
  readonly staffRoleId: string;
}

function orgPath(world: TwoOrganizations, suffix: string): string {
  return `/orgs/${world.organizationA}${suffix}`;
}

async function aReachWorld(): Promise<ReachWorld> {
  const world = await createTwoOrganizations(harness.app, harness.connections, {
    industryTemplateKey: "RETAIL",
  });
  const { organizationA, locationA1, locationA2 } = world;
  const managerRoleId = await findSystemRoleId(
    harness.connections,
    organizationA,
    SYSTEM_ROLE_KEY.MANAGER,
  );
  const staffRoleId = await findSystemRoleId(
    harness.connections,
    organizationA,
    SYSTEM_ROLE_KEY.STAFF,
  );
  const manager = await addMemberWithAssignments(harness.app, organizationA, [
    { locationId: locationA1, roleId: managerRoleId },
  ]);
  const twoLocation = await addMemberWithAssignments(harness.app, organizationA, [
    { locationId: locationA1, roleId: staffRoleId },
    { locationId: locationA2, roleId: staffRoleId },
  ]);
  const otherLocation = await addMemberWithAssignments(harness.app, organizationA, [
    { locationId: locationA2, roleId: staffRoleId },
  ]);
  return {
    world,
    manager: manager.actor,
    managerMemberId: manager.memberId,
    twoLocationMemberId: twoLocation.memberId,
    otherLocationMemberId: otherLocation.memberId,
    staffRoleId,
  };
}

async function ownerMemberId(world: TwoOrganizations): Promise<string> {
  const list = await world.alice.call("get", orgPath(world, "/members?limit=100"));
  const owner = list.body.data.find((row: { userId: string }) => row.userId === world.alice.userId);
  return owner.memberId as string;
}

describe("organization-level records need the permission at every location (decision 3)", () => {
  it("refuses a manager of one location the profile edit and the audit log, but lets them read the profile", async () => {
    const { world, manager } = await aReachWorld();

    const edit = await manager.call("patch", orgPath(world, "/profile"), {
      name: "Renamed",
      version: 1,
    });
    const audit = await manager.call("get", orgPath(world, "/audit-logs"));
    const read = await manager.call("get", orgPath(world, "/profile"));

    expect(edit.status).toBe(403);
    expect(audit.status).toBe(403);
    expect(read.status).toBe(200);
  });

  it("still lets the owner, who holds both at every location, edit the profile and read the audit log", async () => {
    const { world } = await aReachWorld();

    const edit = await world.alice.call("patch", orgPath(world, "/profile"), {
      name: "Renamed by owner",
      version: 1,
    });
    const audit = await world.alice.call("get", orgPath(world, "/audit-logs"));

    expect(edit.status).toBe(200);
    expect(audit.status).toBe(200);
  });
});

describe("a manager of one location sees only the staff of that location (decision 4)", () => {
  it("lists only members assigned solely to the manager's location", async () => {
    const { world, manager, managerMemberId, twoLocationMemberId, otherLocationMemberId } =
      await aReachWorld();

    const response = await manager.call("get", orgPath(world, "/members?limit=100"));

    const ids = response.body.data.map((row: { memberId: string }) => row.memberId).sort();
    expect(response.status).toBe(200);
    expect(ids).toEqual([managerMemberId, world.samMemberId].sort());
    expect(ids).not.toContain(twoLocationMemberId);
    expect(ids).not.toContain(otherLocationMemberId);
  });

  it("pages the filtered set correctly: every page is full until the last, with no gaps or repeats", async () => {
    const { world, manager, staffRoleId } = await aReachWorld();
    for (let index = 0; index < 3; index += 1) {
      await addMemberWithAssignments(harness.app, world.organizationA, [
        { locationId: world.locationA1, roleId: staffRoleId },
      ]);
    }

    const first = await manager.call("get", orgPath(world, "/members?limit=2&page=1"));
    const second = await manager.call("get", orgPath(world, "/members?limit=2&page=2"));
    const third = await manager.call("get", orgPath(world, "/members?limit=2&page=3"));

    const all = [first, second, third].flatMap((page) =>
      page.body.data.map((row: { memberId: string }) => row.memberId),
    );
    expect(first.body.data).toHaveLength(2);
    expect(first.body.meta.hasNext).toBe(true);
    expect(second.body.data).toHaveLength(2);
    expect(second.body.meta.hasNext).toBe(true);
    expect(third.body.data).toHaveLength(1);
    expect(third.body.meta.hasNext).toBe(false);
    expect(new Set(all).size).toBe(5);
  });

  it("answers 404 for the owner and a two-location member by id, and for every change", async () => {
    const { world, manager, twoLocationMemberId } = await aReachWorld();
    const ownerId = await ownerMemberId(world);

    for (const memberId of [ownerId, twoLocationMemberId]) {
      const path = orgPath(world, `/members/${memberId}`);
      const results = [
        await manager.call("get", path),
        await manager.call("patch", path, { displayName: "X", version: 1 }),
        await manager.call("post", `${path}/suspend`, { version: 1 }),
        await manager.call("post", `${path}/reactivate`, { version: 1 }),
        await manager.call("post", `${path}/remove`, { version: 1 }),
      ];
      expect(results.map((result) => result.status)).toEqual([404, 404, 404, 404, 404]);
    }
  });

  it("lets the manager read, suspend and reactivate a member of their own location", async () => {
    const { world, manager } = await aReachWorld();
    const path = orgPath(world, `/members/${world.samMemberId}`);

    const read = await manager.call("get", path);
    const suspended = await manager.call("post", `${path}/suspend`, { version: 1 });
    const reactivated = await manager.call("post", `${path}/reactivate`, { version: 2 });

    expect(read.status).toBe(200);
    expect(suspended.status).toBe(200);
    expect(suspended.body.data.status).toBe("SUSPENDED");
    expect(reactivated.status).toBe(200);
  });

  it("refuses to give a member of their own location another location or ALL", async () => {
    const { world, manager, staffRoleId } = await aReachWorld();
    const path = orgPath(world, `/members/${world.samMemberId}`);

    const otherLocation = await manager.call("patch", path, {
      version: 1,
      assignments: [{ locationId: world.locationA2, roleId: staffRoleId }],
    });
    const everywhere = await manager.call("patch", path, {
      version: 1,
      assignments: [{ locationId: ALL_LOCATIONS, roleId: staffRoleId }],
    });
    const unchanged = await world.alice.call("get", path);

    expect(otherLocation.status).toBe(422);
    expect(everywhere.status).toBe(422);
    expect(unchanged.body.data.assignments).toEqual([
      expect.objectContaining({ locationId: world.locationA1 }),
    ]);
  });

  it("lets a caller at every location see and reach everyone", async () => {
    const { world, twoLocationMemberId, otherLocationMemberId } = await aReachWorld();
    const ownerId = await ownerMemberId(world);

    const list = await world.alice.call("get", orgPath(world, "/members?limit=100"));
    const twoLocation = await world.alice.call(
      "get",
      orgPath(world, `/members/${twoLocationMemberId}`),
    );

    const ids = list.body.data.map((row: { memberId: string }) => row.memberId);
    expect(ids).toEqual(
      expect.arrayContaining([ownerId, twoLocationMemberId, otherLocationMemberId]),
    );
    expect(twoLocation.status).toBe(200);
  });
});

/** Reads the branch administrator keeps: they stay visible, only the writes over organization records go. */
const BRANCH_ADMIN_READ_KEYS = [
  PERMISSION_KEY.ORGANIZATION_LOCATION_READ,
  PERMISSION_KEY.IAM_ROLE_READ,
];
/** The API refuses each of these unless it is held at every location (requireAllLocations). */
const ORGANIZATION_RECORD_WRITE_KEYS = [
  PERMISSION_KEY.ORGANIZATION_LOCATION_CREATE,
  PERMISSION_KEY.ORGANIZATION_LOCATION_UPDATE,
  PERMISSION_KEY.ORGANIZATION_LOCATION_ARCHIVE,
  PERMISSION_KEY.IAM_ROLE_CREATE,
  PERMISSION_KEY.IAM_ROLE_UPDATE,
  PERMISSION_KEY.IAM_ROLE_ARCHIVE,
];

describe("GET /me/config offers only what the API allows (decision 3)", () => {
  function menuKeys(response: { body: { data: { menu: { permissionKey: string }[] } } }) {
    return response.body.data.menu.map((entry) => entry.permissionKey);
  }

  it("leaves the two organization-level keys out for a manager of one location, and the menu follows", async () => {
    const { world, manager } = await aReachWorld();

    const response = await manager.call("get", orgPath(world, "/me/config"));

    const { allLocations, byLocation } = response.body.data.permissions;
    const everyKey = [...allLocations, ...Object.values<string[]>(byLocation).flat()];
    expect(response.status).toBe(200);
    expect(everyKey).not.toContain(PERMISSION_KEY.ORGANIZATION_PROFILE_UPDATE);
    expect(everyKey).not.toContain(PERMISSION_KEY.AUDIT_LOG_READ);
    expect(everyKey).toContain(PERMISSION_KEY.ORGANIZATION_MEMBER_READ);
    expect(menuKeys(response)).not.toContain(PERMISSION_KEY.ORGANIZATION_PROFILE_UPDATE);
    expect(menuKeys(response)).toContain(PERMISSION_KEY.ORGANIZATION_MEMBER_READ);
  });

  it("keeps both keys, and the profile menu entry, for the owner", async () => {
    const { world } = await aReachWorld();

    const response = await world.alice.call("get", orgPath(world, "/me/config"));

    expect(response.body.data.permissions.allLocations).toEqual(
      expect.arrayContaining([
        PERMISSION_KEY.ORGANIZATION_PROFILE_UPDATE,
        PERMISSION_KEY.AUDIT_LOG_READ,
      ]),
    );
    expect(menuKeys(response)).toContain(PERMISSION_KEY.ORGANIZATION_PROFILE_UPDATE);
  });

  it("leaves the location and role write keys out for a person who holds them at one location only (1.9c review, deviation 2)", async () => {
    const { world } = await aReachWorld();
    const roleId = await createCustomRoleAs(world.alice, {
      organizationId: world.organizationA,
      name: "Branch administrator",
      permissionKeys: [...BRANCH_ADMIN_READ_KEYS, ...ORGANIZATION_RECORD_WRITE_KEYS],
    });
    const branchAdmin = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: world.locationA1, roleId },
    ]);

    const response = await branchAdmin.actor.call("get", orgPath(world, "/me/config"));
    const owner = await world.alice.call("get", orgPath(world, "/me/config"));

    const { allLocations, byLocation } = response.body.data.permissions;
    const everyKey = [...allLocations, ...Object.values<string[]>(byLocation).flat()];
    expect(response.status).toBe(200);
    for (const writeKey of ORGANIZATION_RECORD_WRITE_KEYS) {
      expect(everyKey).not.toContain(writeKey);
    }
    expect(everyKey).toEqual(expect.arrayContaining(BRANCH_ADMIN_READ_KEYS));
    expect(owner.body.data.permissions.allLocations).toEqual(
      expect.arrayContaining(ORGANIZATION_RECORD_WRITE_KEYS),
    );
  });
});
