import { ALL_LOCATIONS, SYSTEM_ROLE_KEY } from "@banijjik/contracts";
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

const VISIBLE_TO_ADMIN = { admin: true, storefront: false, bot: false };
const REDACTED = "[redacted]";

interface FieldSpec {
  readonly entityType: "organization" | "member";
  readonly fieldKey: string;
  readonly fieldType: string;
  readonly isRequired?: boolean;
  readonly isSensitive?: boolean;
  readonly isSearchable?: boolean;
  readonly options?: readonly string[];
}

function definitionOf(spec: FieldSpec): object {
  return {
    entityType: spec.entityType,
    fieldKey: spec.fieldKey,
    label: { bn: spec.fieldKey, en: spec.fieldKey },
    fieldType: spec.fieldType,
    isRequired: spec.isRequired ?? false,
    visibility: VISIBLE_TO_ADMIN,
    botAsk: false,
    isSearchable: spec.isSearchable ?? false,
    isSensitive: spec.isSensitive ?? false,
    sortOrder: 10,
    ...(spec.options === undefined ? {} : { options: spec.options }),
  };
}

const ORGANIZATION_FIELDS: readonly FieldSpec[] = [
  { entityType: "organization", fieldKey: "branch_code", fieldType: "TEXT" },
  { entityType: "organization", fieldKey: "tier", fieldType: "SELECT", options: ["GOLD", "BASIC"] },
  { entityType: "organization", fieldKey: "tax_note", fieldType: "TEXT", isSensitive: true },
  { entityType: "organization", fieldKey: "registrar", fieldType: "TEXT", isRequired: true },
];

const MEMBER_FIELDS: readonly FieldSpec[] = [
  { entityType: "member", fieldKey: "emergency_contact", fieldType: "PHONE" },
  { entityType: "member", fieldKey: "medical_notes", fieldType: "LONG_TEXT", isSensitive: true },
  { entityType: "member", fieldKey: "nid", fieldType: "TEXT", isSearchable: true },
];

async function defineFields(
  world: TwoOrganizations,
  specs: readonly FieldSpec[],
  organizationId: string = world.organizationA,
): Promise<void> {
  const owner = organizationId === world.organizationA ? world.alice : world.bob;
  for (const spec of specs) {
    const response = await owner.call(
      "post",
      `/orgs/${organizationId}/custom-fields`,
      definitionOf(spec),
    );
    if (response.status !== 201) throw new Error(`field ${spec.fieldKey}: ${response.status}`);
  }
}

async function aWorld(): Promise<TwoOrganizations> {
  const world = await createTwoOrganizations(harness.app, harness.connections, {
    industryTemplateKey: "RETAIL",
  });
  await defineFields(world, [...ORGANIZATION_FIELDS, ...MEMBER_FIELDS]);
  return world;
}

function profilePath(world: TwoOrganizations): string {
  return `/orgs/${world.organizationA}/profile`;
}

function memberPath(world: TwoOrganizations, memberId: string = world.samMemberId): string {
  return `/orgs/${world.organizationA}/members/${memberId}`;
}

/** The audit changes of the newest entry for the entity, in insertion order. */
async function latestAuditChanges(action: string, entityId: string) {
  const row = await harness.connections.tenantShared
    .collection("audit_logs")
    .find({ action, entityId })
    .sort({ _id: -1 })
    .limit(1)
    .next();
  return row?.["changes"];
}

/** A MANAGER at every location: may update members, but does not hold readSensitive. */
async function aManagerAtAllLocations(world: TwoOrganizations): Promise<ApiActor> {
  const managerRoleId = await findSystemRoleId(
    harness.connections,
    world.organizationA,
    SYSTEM_ROLE_KEY.MANAGER,
  );
  const manager = await addMemberWithAssignments(harness.app, world.organizationA, [
    { locationId: ALL_LOCATIONS, roleId: managerRoleId },
  ]);
  return manager.actor;
}

describe("PATCH /profile with custom fields", () => {
  it("saves an organization field and returns it with the profile", async () => {
    const world = await aWorld();

    const response = await world.alice.call("patch", profilePath(world), {
      customFields: { branch_code: "DHK-01", tier: "GOLD", registrar: "Rahim" },
      version: 1,
    });

    expect(response.status).toBe(200);
    expect(response.body.data.customFields).toEqual({
      branch_code: "DHK-01",
      tier: "GOLD",
      registrar: "Rahim",
    });
    const reread = await world.alice.call("get", profilePath(world));
    expect(reread.body.data.customFields).toEqual(response.body.data.customFields);
  });

  it("keeps a stored value when its key is absent and removes it with null", async () => {
    const world = await aWorld();
    await world.alice.call("patch", profilePath(world), {
      customFields: { branch_code: "DHK-01", tier: "GOLD", registrar: "Rahim" },
      version: 1,
    });

    const response = await world.alice.call("patch", profilePath(world), {
      customFields: { branch_code: null },
      version: 2,
    });

    expect(response.status).toBe(200);
    expect(response.body.data.customFields).toEqual({ tier: "GOLD", registrar: "Rahim" });
  });

  it("refuses null for a required field at customFields.<key>", async () => {
    const world = await aWorld();

    const response = await world.alice.call("patch", profilePath(world), {
      customFields: { registrar: null },
      version: 1,
    });

    expect(response.status).toBe(400);
    expect(response.body.error.details.fields).toEqual([
      expect.objectContaining({ path: "customFields.registrar" }),
    ]);
  });

  it("refuses an unknown key at customFields.<key>", async () => {
    const world = await aWorld();

    const response = await world.alice.call("patch", profilePath(world), {
      customFields: { not_a_field: "x" },
      version: 1,
    });

    expect(response.status).toBe(400);
    expect(response.body.error.details.fields).toEqual([
      expect.objectContaining({ path: "customFields.not_a_field" }),
    ]);
  });

  it("refuses a SELECT value outside its options", async () => {
    const world = await aWorld();

    const response = await world.alice.call("patch", profilePath(world), {
      customFields: { tier: "PLATINUM" },
      version: 1,
    });

    expect(response.status).toBe(400);
    expect(response.body.error.details.fields).toEqual([
      expect.objectContaining({ path: "customFields.tier" }),
    ]);
  });

  it("leaves the stored values and the version untouched when a value is refused", async () => {
    const world = await aWorld();
    await world.alice.call("patch", profilePath(world), {
      customFields: { branch_code: "DHK-01" },
      version: 1,
    });

    const refused = await world.alice.call("patch", profilePath(world), {
      customFields: { branch_code: "DHK-02", tier: "PLATINUM" },
      version: 2,
    });
    const reread = await world.alice.call("get", profilePath(world));

    expect(refused.status).toBe(400);
    expect(reread.body.data).toMatchObject({ customFields: { branch_code: "DHK-01" }, version: 2 });
  });

  it("writes the value to the audit log, and [redacted] on both sides for a sensitive field", async () => {
    const world = await aWorld();

    await world.alice.call("patch", profilePath(world), {
      customFields: { branch_code: "DHK-01", tax_note: "secret-123" },
      version: 1,
    });
    await world.alice.call("patch", profilePath(world), {
      customFields: { branch_code: "DHK-02", tax_note: "secret-456" },
      version: 2,
    });

    const changes = await latestAuditChanges(
      "organization.organization.updated",
      world.organizationA,
    );
    expect(changes).toMatchObject({
      "customFields.branch_code": { from: "DHK-01", to: "DHK-02" },
      "customFields.tax_note": { from: REDACTED, to: REDACTED },
    });
    expect(JSON.stringify(changes)).not.toContain("secret");
  });

  it("shows a sensitive value only to a caller who holds the profile edit at every location", async () => {
    const world = await aWorld();
    await world.alice.call("patch", profilePath(world), {
      customFields: { branch_code: "DHK-01", tax_note: "secret-123" },
      version: 1,
    });

    const owner = await world.alice.call("get", profilePath(world));
    const staff = await world.sam.call("get", profilePath(world));

    expect(owner.body.data.customFields).toEqual({ branch_code: "DHK-01", tax_note: "secret-123" });
    expect(staff.body.data.customFields).toEqual({ branch_code: "DHK-01" });
  });

  it("does not return the values of a field that was archived", async () => {
    const world = await aWorld();
    await world.alice.call("patch", profilePath(world), {
      customFields: { branch_code: "DHK-01", tier: "GOLD" },
      version: 1,
    });
    const definitions = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/custom-fields?entityType=organization`,
    );
    const branchCode = definitions.body.data.find(
      (field: { fieldKey: string }) => field.fieldKey === "branch_code",
    );

    await world.alice.call(
      "post",
      `/orgs/${world.organizationA}/custom-fields/${branchCode.customFieldDefinitionId}/archive`,
      { version: branchCode.version },
    );
    const reread = await world.alice.call("get", profilePath(world));

    expect(reread.body.data.customFields).toEqual({ tier: "GOLD" });
  });

  it("refuses a caller who may not edit the profile, and does not leak into /me/orgs", async () => {
    const world = await aWorld();
    await world.alice.call("patch", profilePath(world), {
      customFields: { tax_note: "secret-123" },
      version: 1,
    });

    const refused = await world.sam.call("patch", profilePath(world), {
      customFields: { branch_code: "X" },
      version: 2,
    });
    const myOrganizations = await world.alice.call("get", "/me/orgs");

    expect(refused.status).toBe(403);
    expect(JSON.stringify(myOrganizations.body)).not.toContain("secret-123");
  });
});

describe("PATCH /members/{memberId} with custom fields", () => {
  it("lets the owner save a phone (normalized to E.164) and a sensitive note", async () => {
    const world = await aWorld();

    const response = await world.alice.call("patch", memberPath(world), {
      customFields: { emergency_contact: "01712345678", medical_notes: "asthma" },
      version: 1,
    });

    expect(response.status).toBe(200);
    expect(response.body.data.customFields).toEqual({
      emergency_contact: "+8801712345678",
      medical_notes: "asthma",
    });
  });

  it("stores searchable values lower-cased for the search index", async () => {
    const world = await aWorld();

    await world.alice.call("patch", memberPath(world), {
      customFields: { nid: "AB-1234" },
      version: 1,
    });

    const row = await harness.connections.platform
      .collection("members")
      .findOne({ memberId: world.samMemberId });
    expect(row?.["customFieldSearch"]).toEqual([{ fieldKey: "nid", value: "ab-1234" }]);
  });

  it("hides a sensitive value from a manager without readSensitive", async () => {
    const world = await aWorld();
    await world.alice.call("patch", memberPath(world), {
      customFields: { emergency_contact: "01712345678", medical_notes: "asthma" },
      version: 1,
    });
    const manager = await aManagerAtAllLocations(world);

    const asManager = await manager.call("get", memberPath(world));
    const asOwner = await world.alice.call("get", memberPath(world));

    expect(asManager.body.data.customFields).toEqual({ emergency_contact: "+8801712345678" });
    expect(asOwner.body.data.customFields).toHaveProperty("medical_notes", "asthma");
  });

  it("hides the sensitive value from the answer of a manager's own update too", async () => {
    const world = await aWorld();
    const manager = await aManagerAtAllLocations(world);

    const response = await manager.call("patch", memberPath(world), {
      customFields: { medical_notes: "asthma", nid: "AB-1" },
      version: 1,
    });

    expect(response.status).toBe(200);
    expect(response.body.data.customFields).toEqual({ nid: "AB-1" });
  });

  it("records the member change without the sensitive value", async () => {
    const world = await aWorld();

    await world.alice.call("patch", memberPath(world), {
      customFields: { medical_notes: "asthma", nid: "AB-1" },
      version: 1,
    });

    const changes = await latestAuditChanges("organization.member.updated", world.samMemberId);
    expect(changes).toMatchObject({
      "customFields.nid": { to: "AB-1" },
      "customFields.medical_notes": { from: REDACTED, to: REDACTED },
    });
    expect(JSON.stringify(changes)).not.toContain("asthma");
  });

  it("refuses an invalid phone number and an unknown key at customFields.<key>", async () => {
    const world = await aWorld();

    const response = await world.alice.call("patch", memberPath(world), {
      customFields: { emergency_contact: "abc", blood_group: "A+" },
      version: 1,
    });

    expect(response.status).toBe(400);
    const paths = response.body.error.details.fields.map((field: { path: string }) => field.path);
    expect(paths.every((path: string) => path.startsWith("customFields."))).toBe(true);
  });

  it("answers 404 for a manager of one location editing a member outside their reach", async () => {
    const world = await aWorld();
    const managerRoleId = await findSystemRoleId(
      harness.connections,
      world.organizationA,
      SYSTEM_ROLE_KEY.MANAGER,
    );
    const staffRoleId = await findSystemRoleId(
      harness.connections,
      world.organizationA,
      SYSTEM_ROLE_KEY.STAFF,
    );
    const manager = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: world.locationA1, roleId: managerRoleId },
    ]);
    const outside = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: world.locationA2, roleId: staffRoleId },
    ]);

    const response = await manager.actor.call("patch", memberPath(world, outside.memberId), {
      customFields: { nid: "AB-1" },
      version: 1,
    });

    expect(response.status).toBe(404);
  });

  it("answers 404 for a member of another organization", async () => {
    const world = await aWorld();
    const other = await world.bob.call("get", `/orgs/${world.organizationB}/members`);
    const otherMemberId = other.body.data[0].memberId as string;

    const response = await world.alice.call("patch", memberPath(world, otherMemberId), {
      customFields: { nid: "AB-1" },
      version: 1,
    });

    expect(response.status).toBe(404);
  });
});

describe("custom field values stay out of lists", () => {
  it("returns no customFields in the member list", async () => {
    const world = await aWorld();
    await world.alice.call("patch", memberPath(world), {
      customFields: { nid: "AB-1", medical_notes: "asthma" },
      version: 1,
    });

    const list = await world.alice.call("get", `/orgs/${world.organizationA}/members?limit=100`);

    expect(list.status).toBe(200);
    expect(list.body.data.length).toBeGreaterThan(0);
    for (const row of list.body.data) expect(row).not.toHaveProperty("customFields");
    expect(JSON.stringify(list.body)).not.toContain("asthma");
  });
});
