import { SYSTEM_ROLE_KEY, type SystemRoleKey } from "@banijjik/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerIamApiModels, startIamApi } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import {
  countAuditRows,
  countOutboxRows,
} from "../../../../test-support/organization-tenant-world.js";
import { addMemberWithAssignments, findSystemRoleId } from "../../../../test-support/rbac-world.js";
import {
  asCustomerCookies,
  callStorefront,
  enableCustomerLogin,
  signInCustomer,
  type SignedInCustomer,
} from "../../../../test-support/storefront-world.js";
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

interface World {
  readonly organizations: TwoOrganizations;
  readonly customer: SignedInCustomer;
  readonly contactId: string;
}

async function aWorldWithCustomer(): Promise<World> {
  const organizations = await createTwoOrganizations(harness.app, harness.connections, {
    industryTemplateKey: "RETAIL",
  });
  await enableCustomerLogin(organizations, organizations.organizationA);
  const customer = await signInCustomer(harness, organizations.organizationA);
  return {
    organizations,
    customer,
    contactId: customer.verifyResponse.body.data.contactId as string,
  };
}

function accountPath(world: World, suffix = ""): string {
  return `/orgs/${world.organizations.organizationA}/contacts/${world.contactId}/customer-account${suffix}`;
}

async function memberWithRole(world: World, roleKey: SystemRoleKey) {
  const roleId = await findSystemRoleId(
    harness.connections,
    world.organizations.organizationA,
    roleKey,
  );
  const added = await addMemberWithAssignments(harness.app, world.organizations.organizationA, [
    { locationId: "ALL", roleId },
  ]);
  return added.actor;
}

function customerCall(world: World, method: "get" | "post", suffix: string) {
  return callStorefront(harness.app, {
    method,
    organizationId: world.organizations.organizationA,
    suffix,
    cookies: asCustomerCookies(world.customer.session),
  });
}

describe("staff view of a website login", () => {
  it("shows the status and the last sign-in to the owner", async () => {
    const world = await aWorldWithCustomer();

    const response = await world.organizations.alice.call("get", accountPath(world));

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      contactId: world.contactId,
      status: "ACTIVE",
      blockedAt: null,
      version: 2,
    });
    expect(response.body.data.lastLoginAt).toEqual(expect.any(String));
  });

  it("answers 404 for a contact that never signed in", async () => {
    const world = await aWorldWithCustomer();
    const plain = await world.organizations.alice.call(
      "post",
      `/orgs/${world.organizations.organizationA}/contacts`,
      { contactType: "PERSON", contactRoles: ["CUSTOMER"], name: "Walk In" },
    );

    const response = await world.organizations.alice.call(
      "get",
      `/orgs/${world.organizations.organizationA}/contacts/${plain.body.data.contactId}/customer-account`,
    );

    expect(response.status).toBe(404);
  });

  it("lets staff read but not block, and a rider or viewer not even read", async () => {
    const world = await aWorldWithCustomer();
    const staff = await memberWithRole(world, SYSTEM_ROLE_KEY.STAFF);
    const viewer = await memberWithRole(world, SYSTEM_ROLE_KEY.VIEWER);

    expect((await staff.call("get", accountPath(world))).status).toBe(200);
    expect((await staff.call("post", accountPath(world, "/block"), { version: 2 })).status).toBe(
      403,
    );
    expect((await viewer.call("get", accountPath(world))).status).toBe(403);
    expect((await viewer.call("post", accountPath(world, "/block"), { version: 2 })).status).toBe(
      403,
    );
  });

  it("answers 404 across organizations", async () => {
    const world = await aWorldWithCustomer();
    const { bob, organizationB } = world.organizations;

    const read = await bob.call(
      "get",
      `/orgs/${organizationB}/contacts/${world.contactId}/customer-account`,
    );
    const block = await bob.call(
      "post",
      `/orgs/${organizationB}/contacts/${world.contactId}/customer-account/block`,
      { version: 2 },
    );

    expect(read.status).toBe(404);
    expect(block.status).toBe(404);
  });
});

describe("blocking a website login", () => {
  it("ends the sessions at once, closes the account within the cache window and audits it", async () => {
    const world = await aWorldWithCustomer();
    expect((await customerCall(world, "get", "/me")).status).toBe(200);
    const auditBefore = await countAuditRows(harness.connections, {
      action: "contact.customerAccount.blocked",
    });
    const eventsBefore = await countOutboxRows(harness.connections, {
      type: "contact.customerAccount.blocked",
    });

    const blocked = await world.organizations.alice.call("post", accountPath(world, "/block"), {
      version: 2,
    });
    const refresh = await customerCall(world, "post", "/auth/refresh");
    harness.clock.advanceSeconds(61);
    const me = await customerCall(world, "get", "/me");

    expect(blocked.status).toBe(200);
    expect(blocked.body.data).toMatchObject({ status: "BLOCKED", version: 3 });
    expect(refresh.status).toBe(401);
    expect(me.status).toBe(401);
    expect(
      await countAuditRows(harness.connections, { action: "contact.customerAccount.blocked" }),
    ).toBe(auditBefore + 1);
    expect(
      await countOutboxRows(harness.connections, { type: "contact.customerAccount.blocked" }),
    ).toBe(eventsBefore + 1);
  });

  it("restores sign-in when unblocked", async () => {
    const world = await aWorldWithCustomer();
    await world.organizations.alice.call("post", accountPath(world, "/block"), { version: 2 });

    const unblocked = await world.organizations.alice.call("post", accountPath(world, "/unblock"), {
      version: 3,
    });
    const again = await signInCustomer(
      harness,
      world.organizations.organizationA,
      world.customer.phone,
    );

    expect(unblocked.body.data).toMatchObject({ status: "ACTIVE", blockedAt: null });
    expect(again.verifyResponse.body.data.customerAccountId).toBe(
      world.customer.verifyResponse.body.data.customerAccountId,
    );
  });

  it("refuses a stale version with 409 and a second block with 409", async () => {
    const world = await aWorldWithCustomer();

    const stale = await world.organizations.alice.call("post", accountPath(world, "/block"), {
      version: 1,
    });
    await world.organizations.alice.call("post", accountPath(world, "/block"), { version: 2 });
    const twice = await world.organizations.alice.call("post", accountPath(world, "/block"), {
      version: 3,
    });

    expect(stale.status).toBe(409);
    expect(twice.status).toBe(409);
  });

  it("refuses a request without a version with a validation error", async () => {
    const world = await aWorldWithCustomer();

    const response = await world.organizations.alice.call("post", accountPath(world, "/block"), {});

    expect(response.status).toBe(400);
  });
});

describe("ending a contact ends its website login", () => {
  it("deletes the account and its sessions when the contact is anonymized, with an audit entry and an event", async () => {
    const world = await aWorldWithCustomer();
    const contactPath = `/orgs/${world.organizations.organizationA}/contacts/${world.contactId}`;
    const auditBefore = await countAuditRows(harness.connections, {
      action: "contact.customerAccount.ended",
    });
    const eventsBefore = await countOutboxRows(harness.connections, {
      type: "contact.customerAccount.ended",
    });

    const anonymized = await world.organizations.alice.call("post", `${contactPath}/anonymize`, {
      version: 1,
      reason: "customer asked",
    });
    const refresh = await customerCall(world, "post", "/auth/refresh");
    const account = await world.organizations.alice.call("get", accountPath(world));
    const again = await signInCustomer(
      harness,
      world.organizations.organizationA,
      world.customer.phone,
    );

    expect(anonymized.status).toBe(200);
    expect(refresh.status).toBe(401);
    expect(account.status).toBe(404);
    expect(again.verifyResponse.body.data.contactId).not.toBe(world.contactId);
    expect(
      await countAuditRows(harness.connections, { action: "contact.customerAccount.ended" }),
    ).toBe(auditBefore + 1);
    expect(
      await countOutboxRows(harness.connections, { type: "contact.customerAccount.ended" }),
    ).toBe(eventsBefore + 1);
  });

  it("does the same when the contact is archived", async () => {
    const world = await aWorldWithCustomer();
    const contactPath = `/orgs/${world.organizations.organizationA}/contacts/${world.contactId}`;

    const archived = await world.organizations.alice.call("post", `${contactPath}/archive`, {
      version: 1,
    });
    const refresh = await customerCall(world, "post", "/auth/refresh");

    expect(archived.status).toBe(200);
    expect(refresh.status).toBe(401);
  });
});
