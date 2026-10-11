import {
  ORGANIZATION_EVENT_TYPE,
  PLATFORM_AUDIT_ACTION,
  PLATFORM_ROLE,
  SUBSCRIPTION_STATUS,
  type PlatformRole,
} from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  registerIamApiModels,
  startIamApi,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";
import {
  createOrganizationAs,
  newActor,
} from "../../../../test-support/organization-tenant-world.js";
import {
  createPlatformActor,
  type PlatformActor,
} from "../../../../test-support/platform-world.js";
import type { ApiActor } from "../../../../test-support/two-organizations.js";

registerIamApiModels();

let harness: IamApiHarness;
let superAdmin: PlatformActor;

beforeAll(async () => {
  harness = await startIamApi();
  superAdmin = await createPlatformActor(harness.app, harness.connections, [
    PLATFORM_ROLE.SUPER_ADMIN,
  ]);
});

afterAll(async () => {
  await harness.dispose();
});

interface Tenant {
  readonly owner: ApiActor;
  readonly organizationId: string;
}

async function createTenant(): Promise<Tenant> {
  const owner = await newActor(harness.app);
  const { organizationId } = await createOrganizationAs(owner, harness.connections, {
    industryTemplateKey: "RETAIL",
  });
  return { owner, organizationId };
}

function platformRows(collection: string, filter: object) {
  return harness.connections.platform.collection(collection).find(filter).toArray();
}

describe("suspending an organization (roadmap Done)", () => {
  it("gives the members a clear ORG_SUSPENDED answer on the very next request, and reactivating opens it again", async () => {
    const { owner, organizationId } = await createTenant();
    expect((await owner.call("get", `/orgs/${organizationId}/me/config`)).status).toBe(200);

    const suspended = await superAdmin.call("post", `/organizations/${organizationId}/suspend`, {
      reason: "unpaid invoice",
    });
    const blocked = await owner.call("get", `/orgs/${organizationId}/me/config`);

    expect(suspended.status).toBe(200);
    expect(suspended.body.data.status).toBe("SUSPENDED");
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe("ORG_SUSPENDED");

    const reactivated = await superAdmin.call(
      "post",
      `/organizations/${organizationId}/reactivate`,
      { reason: "paid" },
    );
    expect(reactivated.status).toBe(200);
    expect((await owner.call("get", `/orgs/${organizationId}/me/config`)).status).toBe(200);
  });

  it("writes the event with the organization and one platform audit entry per change", async () => {
    const { organizationId } = await createTenant();

    await superAdmin.call("post", `/organizations/${organizationId}/suspend`, { reason: "abuse" });
    await superAdmin.call("post", `/organizations/${organizationId}/reactivate`, { reason: "ok" });

    const events = await platformRows("outbox_events", {
      organizationId,
      type: {
        $in: [
          ORGANIZATION_EVENT_TYPE.ORGANIZATION_SUSPENDED,
          ORGANIZATION_EVENT_TYPE.ORGANIZATION_REACTIVATED,
        ],
      },
    });
    const entries = await platformRows("platform_audit_logs", { organizationId });
    expect(events.map((event) => event["type"]).sort()).toEqual([
      ORGANIZATION_EVENT_TYPE.ORGANIZATION_REACTIVATED,
      ORGANIZATION_EVENT_TYPE.ORGANIZATION_SUSPENDED,
    ]);
    expect(entries.map((entry) => entry["action"]).sort()).toEqual([
      PLATFORM_AUDIT_ACTION.TENANT_REACTIVATED,
      PLATFORM_AUDIT_ACTION.TENANT_SUSPENDED,
    ]);
    const suspension = entries.find(
      (entry) => entry["action"] === PLATFORM_AUDIT_ACTION.TENANT_SUSPENDED,
    );
    expect(suspension).toMatchObject({
      reason: "abuse",
      actorPlatformOperatorId: superAdmin.platformOperatorId,
      changes: { status: { from: "ACTIVE", to: "SUSPENDED" } },
    });
  });

  it("answers 409 for a transition the status does not allow, and 404 for an unknown organization", async () => {
    const { organizationId } = await createTenant();

    const notSuspended = await superAdmin.call(
      "post",
      `/organizations/${organizationId}/reactivate`,
      { reason: "x" },
    );
    const unknown = await superAdmin.call("post", `/organizations/${newId()}/suspend`, {
      reason: "x",
    });
    const noReason = await superAdmin.call("post", `/organizations/${organizationId}/suspend`, {});

    expect(notSuspended.status).toBe(409);
    expect(notSuspended.body.error.code).toBe("INVALID_TRANSITION");
    expect(unknown.status).toBe(404);
    expect(noReason.status).toBe(400);
    expect(await platformRows("platform_audit_logs", { organizationId })).toEqual([]);
  });
});

interface PermissionCase {
  readonly role: PlatformRole;
  readonly name: string;
  readonly isAllowed: boolean;
  readonly request: (organizationId: string) => {
    method: "get" | "post";
    path: string;
    body?: object;
  };
}

const FULL_LIMITS = {
  locations: 1,
  members: 1,
  offerings: 1,
  ordersPerMonth: 1,
  aiMessagesPerMonth: 1,
  smsPerMonth: 1,
  channels: 1,
  posDevices: 1,
};

const PERMISSION_CASES: readonly PermissionCase[] = [
  ...[PLATFORM_ROLE.SUPPORT, PLATFORM_ROLE.BILLING].map((role) => ({
    role,
    name: "read the tenant list",
    isAllowed: true,
    request: () => ({ method: "get" as const, path: "/organizations" }),
  })),
  {
    role: PLATFORM_ROLE.SUPPORT,
    name: "suspend a tenant",
    isAllowed: true,
    request: (id) => ({
      method: "post",
      path: `/organizations/${id}/suspend`,
      body: { reason: "x" },
    }),
  },
  {
    role: PLATFORM_ROLE.BILLING,
    name: "suspend a tenant",
    isAllowed: false,
    request: (id) => ({
      method: "post",
      path: `/organizations/${id}/suspend`,
      body: { reason: "x" },
    }),
  },
  {
    role: PLATFORM_ROLE.SUPPORT,
    name: "create a package",
    isAllowed: false,
    request: () => ({
      method: "post",
      path: "/packages",
      body: { packageKey: "SUPPORT_TRY", isAddOn: true, moduleKeys: [], limits: FULL_LIMITS },
    }),
  },
  {
    role: PLATFORM_ROLE.BILLING,
    name: "create a package",
    isAllowed: true,
    request: () => ({
      method: "post",
      path: "/packages",
      body: { packageKey: "BILLING_TRY", isAddOn: true, moduleKeys: [], limits: FULL_LIMITS },
    }),
  },
  {
    role: PLATFORM_ROLE.SUPPORT,
    name: "grant a module",
    isAllowed: false,
    request: (id) => ({
      method: "post",
      path: `/organizations/${id}/module-overrides`,
      body: { moduleKey: "pos", effect: "PLATFORM_GRANT", reason: "x" },
    }),
  },
  {
    role: PLATFORM_ROLE.SUPPORT,
    name: "extend a trial",
    isAllowed: false,
    request: (id) => ({
      method: "post",
      path: `/organizations/${id}/subscription/extend-trial`,
      body: { days: 3, reason: "x" },
    }),
  },
  {
    role: PLATFORM_ROLE.BILLING,
    name: "extend a trial",
    isAllowed: true,
    request: (id) => ({
      method: "post",
      path: `/organizations/${id}/subscription/extend-trial`,
      body: { days: 3, reason: "x" },
    }),
  },
  ...[PLATFORM_ROLE.SUPPORT, PLATFORM_ROLE.BILLING].map((role) => ({
    role,
    name: "read the platform audit log",
    isAllowed: false,
    request: () => ({ method: "get" as const, path: "/audit-logs" }),
  })),
];

describe("platform permissions follow the role mapping", () => {
  it.each(PERMISSION_CASES)("$role is allowed to $name: $isAllowed", async (permissionCase) => {
    const operator = await createPlatformActor(harness.app, harness.connections, [
      permissionCase.role,
    ]);
    const { organizationId } = await createTenant();
    const { method, path, body } = permissionCase.request(organizationId);

    const response = await operator.call(method, path, body);

    expect(response.status === 403).toBe(!permissionCase.isAllowed);
  });
});

describe("tenant list and detail", () => {
  it("pages, searches by name or slug prefix and filters by status", async () => {
    const first = await createTenant();
    const second = await createTenant();
    await superAdmin.call("post", `/organizations/${second.organizationId}/suspend`, {
      reason: "x",
    });

    const page = await superAdmin.call("get", "/organizations?limit=1");
    const suspended = await superAdmin.call("get", "/organizations?status=SUSPENDED&limit=100");
    const bySlug = await superAdmin.call("get", "/organizations?q=tenant-world&limit=100");
    const none = await superAdmin.call("get", "/organizations?q=zz-no-such-prefix");

    expect(page.body.data).toHaveLength(1);
    expect(page.body.meta).toMatchObject({ limit: 1, hasNext: true });
    const suspendedIds = suspended.body.data.map(
      (row: { organizationId: string }) => row.organizationId,
    );
    expect(suspendedIds).toContain(second.organizationId);
    expect(suspendedIds).not.toContain(first.organizationId);
    expect(bySlug.body.data.length).toBeGreaterThanOrEqual(2);
    expect(none.body.data).toEqual([]);
  });

  it("shows the member count, the subscription status and the template, and never the _id", async () => {
    const { organizationId } = await createTenant();

    const response = await superAdmin.call("get", "/organizations?q=tenant-world&limit=100");

    const row = response.body.data.find(
      (entry: { organizationId: string }) => entry.organizationId === organizationId,
    );
    expect(row).toMatchObject({
      memberCount: 1,
      subscriptionStatus: SUBSCRIPTION_STATUS.TRIALING,
      templateKey: "RETAIL",
      status: "ACTIVE",
    });
    expect(JSON.stringify(response.body)).not.toContain("_id");
  });

  it("reads a page with a fixed number of queries whatever its size", async () => {
    await createTenant();
    await createTenant();
    const counts: number[] = [];
    for (const limit of [1, 5]) {
      const queries = vi.spyOn(mongoose.Query.prototype, "exec");
      const aggregates = vi.spyOn(mongoose.Aggregate.prototype, "exec");
      await superAdmin.call("get", `/organizations?limit=${limit}`);
      counts.push(queries.mock.calls.length + aggregates.mock.calls.length);
      vi.restoreAllMocks();
    }

    expect(counts[0]).toBeGreaterThan(0);
    expect(counts[1]).toBe(counts[0]);
  });

  it("shows the detail with the owner contact masked", async () => {
    const { owner, organizationId } = await createTenant();

    const response = await superAdmin.call("get", `/organizations/${organizationId}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      organizationId,
      locationCount: 1,
      memberCount: 1,
      owner: { displayName: "Rahim Uddin" },
      subscription: { status: SUBSCRIPTION_STATUS.TRIALING, basePackageKey: "BUNDLE" },
      moduleOverrides: [],
    });
    expect(response.body.data.owner.maskedIdentifier).toMatch(/^p\*\*\*@example\.com$/);
    expect(JSON.stringify(response.body)).not.toContain(owner.person.email);
  });

  it("answers 404 for an unknown organization and 400 for a malformed ID", async () => {
    const unknown = await superAdmin.call("get", `/organizations/${newId()}`);
    const malformed = await superAdmin.call("get", "/organizations/not-an-id");

    expect(unknown.status).toBe(404);
    expect(malformed.status).toBe(400);
  });

  it("writes no audit entry for reads and logs the system access", async () => {
    const { organizationId } = await createTenant();

    await superAdmin.call("get", `/organizations/${organizationId}`);

    expect(await platformRows("platform_audit_logs", { organizationId })).toEqual([]);
    const reasons = harness.logs
      .lines()
      .filter((line) => line["event"] === "system_access")
      .map((line) => line["reason"]);
    expect(reasons).toContain("PLATFORM_ADMIN");
  });
});

describe("GET /platform/audit-logs", () => {
  it("lets a SUPER_ADMIN page through the entries of one organization, newest first", async () => {
    const { organizationId } = await createTenant();
    await superAdmin.call("post", `/organizations/${organizationId}/suspend`, { reason: "a" });
    await superAdmin.call("post", `/organizations/${organizationId}/reactivate`, { reason: "b" });

    const response = await superAdmin.call(
      "get",
      `/audit-logs?organizationId=${organizationId}&limit=1`,
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].action).toBe(PLATFORM_AUDIT_ACTION.TENANT_REACTIVATED);
    expect(response.body.meta.hasNext).toBe(true);
  });
});
