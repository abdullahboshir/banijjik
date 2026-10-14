import { MODULE_CLASS, MODULE_KEY, SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { asId, type OrganizationId, type UserId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { defineModule } from "../../../kernel/modules/index.js";
import { CustomFieldDefinition } from "./domain/custom-field-definition.entity.js";
import { MongoCustomFieldDefinitionRepository } from "./infrastructure/mongo-custom-field-definition.repository.js";
import { registerIamApiModels, startIamApi } from "../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../test-support/iam-api-harness.js";
import { withOrganizationContext } from "../../../test-support/organization-context.js";
import {
  countAuditRows,
  countOutboxRows,
} from "../../../test-support/organization-tenant-world.js";
import { addMemberWithAssignments, findSystemRoleId } from "../../../test-support/rbac-world.js";
import {
  createTwoOrganizations,
  type TwoOrganizations,
} from "../../../test-support/two-organizations.js";

registerIamApiModels();

const CONTACT_PROBE = defineModule({
  key: MODULE_KEY.CONTACT,
  path: "core/contact",
  moduleClass: MODULE_CLASS.CORE,
  dependsOn: [],
  providesKinds: [],
  requiresAnyKind: [],
  tenantCanDisable: false,
  permissions: [],
  routes: {},
  menu: [],
  settingKeys: [],
  customFieldEntities: ["contact"],
  botTools: [],
  storefrontSections: [],
  events: { emits: [], consumes: [] },
  limitKeys: [],
  sequenceKeys: [],
});

const SALON_CONTACT_KEYS = ["skin_type", "hair_type", "allergies", "preferred_stylist"];

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startIamApi({ tenantRouters: [], extraManifests: [CONTACT_PROBE] });
});

afterAll(async () => {
  await harness.dispose();
});

function fieldsPath(organizationId: string, suffix = ""): string {
  return `/orgs/${organizationId}/custom-fields${suffix}`;
}

function textField(fieldKey: string): object {
  return {
    entityType: "contact",
    fieldKey,
    label: { bn: "নোট", en: "Note" },
    fieldType: "TEXT",
    isRequired: false,
    visibility: { admin: true, storefront: false, bot: false },
    botAsk: false,
    isSearchable: false,
    isSensitive: false,
    sortOrder: 20,
  };
}

async function aWorld(): Promise<TwoOrganizations> {
  return createTwoOrganizations(harness.app, harness.connections, {
    industryTemplateKey: "RETAIL",
  });
}

async function useTemplate(organizationId: string, industryTemplateKey: string): Promise<void> {
  await harness.connections.platform
    .collection("organizations")
    .updateOne({ organizationId }, { $set: { industryTemplateKey }, $inc: { configVersion: 1 } });
}

async function configVersion(organizationId: string): Promise<number> {
  const row = await harness.connections.platform
    .collection("organizations")
    .findOne({ organizationId });
  return Number(row?.["configVersion"]);
}

async function effectCounts(organizationId: string): Promise<{
  version: number;
  audits: number;
  events: number;
}> {
  const filter = { organizationId };
  return {
    version: await configVersion(organizationId),
    audits: await countAuditRows(harness.connections, filter),
    events: await countOutboxRows(harness.connections, {
      organizationId,
      type: "custom-field.definition.changed",
    }),
  };
}

async function expectGrew(
  organizationId: string,
  before: { version: number; audits: number; events: number },
): Promise<void> {
  const after = await effectCounts(organizationId);
  expect(after.version).toBe(before.version + 1);
  expect(after.audits).toBe(before.audits + 1);
  expect(after.events).toBe(before.events + 1);
}

describe("custom field API", () => {
  it("lists salon contact fields, then creates, edits, archives and prefers", async () => {
    const world = await aWorld();
    await useTemplate(world.organizationA, "SALON");
    const path = fieldsPath(world.organizationA);
    const listed = await world.alice.call("get", `${path}?entityType=contact`);
    expect(listed.status).toBe(200);
    expect(
      listed.body.data.map((field: { fieldKey: string }) => field.fieldKey).slice(0, 4),
    ).toEqual(SALON_CONTACT_KEYS);

    const countsBeforeCreate = await effectCounts(world.organizationA);
    const created = await world.alice.call("post", path, textField("visit_note"));
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      scope: "ORGANIZATION",
      fieldKey: "visit_note",
      version: 1,
    });
    await expectGrew(world.organizationA, countsBeforeCreate);

    const countsBeforePatch = await effectCounts(world.organizationA);
    const patched = await world.alice.call(
      "patch",
      `${path}/${created.body.data.customFieldDefinitionId}`,
      { version: 1, label: { bn: "ভিজিট নোট", en: "Visit note" } },
    );
    expect(patched.body.data.version).toBe(2);
    await expectGrew(world.organizationA, countsBeforePatch);

    const countsBeforeArchive = await effectCounts(world.organizationA);
    const archived = await world.alice.call(
      "post",
      `${path}/${created.body.data.customFieldDefinitionId}/archive`,
      { version: 2 },
    );
    expect(archived.status).toBe(200);
    await expectGrew(world.organizationA, countsBeforeArchive);
    const afterArchive = await world.alice.call("get", `${path}?entityType=contact`);
    expect(
      afterArchive.body.data.map((field: { fieldKey: string }) => field.fieldKey),
    ).not.toContain("visit_note");

    const countsBeforeHide = await effectCounts(world.organizationA);
    const hidden = await world.alice.call("patch", `${path}/preferences`, {
      preferences: [{ entityType: "contact", fieldKey: "skin_type", isHidden: true }],
    });
    expect(hidden.status).toBe(200);
    await expectGrew(world.organizationA, countsBeforeHide);
    const renamedOk = await world.alice.call("patch", `${path}/preferences`, {
      preferences: [
        { entityType: "contact", fieldKey: "hair_type", label: { bn: "চুল", en: "Hair" } },
      ],
    });
    expect(renamedOk.status).toBe(200);
    const reordered = await world.alice.call("patch", `${path}/preferences`, {
      preferences: [{ entityType: "contact", fieldKey: "preferred_stylist", sortOrder: 0 }],
    });
    expect(reordered.status).toBe(200);
    const afterPrefer = await world.alice.call("get", `${path}?entityType=contact`);
    const keys = afterPrefer.body.data.map((field: { fieldKey: string }) => field.fieldKey);
    const hair = afterPrefer.body.data.find(
      (field: { fieldKey: string }) => field.fieldKey === "hair_type",
    );
    expect(keys).not.toContain("skin_type");
    expect(keys[0]).toBe("preferred_stylist");
    expect(hair.label).toMatchObject({ bn: "চুল", en: "Hair" });
  });

  it("refuses a bad definition", async () => {
    const world = await aWorld();
    const path = fieldsPath(world.organizationA);
    const badKey = await world.alice.call("post", path, textField("Bad"));
    const badType = await world.alice.call("post", path, {
      ...textField("note"),
      fieldType: "STRING",
    });
    const withOptions = await world.alice.call("post", path, {
      ...textField("note"),
      options: ["A"],
    });
    const bounds = await world.alice.call("post", path, {
      ...textField("note"),
      fieldType: "NUMBER",
      validation: { min: 5, max: 1 },
    });
    const pattern = await world.alice.call("post", path, { ...textField("note"), pattern: ".*" });
    expect([
      badKey.status,
      badType.status,
      withOptions.status,
      bounds.status,
      pattern.status,
    ]).toEqual([400, 400, 400, 400, 400]);
  });

  it("refuses a duplicate key, a 51st field, a hidden required field and a type change", async () => {
    const world = await aWorld();
    await useTemplate(world.organizationA, "SALON");
    const path = fieldsPath(world.organizationA);
    const industryKey = await world.alice.call("post", path, textField("skin_type"));
    expect(industryKey.status).toBe(409);
    expect(industryKey.body.error.messageKey).toBe("errors.custom_field_key_taken");

    const body = textField("dup_note");
    const [first, second] = await Promise.all([
      world.alice.call("post", path, body),
      world.alice.call("post", path, body),
    ]);
    expect([first.status, second.status].sort()).toEqual([201, 409]);

    const created = await world.alice.call("post", path, textField("clinic_note"));
    const changedType = await world.alice.call(
      "patch",
      `${path}/${created.body.data.customFieldDefinitionId}`,
      {
        version: 1,
        fieldType: "NUMBER",
      },
    );
    const changedKey = await world.alice.call(
      "patch",
      `${path}/${created.body.data.customFieldDefinitionId}`,
      {
        version: 1,
        fieldKey: "other",
      },
    );
    expect(changedType.status).toBe(400);
    expect(changedKey.status).toBe(400);

    await useTemplate(world.organizationA, "CLINIC");
    const hidden = await world.alice.call("patch", `${path}/preferences`, {
      preferences: [{ entityType: "contact", fieldKey: "age_years", isHidden: true }],
    });
    expect(hidden.status).toBe(422);
    expect(hidden.body.error.details.ruleKey).toBe("CUSTOM_FIELD_REQUIRED");

    await fillUntilFifty(world.organizationA, world.alice.userId);
    const limited = await world.alice.call("post", path, textField("one_more"));
    expect(limited.status).toBe(422);
    expect(limited.body.error.details.ruleKey).toBe("CUSTOM_FIELD_LIMIT");
  });

  it("lets staff read and refuses a write, and refuses a manager who is not at every location", async () => {
    const world = await aWorld();
    const path = fieldsPath(world.organizationA);
    const read = await world.sam.call("get", `${path}?entityType=contact`);
    const write = await world.sam.call("post", path, textField("staff_note"));
    expect(read.status).toBe(200);
    expect(write.status).toBe(403);

    const managerRoleId = await findSystemRoleId(
      harness.connections,
      world.organizationA,
      SYSTEM_ROLE_KEY.MANAGER,
    );
    const manager = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: world.locationA1, roleId: managerRoleId },
    ]);
    const managerWrite = await manager.actor.call("post", path, textField("manager_note"));
    expect(managerWrite.status).toBe(403);
  });

  it("hides another organization's fields and answers 404 for a foreign id", async () => {
    const world = await aWorld();
    const created = await world.bob.call(
      "post",
      fieldsPath(world.organizationB),
      textField("bob_note"),
    );
    expect(created.status).toBe(201);
    const list = await world.alice.call(
      "get",
      `${fieldsPath(world.organizationA)}?entityType=contact`,
    );
    expect(list.body.data.map((field: { fieldKey: string }) => field.fieldKey)).not.toContain(
      "bob_note",
    );
    const foreign = await world.alice.call(
      "patch",
      `${fieldsPath(world.organizationA)}/${created.body.data.customFieldDefinitionId}`,
      { version: 1, label: { bn: "বদল", en: "Changed" } },
    );
    expect(foreign.status).toBe(404);
  });

  it("answers 404 when the entity is not offered", async () => {
    const world = await aWorld();
    const response = await world.alice.call(
      "get",
      `${fieldsPath(world.organizationA)}?entityType=booking`,
    );
    expect(response.status).toBe(404);
  });
});

async function fillUntilFifty(organizationId: string, actorUserId: string): Promise<void> {
  await withOrganizationContext(organizationId, async () => {
    const repository = new MongoCustomFieldDefinitionRepository();
    const active = await repository.countActive("contact");
    for (let index = active + 1; index <= 50; index += 1) {
      await repository.insert(aStoredField(organizationId, actorUserId, index));
    }
  });
}

function aStoredField(
  organizationId: string,
  actorUserId: string,
  index: number,
): CustomFieldDefinition {
  return CustomFieldDefinition.create({
    organizationId: asId<OrganizationId>(organizationId),
    entityType: "contact",
    fieldKey: `extra_${String(index).padStart(2, "0")}`,
    label: { bn: "অতিরিক্ত", en: "Extra" },
    fieldType: "TEXT",
    isRequired: false,
    visibility: { admin: true, storefront: false, bot: false },
    botAsk: false,
    isSearchable: false,
    isSensitive: false,
    sortOrder: index,
    createdByUserId: asId<UserId>(actorUserId),
    now: new Date(),
  });
}
