import { IDEMPOTENCY_REPLAYED_HEADER, SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerIamApiModels, startIamApi } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import {
  countAuditRows,
  countOutboxRows,
  inviteEmailAs,
  tokenOf,
} from "../../../../test-support/organization-tenant-world.js";
import { findSystemRoleId } from "../../../../test-support/rbac-world.js";
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

function invitationsPath(organizationId: string, suffix = ""): string {
  return `/orgs/${organizationId}/invitations${suffix}`;
}

let issuedEmails = 0;

function freshEmail(): string {
  issuedEmails += 1;
  return `invitee${issuedEmails}@example.com`;
}

async function staffAt(world: TwoOrganizations): Promise<object[]> {
  const roleId = await findSystemRoleId(harness.connections, world.organizationA);
  return [{ locationId: world.locationA1, roleId }];
}

describe("POST /invitations", () => {
  it("creates a pending invitation and returns the link once", async () => {
    const world = await aWorld();
    const assignments = await staffAt(world);

    const response = await world.alice.call("post", invitationsPath(world.organizationA), {
      email: "New.Hire@Example.com",
      displayName: "New Hire",
      assignments,
    });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      email: "new.hire@example.com",
      displayName: "New Hire",
      status: "PENDING",
      invitedByUserId: world.alice.userId,
      version: 1,
    });
    expect(response.body.data.inviteUrlPath).toMatch(/^\/invitations\/[A-Za-z0-9_-]{43}$/);
    const expectedExpiry = harness.clock.now().getTime() + 7 * 24 * 60 * 60 * 1000;
    expect(new Date(response.body.data.expiresAt).getTime()).toBe(expectedExpiry);
    expect(response.body.data).not.toHaveProperty("tokenHash");
  });

  it("stores only the hash of the token and never logs the token", async () => {
    const world = await aWorld();
    const created = await world.alice.call("post", invitationsPath(world.organizationA), {
      email: freshEmail(),
      assignments: await staffAt(world),
    });
    const token = tokenOf(created.body.data.inviteUrlPath);
    await world.alice.call("get", invitationsPath(world.organizationA));

    const stored = await harness.connections.platform
      .collection("invitations")
      .findOne({ invitationId: created.body.data.invitationId });
    const idempotency = await harness.connections.platform
      .collection("idempotency_records")
      .find({ scopeId: world.organizationA })
      .toArray();

    expect(stored?.["tokenHash"]).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(stored)).not.toContain(token);
    expect(JSON.stringify(idempotency)).not.toContain(token);
    expect(harness.logs.text()).not.toContain(token);
  });

  it("answers a replay of the same Idempotency-Key without the link", async () => {
    const world = await aWorld();
    const call = {
      method: "post" as const,
      path: invitationsPath(world.organizationA),
      body: { email: freshEmail(), assignments: await staffAt(world) },
      idempotencyKey: newId(),
    };

    const first = await world.alice.callWith(call);
    const replay = await world.alice.callWith(call);

    expect(first.status).toBe(201);
    expect(first.body.data.inviteUrlPath).toBeDefined();
    expect(replay.status).toBe(201);
    expect(replay.headers[IDEMPOTENCY_REPLAYED_HEADER.toLowerCase()]).toBe("true");
    expect(replay.body.data.invitationId).toBe(first.body.data.invitationId);
    expect(replay.body.data.inviteUrlPath).toBeUndefined();
    expect(
      await harness.connections.platform
        .collection("invitations")
        .countDocuments({ organizationId: world.organizationA }),
    ).toBe(1);
  });

  it("writes one audit entry without the address and publishes an invited event with ids only", async () => {
    const world = await aWorld();
    const email = freshEmail();

    const response = await world.alice.call("post", invitationsPath(world.organizationA), {
      email,
      assignments: await staffAt(world),
    });

    const id = response.body.data.invitationId;
    expect(
      await countAuditRows(harness.connections, {
        organizationId: world.organizationA,
        action: "organization.invitation.created",
        entityId: id,
      }),
    ).toBe(1);
    const event = await harness.connections.platform
      .collection("outbox_events")
      .findOne({ organizationId: world.organizationA, type: "organization.member.invited" });
    expect(event?.["payload"]).toEqual({ invitationId: id });
    const audit = await harness.connections.tenantShared
      .collection("audit_logs")
      .findOne({ entityId: id });
    expect(JSON.stringify(audit)).not.toContain(email);
  });

  it("normalizes a phone number to E.164", async () => {
    const world = await aWorld();

    const response = await world.alice.call("post", invitationsPath(world.organizationA), {
      phone: "01711000111",
      assignments: await staffAt(world),
    });

    expect(response.body.data.phoneE164).toBe("+8801711000111");
    expect(response.body.data.email).toBeUndefined();
  });

  it.each([
    ["neither an email nor a phone number", () => ({})],
    ["both an email and a phone number", () => ({ email: "a@b.co", phone: "01711000111" })],
    ["no assignments", () => ({ email: "a@b.co", assignments: [] })],
    ["an invalid email", () => ({ email: "not-an-email" })],
  ])("refuses %s with a validation error", async (_description, makeBody) => {
    const world = await aWorld();
    const assignments = await staffAt(world);

    const response = await world.alice.call("post", invitationsPath(world.organizationA), {
      assignments,
      ...makeBody(),
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("needs the Idempotency-Key header", async () => {
    const world = await aWorld();

    const response = await world.alice.callWith({
      method: "post",
      path: invitationsPath(world.organizationA),
      body: { email: freshEmail(), assignments: await staffAt(world) },
      idempotencyKey: null,
    });

    expect(response.status).toBe(400);
  });

  it("refuses staff and answers 404 for another business", async () => {
    const world = await aWorld();
    const body = { email: freshEmail(), assignments: await staffAt(world) };

    const staff = await world.sam.call("post", invitationsPath(world.organizationA), body);
    const foreign = await world.alice.call("post", invitationsPath(world.organizationB), body);

    expect(staff.status).toBe(403);
    expect(foreign.status).toBe(404);
    expect(
      await harness.connections.platform
        .collection("invitations")
        .countDocuments({ organizationId: { $in: [world.organizationA, world.organizationB] } }),
    ).toBe(0);
  });

  it("refuses an address that already belongs to a member, but not a removed one", async () => {
    const world = await aWorld();
    const body = { email: world.sam.person.email, assignments: await staffAt(world) };

    const active = await world.alice.call("post", invitationsPath(world.organizationA), body);
    await world.alice.call(
      "post",
      `/orgs/${world.organizationA}/members/${world.samMemberId}/remove`,
      {
        version: 1,
      },
    );
    const afterRemoval = await world.alice.call("post", invitationsPath(world.organizationA), body);

    expect(active.status).toBe(409);
    expect(active.body.error).toMatchObject({ code: "DUPLICATE", details: { field: "email" } });
    expect(afterRemoval.status).toBe(201);
  });

  it("counts pending invitations against the members limit", async () => {
    const world = await aWorld();
    const assignments = [
      {
        locationId: world.locationB1,
        roleId: await findSystemRoleId(
          harness.connections,
          world.organizationB,
          SYSTEM_ROLE_KEY.STAFF,
        ),
      },
    ];
    // The BUNDLE trial allows 10 members: the owner plus nine pending invitations fill it.
    for (let count = 0; count < 9; count += 1) {
      await inviteEmailAs(world.bob, world.organizationB, { email: freshEmail(), assignments });
    }

    const tenth = await world.bob.call("post", invitationsPath(world.organizationB), {
      email: freshEmail(),
      assignments,
    });

    expect(tenth.status).toBe(422);
    expect(tenth.body.error).toMatchObject({
      code: "LIMIT_REACHED",
      details: { limitKey: "members", limit: 10 },
    });
  });
});

describe("GET /invitations", () => {
  it("lists the invitations of the business, newest first, filtered by status", async () => {
    const world = await aWorld();
    const assignments = await staffAt(world);
    const first = await inviteEmailAs(world.alice, world.organizationA, {
      email: freshEmail(),
      assignments,
    });
    await inviteEmailAs(world.alice, world.organizationA, { email: freshEmail(), assignments });
    await world.alice.call(
      "post",
      invitationsPath(world.organizationA, `/${first.invitationId}/revoke`),
      {
        version: 1,
      },
    );

    const all = await world.alice.call("get", invitationsPath(world.organizationA));
    const revoked = await world.alice.call(
      "get",
      `${invitationsPath(world.organizationA)}?status=REVOKED`,
    );
    const pending = await world.alice.call(
      "get",
      `${invitationsPath(world.organizationA)}?status=PENDING`,
    );

    expect(all.body.data).toHaveLength(2);
    expect(revoked.body.data.map((row: { invitationId: string }) => row.invitationId)).toEqual([
      first.invitationId,
    ]);
    expect(pending.body.data).toHaveLength(1);
    expect(JSON.stringify(all.body)).not.toContain("inviteUrlPath");
  });

  it("refuses staff and never shows the invitations of another business", async () => {
    const world = await aWorld();
    await inviteEmailAs(world.bob, world.organizationB, {
      email: freshEmail(),
      assignments: [
        {
          locationId: world.locationB1,
          roleId: await findSystemRoleId(harness.connections, world.organizationB),
        },
      ],
    });

    const staff = await world.sam.call("get", invitationsPath(world.organizationA));
    const own = await world.alice.call("get", invitationsPath(world.organizationA));

    expect(staff.status).toBe(403);
    expect(own.body.data).toEqual([]);
  });
});

describe("POST /invitations/{invitationId}/revoke", () => {
  it("revokes a pending invitation with an audit entry and an event, and kills the link", async () => {
    const world = await aWorld();
    const invited = await inviteEmailAs(world.alice, world.organizationA, {
      email: freshEmail(),
      assignments: await staffAt(world),
    });

    const response = await world.alice.call(
      "post",
      invitationsPath(world.organizationA, `/${invited.invitationId}/revoke`),
      { version: 1 },
    );
    const preview = await world.alice.call("get", `/invitations/${invited.token}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ status: "REVOKED", version: 2 });
    expect(preview.status).toBe(404);
    expect(
      await countAuditRows(harness.connections, {
        organizationId: world.organizationA,
        action: "organization.invitation.revoked",
      }),
    ).toBe(1);
    expect(
      await countOutboxRows(harness.connections, {
        organizationId: world.organizationA,
        type: "organization.invitation.revoked",
      }),
    ).toBe(1);
  });

  it("refuses a second revoke, a stale version, staff and another business", async () => {
    const world = await aWorld();
    const invited = await inviteEmailAs(world.alice, world.organizationA, {
      email: freshEmail(),
      assignments: await staffAt(world),
    });
    const path = invitationsPath(world.organizationA, `/${invited.invitationId}/revoke`);

    const stale = await world.alice.call("post", path, { version: 4 });
    const staff = await world.sam.call("post", path, { version: 1 });
    const foreign = await world.bob.call(
      "post",
      invitationsPath(world.organizationB, `/${invited.invitationId}/revoke`),
      { version: 1 },
    );
    await world.alice.call("post", path, { version: 1 });
    const again = await world.alice.call("post", path, { version: 2 });

    expect(stale.status).toBe(409);
    expect(staff.status).toBe(403);
    expect(foreign.status).toBe(404);
    expect(again.status).toBe(409);
    expect(again.body.error).toMatchObject({
      code: "INVALID_TRANSITION",
      details: { currentStatus: "REVOKED" },
    });
  });
});
