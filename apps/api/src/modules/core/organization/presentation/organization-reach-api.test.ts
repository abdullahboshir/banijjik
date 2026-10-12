import { PERMISSION_KEY, SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerIamApiModels, startIamApi } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
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
});
