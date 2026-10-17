import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerIamApiModels, startIamApi } from "../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../test-support/iam-api-harness.js";
import {
  createTwoOrganizations,
  type TwoOrganizations,
} from "../../../test-support/two-organizations.js";

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

function fieldsPath(organizationId: string, suffix = ""): string {
  return `/orgs/${organizationId}/custom-fields${suffix}`;
}

function aField(overrides: object = {}): object {
  return {
    entityType: "contact",
    fieldKey: "shop_note",
    label: { bn: "নোট", en: "Note" },
    fieldType: "TEXT",
    isRequired: false,
    visibility: { admin: true, storefront: false, bot: false },
    botAsk: false,
    isSearchable: false,
    isSensitive: false,
    sortOrder: 20,
    ...overrides,
  };
}

describe("custom fields limited to contact roles", () => {
  it("round-trips the roles of an organization contact field through create, list and update", async () => {
    const world = await aWorld();
    const path = fieldsPath(world.organizationA);

    const created = await world.alice.call(
      "post",
      path,
      aField({ appliesToContactRoles: ["CUSTOMER", "LEAD"] }),
    );
    const listed = await world.alice.call("get", `${path}?entityType=contact`);
    const changed = await world.alice.call(
      "patch",
      `${path}/${created.body.data.customFieldDefinitionId}`,
      { version: created.body.data.version, appliesToContactRoles: ["SUPPLIER"] },
    );
    const cleared = await world.alice.call(
      "patch",
      `${path}/${created.body.data.customFieldDefinitionId}`,
      { version: changed.body.data.version, appliesToContactRoles: null },
    );

    expect(created.status).toBe(201);
    expect(created.body.data.appliesToContactRoles).toEqual(["CUSTOMER", "LEAD"]);
    const row = listed.body.data.find(
      (field: { fieldKey: string }) => field.fieldKey === "shop_note",
    );
    expect(row.appliesToContactRoles).toEqual(["CUSTOMER", "LEAD"]);
    expect(changed.body.data.appliesToContactRoles).toEqual(["SUPPLIER"]);
    expect(cleared.status).toBe(200);
    expect(cleared.body.data).not.toHaveProperty("appliesToContactRoles");
  });

  it("refuses roles on a field of another entity with 400", async () => {
    const world = await aWorld();

    const response = await world.alice.call(
      "post",
      fieldsPath(world.organizationA),
      aField({ entityType: "member", appliesToContactRoles: ["CUSTOMER"] }),
    );

    expect(response.status).toBe(400);
  });

  it("carries the roles of a template field in /me/config under fields.contact", async () => {
    const world = await aWorld();

    const config = await world.alice.call("get", `/orgs/${world.organizationA}/me/config`);

    const field = config.body.data.fields.contact.find(
      (entry: { fieldKey: string }) => entry.fieldKey === "customer_type",
    );
    expect(field.appliesToContactRoles).toEqual(["CUSTOMER"]);
  });
});
