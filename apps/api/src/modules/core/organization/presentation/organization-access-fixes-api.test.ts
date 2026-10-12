import { ALL_LOCATIONS, AUDIT_ACTION, PERMISSION_KEY, SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { callApi } from "../../../../test-support/auth-api-client.js";
import { registerIamApiModels, startIamApi } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import { closeOrganization } from "../../../../test-support/organization-api-scenarios.js";
import {
  createCustomRoleAs,
  inviteEmailAs,
  newActor,
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

function orgPath(world: TwoOrganizations, suffix: string): string {
  return `/orgs/${world.organizationA}${suffix}`;
}

function customRole(world: TwoOrganizations, name: string, permissionKeys: string[]) {
  return createCustomRoleAs(world.alice, {
    organizationId: world.organizationA,
    name,
    permissionKeys,
  });
}

/** A member who may invite and read members, at every location. */
async function anInviter(world: TwoOrganizations) {
  const roleId = await customRole(world, "Inviter", [
    PERMISSION_KEY.ORGANIZATION_MEMBER_INVITE,
    PERMISSION_KEY.ORGANIZATION_MEMBER_READ,
  ]);
  return addMemberWithAssignments(harness.app, world.organizationA, [
    { locationId: ALL_LOCATIONS, roleId },
  ]);
}

async function invitationStatus(world: TwoOrganizations, invitationId: string): Promise<string> {
  const response = await world.alice.call("get", orgPath(world, "/invitations"));
  const rows = response.body.data as { invitationId: string; status: string }[];
  return rows.find((row) => row.invitationId === invitationId)?.status ?? "MISSING";
}

describe("an invitation depends on its inviter (review J1, probe P2)", () => {
  async function managerInvitesHimself(world: TwoOrganizations) {
    const managerRoleId = await findSystemRoleId(
      harness.connections,
      world.organizationA,
      SYSTEM_ROLE_KEY.MANAGER,
    );
    const manager = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: ALL_LOCATIONS, roleId: managerRoleId },
    ]);
    const friend = await newActor(harness.app);
    const invited = await inviteEmailAs(manager.actor, world.organizationA, {
      email: friend.person.email,
      assignments: [{ locationId: ALL_LOCATIONS, roleId: managerRoleId }],
    });
    return { manager, friend, invited };
  }

  it("cannot be accepted after the inviter was removed", async () => {
    const world = await aWorld();
    const { manager, friend, invited } = await managerInvitesHimself(world);

    const removed = await world.alice.call(
      "post",
      orgPath(world, `/members/${manager.memberId}/remove`),
      { version: 1 },
    );
    const accepted = await friend.call("post", `/invitations/${invited.token}/accept`);

    expect(removed.status).toBe(200);
    expect(accepted.status).toBe(404);
    expect(await invitationStatus(world, invited.invitationId)).toBe("REVOKED");
  });

  it("is revoked, with an audit entry that names the reason, when the inviter is suspended", async () => {
    const world = await aWorld();
    const { manager, invited } = await managerInvitesHimself(world);

    await world.alice.call("post", orgPath(world, `/members/${manager.memberId}/suspend`), {
      version: 1,
    });

    expect(await invitationStatus(world, invited.invitationId)).toBe("REVOKED");
    const entry = await harness.connections.tenantShared
      .collection("audit_logs")
      .findOne({ action: AUDIT_ACTION.INVITATION_REVOKED, entityId: invited.invitationId });
    expect(entry?.["changes"]).toMatchObject({ reason: { to: "INVITER_ACCESS_CHANGED" } });
  });

  it("is revoked when the inviter's assignments change, but not when only the name does", async () => {
    const world = await aWorld();
    const { manager, invited } = await managerInvitesHimself(world);
    const path = orgPath(world, `/members/${manager.memberId}`);

    const renamed = await world.alice.call("patch", path, { displayName: "New Name", version: 1 });
    const stillPending = await invitationStatus(world, invited.invitationId);
    const staffRoleId = await findSystemRoleId(harness.connections, world.organizationA);
    await world.alice.call("patch", path, {
      assignments: [{ locationId: world.locationA1, roleId: staffRoleId }],
      version: 2,
    });

    expect(renamed.status).toBe(200);
    expect(stillPending).toBe("PENDING");
    expect(await invitationStatus(world, invited.invitationId)).toBe("REVOKED");
  });

  it("cannot be accepted once a role edit put the invited role above the inviter", async () => {
    const world = await aWorld();
    const inviter = await anInviter(world);
    const invitedRoleId = await customRole(world, "Invited", [
      PERMISSION_KEY.ORGANIZATION_MEMBER_READ,
    ]);
    const friend = await newActor(harness.app);
    const invited = await inviteEmailAs(inviter.actor, world.organizationA, {
      email: friend.person.email,
      assignments: [{ locationId: ALL_LOCATIONS, roleId: invitedRoleId }],
    });
    await world.alice.call("patch", orgPath(world, `/roles/${invitedRoleId}`), {
      version: 1,
      permissionKeys: [PERMISSION_KEY.ORGANIZATION_MEMBER_READ, PERMISSION_KEY.AUDIT_LOG_READ],
    });

    const accepted = await friend.call("post", `/invitations/${invited.token}/accept`);

    expect(accepted.status).toBe(404);
    expect(await invitationStatus(world, invited.invitationId)).toBe("REVOKED");
  });

  it("is still accepted when the inviter keeps what was invited", async () => {
    const world = await aWorld();
    const inviter = await anInviter(world);
    const invitedRoleId = await customRole(world, "Invited", [
      PERMISSION_KEY.ORGANIZATION_MEMBER_READ,
    ]);
    const friend = await newActor(harness.app);
    const invited = await inviteEmailAs(inviter.actor, world.organizationA, {
      email: friend.person.email,
      assignments: [{ locationId: ALL_LOCATIONS, roleId: invitedRoleId }],
    });

    const accepted = await friend.call("post", `/invitations/${invited.token}/accept`);

    expect(accepted.status).toBe(200);
  });
});

describe("reactivating a member re-checks locations and roles (review J5, probe P6)", () => {
  async function suspendedMemberOnArchivedAssignments(world: TwoOrganizations) {
    const roleId = await customRole(world, "Short lived", [
      PERMISSION_KEY.ORGANIZATION_MEMBER_READ,
    ]);
    const member = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: world.locationA2, roleId },
    ]);
    const base = orgPath(world, `/members/${member.memberId}`);
    await world.alice.call("post", `${base}/suspend`, { version: 1 });
    const location = await world.alice.call(
      "post",
      orgPath(world, `/locations/${world.locationA2}/archive`),
      { version: 1 },
    );
    const role = await world.alice.call("post", orgPath(world, `/roles/${roleId}/archive`), {
      version: 1,
    });
    expect([location.status, role.status]).toEqual([200, 200]);
    return { base, member };
  }

  it("refuses with MEMBER_ASSIGNMENTS_INVALID and leaves the member suspended", async () => {
    const world = await aWorld();
    const { base } = await suspendedMemberOnArchivedAssignments(world);

    const reactivated = await world.alice.call("post", `${base}/reactivate`, { version: 2 });

    expect(reactivated.status).toBe(422);
    expect(reactivated.body.error.details).toMatchObject({
      ruleKey: "MEMBER_ASSIGNMENTS_INVALID",
    });
    const member = await world.alice.call("get", base);
    expect(member.body.data.status).toBe("SUSPENDED");
  });

  it("lets the owner fix the assignments of the suspended member, then reactivate", async () => {
    const world = await aWorld();
    const { base } = await suspendedMemberOnArchivedAssignments(world);
    const staffRoleId = await findSystemRoleId(harness.connections, world.organizationA);

    const fixed = await world.alice.call("patch", base, {
      assignments: [{ locationId: world.locationA1, roleId: staffRoleId }],
      version: 2,
    });
    const reactivated = await world.alice.call("post", `${base}/reactivate`, { version: 3 });

    expect(fixed.status).toBe(200);
    expect(reactivated.status).toBe(200);
  });
});

describe("invitation links of an organization that is not active (review M1, probe P3)", () => {
  async function invitedPerson(world: TwoOrganizations) {
    const friend = await newActor(harness.app);
    const staffRoleId = await findSystemRoleId(harness.connections, world.organizationA);
    const invited = await inviteEmailAs(world.alice, world.organizationA, {
      email: friend.person.email,
      assignments: [{ locationId: world.locationA1, roleId: staffRoleId }],
    });
    return { friend, invited };
  }

  async function memberCount(world: TwoOrganizations): Promise<number> {
    return harness.connections.platform
      .collection("members")
      .countDocuments({ organizationId: world.organizationA });
  }

  it.each(["SUSPENDED", "CLOSED"])(
    "answers 404 for preview and accept when it is %s",
    async (status) => {
      const world = await aWorld();
      const { friend, invited } = await invitedPerson(world);
      const before = await memberCount(world);
      if (status === "CLOSED") await closeOrganization(harness.connections, world.organizationA);
      else {
        await harness.connections.platform
          .collection("organizations")
          .updateOne({ organizationId: world.organizationA }, { $set: { status } });
      }

      const preview = await callApi(harness.app, {
        method: "get",
        path: `/api/v1/invitations/${invited.token}`,
      });
      const accepted = await friend.call("post", `/invitations/${invited.token}/accept`);

      expect([preview.status, accepted.status]).toEqual([404, 404]);
      expect(await memberCount(world)).toBe(before);
    },
  );
});

describe("invitations stay within the caller's reach (review M2, probe P7)", () => {
  async function invitationsOf(world: TwoOrganizations) {
    const inviteeRole = await customRole(world, "Invitee role", [
      PERMISSION_KEY.ORGANIZATION_MEMBER_INVITE,
    ]);
    const aboveRole = await customRole(world, "Above", [PERMISSION_KEY.AUDIT_LOG_READ]);
    const managerRoleId = await findSystemRoleId(
      harness.connections,
      world.organizationA,
      SYSTEM_ROLE_KEY.MANAGER,
    );
    const lead = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: world.locationA1, roleId: inviteeRole },
    ]);
    const invite = async (locationId: string, roleId: string) =>
      (
        await inviteEmailAs(world.alice, world.organizationA, {
          email: `reach${Math.random().toString(36).slice(2)}@example.com`,
          assignments: [{ locationId, roleId }],
        })
      ).invitationId;
    return {
      lead: lead.actor,
      atAll: await invite(ALL_LOCATIONS, managerRoleId),
      inReach: await invite(world.locationA1, inviteeRole),
      otherLocation: await invite(world.locationA2, inviteeRole),
      aboveCaller: await invite(world.locationA1, aboveRole),
    };
  }

  async function listedIds(world: TwoOrganizations, caller: ApiActor): Promise<string[]> {
    const response = await caller.call("get", orgPath(world, "/invitations"));
    return (response.body.data as { invitationId: string }[]).map((row) => row.invitationId);
  }

  it("lists only invitations the caller could have made", async () => {
    const world = await aWorld();
    const set = await invitationsOf(world);

    const ids = await listedIds(world, set.lead);

    expect(ids.sort()).toEqual([set.aboveCaller, set.inReach].sort());
  });

  it("answers 404 when revoking an invitation outside the reach, and 422 for a role above the caller", async () => {
    const world = await aWorld();
    const set = await invitationsOf(world);
    const revoke = (invitationId: string) =>
      set.lead.call("post", orgPath(world, `/invitations/${invitationId}/revoke`), { version: 1 });

    const atAll = await revoke(set.atAll);
    const other = await revoke(set.otherLocation);
    const above = await revoke(set.aboveCaller);
    const inReach = await revoke(set.inReach);

    expect([atAll.status, other.status, above.status, inReach.status]).toEqual([
      404, 404, 422, 200,
    ]);
    expect(above.body.error.details).toMatchObject({ ruleKey: "ROLE_NOT_GRANTABLE" });
    expect(await invitationStatus(world, set.atAll)).toBe("PENDING");
  });
});
