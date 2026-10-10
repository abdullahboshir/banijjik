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

const MEMBER_KEYS = [
  PERMISSION_KEY.ORGANIZATION_MEMBER_READ,
  PERMISSION_KEY.ORGANIZATION_MEMBER_UPDATE,
  PERMISSION_KEY.ORGANIZATION_MEMBER_INVITE,
];

interface EscalationWorld {
  readonly world: TwoOrganizations;
  /** A manager at every location. */
  readonly manager: ApiActor;
  /** Holds the member keys at the first location only. */
  readonly lead: ApiActor;
  /** Custom roles: one with a key the manager lacks, a reader, and the lead's own role set. */
  readonly powerRoleId: string;
  readonly readerRoleId: string;
  readonly leadRoleId: string;
  readonly managerRoleId: string;
  readonly staffRoleId: string;
}

async function anEscalationWorld(): Promise<EscalationWorld> {
  const world = await createTwoOrganizations(harness.app, harness.connections, {
    industryTemplateKey: "RETAIL",
  });
  const organizationId = world.organizationA;
  const managerRoleId = await findSystemRoleId(
    harness.connections,
    organizationId,
    SYSTEM_ROLE_KEY.MANAGER,
  );
  const staffRoleId = await findSystemRoleId(
    harness.connections,
    organizationId,
    SYSTEM_ROLE_KEY.STAFF,
  );
  // The MANAGER template has no iam.role.create, so a role with it is above a manager.
  const powerRoleId = await createCustomRoleAs(world.alice, {
    organizationId,
    name: "Power",
    permissionKeys: [PERMISSION_KEY.IAM_ROLE_CREATE],
  });
  const readerRoleId = await createCustomRoleAs(world.alice, {
    organizationId,
    name: "Reader",
    permissionKeys: [PERMISSION_KEY.ORGANIZATION_MEMBER_READ],
  });
  const leadRoleId = await createCustomRoleAs(world.alice, {
    organizationId,
    name: "Lead",
    permissionKeys: MEMBER_KEYS,
  });
  const manager = await addMemberWithAssignments(harness.app, organizationId, [
    { locationId: ALL_LOCATIONS, roleId: managerRoleId },
  ]);
  const lead = await addMemberWithAssignments(harness.app, organizationId, [
    { locationId: world.locationA1, roleId: leadRoleId },
  ]);
  return {
    world,
    manager: manager.actor,
    lead: lead.actor,
    powerRoleId,
    readerRoleId,
    leadRoleId,
    managerRoleId,
    staffRoleId,
  };
}

function invitePath(organizationId: string): string {
  return `/orgs/${organizationId}/invitations`;
}

let issuedEmails = 0;

function inviteBody(locationId: string, roleId: string): object {
  issuedEmails += 1;
  return {
    email: `escalation${issuedEmails}@example.com`,
    assignments: [{ locationId, roleId }],
  };
}

describe("granting a role through an invitation (no privilege escalation)", () => {
  it("lets a manager invite someone as manager at every location", async () => {
    const { world, manager, managerRoleId } = await anEscalationWorld();

    const response = await manager.call(
      "post",
      invitePath(world.organizationA),
      inviteBody(ALL_LOCATIONS, managerRoleId),
    );

    expect(response.status).toBe(201);
  });

  it("refuses a manager who invites someone with a custom role holding a key the manager lacks", async () => {
    const { world, manager, powerRoleId } = await anEscalationWorld();

    const response = await manager.call(
      "post",
      invitePath(world.organizationA),
      inviteBody(world.locationA1, powerRoleId),
    );

    expect(response.status).toBe(422);
    expect(response.body.error.details).toMatchObject({ ruleKey: "ROLE_NOT_GRANTABLE" });
  });

  it.each<[string, "first" | "second" | "all", number]>([
    ["at the location where the lead holds the keys", "first", 201],
    ["at another location", "second", 422],
    ["at every location", "all", 422],
  ])("lets a location lead invite a reader %s: %s", async (_description, place, status) => {
    const { world, lead, readerRoleId } = await anEscalationWorld();
    const locationId = {
      first: world.locationA1,
      second: world.locationA2,
      all: ALL_LOCATIONS,
    }[place];

    const response = await lead.call(
      "post",
      invitePath(world.organizationA),
      inviteBody(locationId, readerRoleId),
    );

    expect(response.status).toBe(status);
  });

  it("lets the owner grant any active role", async () => {
    const { world, powerRoleId } = await anEscalationWorld();

    const response = await world.alice.call(
      "post",
      invitePath(world.organizationA),
      inviteBody(world.locationA1, powerRoleId),
    );

    expect(response.status).toBe(201);
  });
});

describe("changing the assignments of a member (no privilege escalation)", () => {
  it("refuses a manager who gives a member a role above the manager", async () => {
    const { world, manager, powerRoleId } = await anEscalationWorld();

    const response = await manager.call(
      "patch",
      `/orgs/${world.organizationA}/members/${world.samMemberId}`,
      {
        assignments: [{ locationId: world.locationA1, roleId: powerRoleId }],
        version: 1,
      },
    );

    expect(response.status).toBe(422);
    expect(response.body.error.details).toMatchObject({ ruleKey: "ROLE_NOT_GRANTABLE" });
  });

  it("allows a manager to move a member between roles the manager holds", async () => {
    const { world, manager, managerRoleId } = await anEscalationWorld();

    const response = await manager.call(
      "patch",
      `/orgs/${world.organizationA}/members/${world.samMemberId}`,
      {
        assignments: [{ locationId: world.locationA1, roleId: managerRoleId }],
        version: 1,
      },
    );

    expect(response.status).toBe(200);
  });

  it("refuses to take away a role the caller does not hold", async () => {
    const { world, manager, powerRoleId, staffRoleId } = await anEscalationWorld();
    const powerful = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: world.locationA1, roleId: powerRoleId },
    ]);
    const path = `/orgs/${world.organizationA}/members/${powerful.memberId}`;

    const demote = await manager.call("patch", path, {
      assignments: [{ locationId: world.locationA1, roleId: staffRoleId }],
      version: 1,
    });
    const suspend = await manager.call("post", `${path}/suspend`, { version: 1 });
    const remove = await manager.call("post", `${path}/remove`, { version: 1 });
    const byOwner = await world.alice.call("post", `${path}/suspend`, { version: 1 });

    for (const response of [demote, suspend, remove]) {
      expect(response.status).toBe(422);
      expect(response.body.error.details).toMatchObject({ ruleKey: "ROLE_NOT_GRANTABLE" });
    }
    expect(byOwner.status).toBe(200);
  });

  it("lets a location lead swap a reader for the lead role at their own location", async () => {
    const { world, lead, readerRoleId, leadRoleId } = await anEscalationWorld();
    const reader = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: world.locationA1, roleId: readerRoleId },
    ]);
    const path = `/orgs/${world.organizationA}/members/${reader.memberId}`;

    const response = await lead.call("patch", path, {
      assignments: [{ locationId: world.locationA1, roleId: leadRoleId }],
      version: 1,
    });
    const elsewhere = await lead.call("patch", path, {
      assignments: [{ locationId: world.locationA2, roleId: leadRoleId }],
      version: 2,
    });

    expect(response.status).toBe(200);
    expect(elsewhere.status).toBe(422);
  });
});
