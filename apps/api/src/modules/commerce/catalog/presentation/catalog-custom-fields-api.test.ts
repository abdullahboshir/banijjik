import { SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  money,
  offeringsPath,
  startCatalogApi,
  worldFor,
} from "../../../../test-support/catalog-world.js";
import { registerIamApiModels } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import { addMemberWithAssignments, findSystemRoleId } from "../../../../test-support/rbac-world.js";
import type { TwoOrganizations } from "../../../../test-support/two-organizations.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };
const SALON = { industryTemplateKey: "SALON" };
let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startCatalogApi();
});

afterAll(async () => {
  await harness.dispose();
});

function field(spec: {
  entityType: string;
  fieldKey: string;
  offeringKind?: string;
  isSensitive?: boolean;
}) {
  return {
    entityType: spec.entityType,
    ...(spec.offeringKind === undefined ? {} : { offeringKind: spec.offeringKind }),
    fieldKey: spec.fieldKey,
    label: { bn: spec.fieldKey, en: spec.fieldKey },
    fieldType: "TEXT",
    isRequired: false,
    visibility: { admin: true, storefront: false, bot: false },
    botAsk: false,
    isSearchable: false,
    isSensitive: spec.isSensitive ?? false,
    sortOrder: 10,
  };
}

async function defineFields(world: TwoOrganizations, specs: Parameters<typeof field>[0][]) {
  for (const spec of specs) {
    const response = await world.alice.call(
      "post",
      `/orgs/${world.organizationA}/custom-fields`,
      field(spec),
    );
    if (response.status !== 201) throw new Error(`${spec.fieldKey}: ${response.status}`);
  }
}

describe("custom fields of an offering", () => {
  it("accepts fields of the offering's kind and returns them", async () => {
    const world = await worldFor(harness, RETAIL);
    await defineFields(world, [
      { entityType: "offering", fieldKey: "brand_note", offeringKind: "PRODUCT" },
      { entityType: "offering", fieldKey: "any_note", offeringKind: "PRODUCT" },
    ]);

    const created = await world.alice.call("post", offeringsPath(world.organizationA), {
      kind: "PRODUCT",
      name: "Rice",
      price: money(100),
      customFields: { brand_note: "Aarong", any_note: "fresh" },
    });
    const read = await world.alice.call(
      "get",
      offeringsPath(world.organizationA, `/${created.body.data.offeringId}`),
    );

    expect(created.status).toBe(201);
    expect(read.body.data.customFields).toEqual({ brand_note: "Aarong", any_note: "fresh" });
  });

  it("refuses a field that belongs to another kind, at customFields.<key>", async () => {
    const world = await worldFor(harness, RETAIL);
    await defineFields(world, [
      { entityType: "offering", fieldKey: "chair_note", offeringKind: "SERVICE" },
    ]);

    const response = await world.alice.call("post", offeringsPath(world.organizationA), {
      kind: "PRODUCT",
      name: "Rice",
      price: money(100),
      customFields: { chair_note: "no" },
    });

    expect(response.status).toBe(400);
    expect(response.body.error.details.fields[0].path).toBe("customFields.chair_note");
  });

  it("gives a service the fields of the SERVICE kind", async () => {
    const world = await worldFor(harness, RETAIL, SALON);
    await defineFields(world, [
      { entityType: "offering", fieldKey: "chair_note", offeringKind: "SERVICE" },
    ]);

    const response = await world.alice.call("post", offeringsPath(world.organizationA), {
      kind: "SERVICE",
      name: "Haircut",
      kindDetails: { durationMinutes: 30 },
      price: money(100),
      unitKey: "SESSION",
      customFields: { chair_note: "window side" },
    });

    expect(response.status).toBe(201);
    expect(response.body.data.customFields).toEqual({ chair_note: "window side" });
  });

  it("clears a value with null on update and records the change without a sensitive value", async () => {
    const world = await worldFor(harness, RETAIL);
    await defineFields(world, [
      { entityType: "offering", fieldKey: "note", offeringKind: "PRODUCT" },
      { entityType: "offering", fieldKey: "secret", offeringKind: "PRODUCT", isSensitive: true },
    ]);
    const created = await world.alice.call("post", offeringsPath(world.organizationA), {
      kind: "PRODUCT",
      name: "Rice",
      price: money(100),
      customFields: { note: "a", secret: "classified-123" },
    });
    const path = offeringsPath(world.organizationA, `/${created.body.data.offeringId}`);

    const cleared = await world.alice.call("patch", path, {
      customFields: { note: null },
      version: 1,
    });
    const audit = await harness.connections.tenantShared
      .collection("audit_logs")
      .find({ action: "catalog.offering.created", entityId: created.body.data.offeringId })
      .toArray();

    expect(cleared.body.data.customFields).toEqual({ secret: "classified-123" });
    expect(JSON.stringify(audit)).not.toContain("classified-123");
  });

  it("keeps sensitive values from a caller who may not update everywhere", async () => {
    const world = await worldFor(harness, RETAIL);
    await defineFields(world, [
      { entityType: "offering", fieldKey: "secret", offeringKind: "PRODUCT", isSensitive: true },
    ]);
    const created = await world.alice.call("post", offeringsPath(world.organizationA), {
      kind: "PRODUCT",
      name: "Rice",
      price: money(100),
      customFields: { secret: "classified-123" },
    });
    const roleId = await findSystemRoleId(
      harness.connections,
      world.organizationA,
      SYSTEM_ROLE_KEY.MANAGER,
    );
    const { actor } = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: world.locationA1, roleId },
    ]);
    const path = offeringsPath(world.organizationA, `/${created.body.data.offeringId}`);

    const read = await actor.call("get", path);
    const write = await actor.call("patch", path, { customFields: { secret: "x" }, version: 1 });

    expect(read.body.data.customFields).toEqual({});
    expect(write.status).toBe(403);
  });
});

describe("custom fields of a category", () => {
  it("saves and returns a category field", async () => {
    const world = await worldFor(harness, RETAIL);
    await defineFields(world, [{ entityType: "category", fieldKey: "banner_text" }]);

    const response = await world.alice.call("post", `/orgs/${world.organizationA}/categories`, {
      name: "Grocery",
      customFields: { banner_text: "Fresh every day" },
    });

    expect(response.status).toBe(201);
    expect(response.body.data.customFields).toEqual({ banner_text: "Fresh every day" });
  });
});
