import { PERMISSION_KEY } from "@banijjik/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { outboxModel } from "../../../../test-support/event-fixtures.js";
import { registerIamApiModels, startIamApi } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import { createTwoOrganizations } from "../../../../test-support/two-organizations.js";

registerIamApiModels();

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startIamApi();
});

afterAll(async () => {
  await harness.dispose();
});

async function typesFor(organizationId: string | null): Promise<string[]> {
  const rows = await outboxModel().find({ organizationId }).sort({ createdAt: 1 }).lean();
  return rows.map((row) => row.type);
}

describe("domain events from the iam and organization use cases", () => {
  it("emits iam.user.registered with no organization when a person registers", async () => {
    const before = await outboxModel().countDocuments({ type: "iam.user.registered" });
    const world = await createTwoOrganizations(harness.app, harness.connections, {
      industryTemplateKey: "RETAIL",
    });

    const rows = await outboxModel().find({ type: "iam.user.registered" }).lean();

    expect(rows.length - before).toBe(3);
    const alice = rows.find((row) => row.payload["userId"] === world.alice.userId);
    expect(alice).toMatchObject({ organizationId: null, actorUserId: null, status: "PENDING" });
  });

  it("emits the three organization events together when an organization is created", async () => {
    const world = await createTwoOrganizations(harness.app, harness.connections, {
      industryTemplateKey: "RETAIL",
    });

    const types = await typesFor(world.organizationA);

    expect(types.sort()).toEqual([
      "organization.location.created",
      "organization.member.joined",
      "organization.organization.created",
    ]);
    const created = await outboxModel()
      .findOne({ organizationId: world.organizationA, type: "organization.organization.created" })
      .lean();
    expect(created?.actorUserId).toBe(world.alice.userId);
    expect(Object.keys(created?.payload ?? {}).sort()).toEqual([
      "organizationId",
      "organizationSlug",
    ]);
  });

  it("emits role events, and a rename alone emits no permissionsChanged", async () => {
    const world = await createTwoOrganizations(harness.app, harness.connections, {
      industryTemplateKey: "RETAIL",
    });
    const path = `/orgs/${world.organizationA}/roles`;
    const created = await world.alice.call("post", path, {
      name: "Shift lead",
      permissionKeys: [PERMISSION_KEY.IAM_ROLE_READ],
    });
    const role = created.body.data as { roleId: string; version: number };

    const renamed = await world.alice.call("patch", `${path}/${role.roleId}`, {
      name: "Shift chief",
      version: role.version,
    });
    const changed = await world.alice.call("patch", `${path}/${role.roleId}`, {
      permissionKeys: [PERMISSION_KEY.IAM_ROLE_READ, PERMISSION_KEY.ORGANIZATION_LOCATION_READ],
      version: (renamed.body.data as { version: number }).version,
    });
    await world.alice.call("post", `${path}/${role.roleId}/archive`, {
      version: (changed.body.data as { version: number }).version,
    });

    const types = (await typesFor(world.organizationA)).filter((type) =>
      type.startsWith("iam.role."),
    );
    expect(types).toEqual(["iam.role.created", "iam.role.permissionsChanged", "iam.role.archived"]);
  });

  it("leaves no event behind when the request is refused", async () => {
    const world = await createTwoOrganizations(harness.app, harness.connections, {
      industryTemplateKey: "RETAIL",
    });
    const before = await outboxModel().countDocuments({ organizationId: world.organizationA });

    const refused = await world.alice.call("post", `/orgs/${world.organizationA}/roles`, {
      name: "Bad role",
      permissionKeys: ["not.a.real.key"],
    });

    expect(refused.status).toBeGreaterThanOrEqual(400);
    expect(await outboxModel().countDocuments({ organizationId: world.organizationA })).toBe(
      before,
    );
  });
});
