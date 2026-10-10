import { AUDIT_ACTION, AUDIT_ENTITY_TYPE, SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withTransaction } from "../../../../kernel/db/index.js";
import { registerIamApiModels, startIamApi } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import { MutableClock } from "../../../../test-support/mutable-clock.js";
import { withOrganizationContext } from "../../../../test-support/organization-context.js";
import { addMemberWithAssignments, findSystemRoleId } from "../../../../test-support/rbac-world.js";
import {
  createTwoOrganizations,
  type TwoOrganizations,
} from "../../../../test-support/two-organizations.js";
import { buildAuditRecorder } from "../index.js";

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

function auditPath(organizationId: string, query = ""): string {
  return `/orgs/${organizationId}/audit-logs${query}`;
}

function storedEntries(organizationId: string) {
  return harness.connections.tenantShared
    .collection("audit_logs")
    .find({ organizationId })
    .toArray();
}

interface EntryBody {
  action: string;
  entityType: string;
  entityId: string;
  actorUserId?: string;
  actorMemberId?: string;
  requestId: string;
  changes: Record<string, { from?: unknown; to?: unknown }>;
}

describe("audit entries of the business changes", () => {
  it("writes organization.organization.created with actor and request id", async () => {
    const world = await aWorld();

    const response = await world.alice.call("get", auditPath(world.organizationA));

    expect(response.status).toBe(200);
    const entries = response.body.data as EntryBody[];
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      action: AUDIT_ACTION.ORGANIZATION_CREATED,
      entityType: AUDIT_ENTITY_TYPE.organization,
      entityId: world.organizationA,
      actorUserId: world.alice.userId,
      changes: { name: { to: "Org A" } },
    });
    expect(entries[0]?.requestId).toBeTruthy();
  });

  it("writes role created, updated and archived entries with their changes and the member", async () => {
    const world = await aWorld();
    const base = `/orgs/${world.organizationA}/roles`;
    const created = await world.alice.call("post", base, {
      name: "Shift lead",
      permissionKeys: ["iam.role.read"],
    });
    const roleId = created.body.data.roleId as string;
    const updated = await world.alice.call("patch", `${base}/${roleId}`, {
      name: "Shift chief",
      version: created.body.data.version,
    });
    await world.alice.call("post", `${base}/${roleId}/archive`, {
      version: updated.body.data.version,
    });

    const response = await world.alice.call(
      "get",
      auditPath(world.organizationA, `?entityType=role&entityId=${roleId}`),
    );

    const entries = (response.body.data as EntryBody[]).reverse();
    expect(entries.map((entry) => entry.action)).toEqual([
      AUDIT_ACTION.ROLE_CREATED,
      AUDIT_ACTION.ROLE_UPDATED,
      AUDIT_ACTION.ROLE_ARCHIVED,
    ]);
    expect(entries[0]?.changes["name"]).toEqual({ to: "Shift lead" });
    expect(entries[1]?.changes["name"]).toEqual({ from: "Shift lead", to: "Shift chief" });
    expect(entries[2]?.changes["status"]).toEqual({ from: "ACTIVE", to: "ARCHIVED" });
    expect(entries[0]?.actorMemberId).toBeTruthy();
  });

  it("never stores a password hash or token in any entry", async () => {
    const world = await aWorld();
    await world.alice.call("post", `/orgs/${world.organizationA}/roles`, {
      name: "Plain role",
      permissionKeys: [],
    });

    const text = JSON.stringify(await storedEntries(world.organizationA));

    expect(text).not.toMatch(/argon2|passwordHash|token|secret/i);
  });
});

describe("the AuditRecorder port", () => {
  const recorder = buildAuditRecorder(new MutableClock());
  const entry = {
    action: AUDIT_ACTION.ROLE_CREATED,
    entityType: AUDIT_ENTITY_TYPE.role,
    entityId: newId(),
  } as const;

  it("throws outside a transaction", async () => {
    const organizationId = newId();

    await expect(
      withOrganizationContext(organizationId, () => recorder.record(entry)),
    ).rejects.toMatchObject({ messageKey: "errors.audit_needs_transaction" });
  });

  it("rolls back the entry together with the change when a failure follows", async () => {
    const organizationId = newId();

    await expect(
      withOrganizationContext(organizationId, () =>
        withTransaction(async () => {
          await recorder.record(entry);
          throw new Error("injected failure after the audit write");
        }),
      ),
    ).rejects.toThrow("injected failure");

    expect(await storedEntries(organizationId)).toHaveLength(0);
  });

  it("keeps the entry when the transaction commits, for the organization of the context", async () => {
    const organizationId = newId();

    await withOrganizationContext(organizationId, () =>
      withTransaction(() => recorder.record(entry)),
    );

    expect(await storedEntries(organizationId)).toHaveLength(1);
  });
});

describe("GET /audit-logs", () => {
  it("filters by entity type and actor and pages newest first", async () => {
    const world = await aWorld();
    const base = `/orgs/${world.organizationA}/roles`;
    await world.alice.call("post", base, { name: "One", permissionKeys: [] });
    await world.alice.call("post", base, { name: "Two", permissionKeys: [] });
    const path = auditPath(world.organizationA, "?entityType=role&limit=1");

    const first = await world.alice.call("get", path);
    const second = await world.alice.call("get", `${path}&page=2`);
    const future = await world.alice.call(
      "get",
      auditPath(world.organizationA, "?from=2999-01-01"),
    );
    const byActor = await world.alice.call(
      "get",
      auditPath(world.organizationA, `?actorUserId=${world.alice.userId}`),
    );

    expect(first.body.data[0].changes.name.to).toBe("Two");
    expect(first.body.meta).toEqual({ page: 1, limit: 1, hasNext: true });
    expect(second.body.data[0].changes.name.to).toBe("One");
    expect(future.body.data).toEqual([]);
    expect(byActor.body.data).toHaveLength(3);
  });

  it("lets a manager read, and denies staff with 403", async () => {
    const world = await aWorld();
    const managerRoleId = await findSystemRoleId(
      harness.connections,
      world.organizationA,
      SYSTEM_ROLE_KEY.MANAGER,
    );
    const manager = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: "ALL", roleId: managerRoleId },
    ]);

    const asManager = await manager.actor.call("get", auditPath(world.organizationA));
    const asStaff = await world.sam.call("get", auditPath(world.organizationA));

    expect(asManager.status).toBe(200);
    expect(asStaff.status).toBe(403);
    expect(asStaff.body.error.code).toBe("FORBIDDEN");
  });

  it("never shows another organization's entries and answers 404 for its path", async () => {
    const world = await aWorld();

    const own = await world.alice.call("get", auditPath(world.organizationA));
    const foreign = await world.alice.call("get", auditPath(world.organizationB));

    const ids = (own.body.data as EntryBody[]).map((entry) => entry.entityId);
    expect(ids).toEqual([world.organizationA]);
    expect(foreign.status).toBe(404);
  });

  it("answers 400 for a bad date and for a reversed range", async () => {
    const world = await aWorld();

    const badDate = await world.alice.call(
      "get",
      auditPath(world.organizationA, "?from=yesterday"),
    );
    const reversed = await world.alice.call(
      "get",
      auditPath(world.organizationA, "?from=2026-10-11&to=2026-10-01"),
    );

    expect(badDate.status).toBe(400);
    expect(badDate.body.error.code).toBe("VALIDATION_ERROR");
    expect(reversed.status).toBe(400);
  });
});
