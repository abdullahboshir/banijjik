import { SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  asCookies,
  callApi,
  readSessionCookies,
} from "../../../../test-support/auth-api-client.js";
import { registerIamApiModels, startIamApi } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import {
  countAuditRows,
  countOutboxRows,
  inviteEmailAs,
  newActor,
  type InvitedPerson,
} from "../../../../test-support/organization-tenant-world.js";
import { findSystemRoleId } from "../../../../test-support/rbac-world.js";
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

interface Invitee {
  readonly person: ApiActor;
  readonly invited: InvitedPerson;
}

/** A new person, invited by email to be staff at the first location of org A. */
async function inviteNewPerson(world: TwoOrganizations): Promise<Invitee> {
  const person = await newActor(harness.app);
  const roleId = await findSystemRoleId(harness.connections, world.organizationA);
  const invited = await inviteEmailAs(world.alice, world.organizationA, {
    email: person.person.email,
    assignments: [{ locationId: world.locationA1, roleId }],
  });
  return { person, invited };
}

describe("GET /invitations/{token} (public)", () => {
  it("shows the organization, the inviter and a masked identifier without signing in", async () => {
    const world = await aWorld();
    const { invited, person } = await inviteNewPerson(world);

    const response = await callApi(harness.app, {
      method: "get",
      path: `/api/v1/invitations/${invited.token}`,
    });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      organizationName: "Org A",
      invitedByDisplayName: "Rahim Uddin",
      status: "PENDING",
    });
    expect(response.body.data.identifierHint).toMatch(/^p\*\*\*@example\.com$/);
    expect(JSON.stringify(response.body)).not.toContain(person.person.email);
  });

  it("answers 404 for an unknown token and 400 for a malformed one", async () => {
    const unknown = await callApi(harness.app, {
      method: "get",
      path: `/api/v1/invitations/${"A".repeat(43)}`,
    });
    const malformed = await callApi(harness.app, {
      method: "get",
      path: "/api/v1/invitations/short",
    });

    expect(unknown.status).toBe(404);
    expect(malformed.status).toBe(400);
  });

  it("is rate limited per address", async () => {
    const path = `/api/v1/invitations/${"B".repeat(43)}`;
    const ip = "198.51.100.7";
    let last = 0;

    for (let attempt = 0; attempt < 31; attempt += 1) {
      last = (await callApi(harness.app, { method: "get", path, ip })).status;
    }

    expect(last).toBe(429);
  });

  it("never writes the token to the access log or the error log", async () => {
    const world = await aWorld();
    const { invited, person } = await inviteNewPerson(world);
    await callApi(harness.app, { method: "get", path: `/api/v1/invitations/${invited.token}` });
    await person.call("post", `/invitations/${invited.token}/accept`);
    await person.call("post", `/invitations/${invited.token}/accept`);

    expect(harness.logs.text()).not.toContain(invited.token);
    expect(harness.logs.text()).toContain("/invitations/:token");
  });
});

describe("POST /invitations/{token}/accept", () => {
  it("makes the invited person an active member with the invited assignments", async () => {
    const world = await aWorld();
    const { invited, person } = await inviteNewPerson(world);

    const response = await person.call("post", `/invitations/${invited.token}/accept`);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      organizationId: world.organizationA,
      slug: expect.any(String),
      roleKeys: [SYSTEM_ROLE_KEY.STAFF],
    });
    const mine = await person.call("get", "/me/orgs");
    expect(mine.body.data.map((row: { organizationId: string }) => row.organizationId)).toContain(
      world.organizationA,
    );
    const member = await harness.connections.platform
      .collection("members")
      .findOne({ organizationId: world.organizationA, userId: person.userId });
    expect(member).toMatchObject({ status: "ACTIVE", displayName: "Rahim Uddin" });
    expect(member?.["employeeNumber"]).toMatch(/^\d+$/);
    expect(member?.["assignments"]).toHaveLength(1);
    const invitation = await harness.connections.platform
      .collection("invitations")
      .findOne({ invitationId: invited.invitationId });
    expect(invitation).toMatchObject({ status: "ACCEPTED", acceptedByUserId: person.userId });
    expect(
      await countAuditRows(harness.connections, {
        organizationId: world.organizationA,
        action: "organization.member.joined",
        entityId: member?.["memberId"],
      }),
    ).toBe(1);
    expect(
      await countOutboxRows(harness.connections, {
        organizationId: world.organizationA,
        type: "organization.member.joined",
        "payload.userId": person.userId,
      }),
    ).toBe(1);
    const inside = await person.call("get", `/orgs/${world.organizationA}/profile`);
    expect(inside.status).toBe(200);
  });

  it("refuses a signed-in person whose email or phone is not the invited one", async () => {
    const world = await aWorld();
    const { invited } = await inviteNewPerson(world);
    const stranger = await newActor(harness.app);

    const response = await stranger.call("post", `/invitations/${invited.token}/accept`);

    expect(response.status).toBe(403);
    expect(response.body.error.messageKey).toBe("errors.invitation_identifier_mismatch");
    const stillPending = await harness.connections.platform
      .collection("invitations")
      .findOne({ invitationId: invited.invitationId });
    expect(stillPending?.["status"]).toBe("PENDING");
  });

  it("answers 404 to a second accept", async () => {
    const world = await aWorld();
    const { invited, person } = await inviteNewPerson(world);
    await person.call("post", `/invitations/${invited.token}/accept`);

    const second = await person.call("post", `/invitations/${invited.token}/accept`);

    expect(second.status).toBe(404);
  });

  it("needs a signed-in user", async () => {
    const world = await aWorld();
    const { invited } = await inviteNewPerson(world);

    const response = await callApi(harness.app, {
      method: "post",
      path: `/api/v1/invitations/${invited.token}/accept`,
    });

    expect(response.status).toBe(401);
  });

  it("matches an invitation sent to a phone number", async () => {
    const world = await aWorld();
    const phone = `017${String(Date.now()).slice(-8)}`;
    const registered = await callApi(harness.app, {
      method: "post",
      path: "/api/v1/auth/register",
      body: { name: "Phone Person", phone, password: "correct horse battery staple" },
    });
    expect(registered.status).toBe(201);
    const roleId = await findSystemRoleId(harness.connections, world.organizationA);
    const invitation = await world.alice.call("post", `/orgs/${world.organizationA}/invitations`, {
      phone,
      assignments: [{ locationId: world.locationA1, roleId }],
    });
    const token = String(invitation.body.data.inviteUrlPath).split("/").pop();

    const response = await callApi(harness.app, {
      method: "post",
      path: `/api/v1/invitations/${token}/accept`,
      cookies: asCookies(readSessionCookies(registered)),
    });

    expect(response.status).toBe(200);
  });

  it("brings a removed member back as the same record", async () => {
    const world = await aWorld();
    await world.alice.call(
      "post",
      `/orgs/${world.organizationA}/members/${world.samMemberId}/remove`,
      {
        version: 1,
      },
    );
    const roleId = await findSystemRoleId(harness.connections, world.organizationA);
    const invited = await inviteEmailAs(world.alice, world.organizationA, {
      email: world.sam.person.email,
      assignments: [{ locationId: world.locationA2, roleId }],
    });

    const response = await world.sam.call("post", `/invitations/${invited.token}/accept`);

    expect(response.status).toBe(200);
    const member = await harness.connections.platform
      .collection("members")
      .findOne({ memberId: world.samMemberId });
    expect(member).toMatchObject({ status: "ACTIVE" });
    expect(member?.["assignments"]).toEqual([{ locationId: world.locationA2, roleId }]);
  });

  it("refuses when a role of the invitation was archived in the meantime", async () => {
    const world = await aWorld();
    const person = await newActor(harness.app);
    const role = await world.alice.call("post", `/orgs/${world.organizationA}/roles`, {
      name: "Temporary",
      permissionKeys: [],
    });
    const invited = await inviteEmailAs(world.alice, world.organizationA, {
      email: person.person.email,
      assignments: [{ locationId: world.locationA1, roleId: role.body.data.roleId }],
    });
    await world.alice.call(
      "post",
      `/orgs/${world.organizationA}/roles/${role.body.data.roleId}/archive`,
      {
        version: 1,
      },
    );

    const response = await person.call("post", `/invitations/${invited.token}/accept`);

    expect(response.status).toBe(422);
    expect(response.body.error.details).toMatchObject({ ruleKey: "ROLE_NOT_GRANTABLE" });
  });
});
