import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pdfDocument, pngImage } from "../../../../test-support/file-fixtures.js";
import { uploadFile } from "../../../../test-support/file-upload-client.js";
import { registerIamApiModels, startIamApi } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import {
  createTwoOrganizations,
  type ApiActor,
  type TwoOrganizations,
} from "../../../../test-support/two-organizations.js";
import { buildFileStorage } from "../../file/index.js";

registerIamApiModels();

const uploadRoot = mkdtempSync(join(tmpdir(), "file-fields-test-"));
let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startIamApi({
    fileOverrides: { fileStorage: buildFileStorage({ driver: "local", localRoot: uploadRoot }) },
  });
});

afterAll(async () => {
  await harness.dispose();
  rmSync(uploadRoot, { recursive: true, force: true });
});

const VISIBLE_TO_ADMIN = { admin: true, storefront: false, bot: false };

function definitionOf(entityType: string, fieldKey: string, fieldType: string): object {
  return {
    entityType,
    fieldKey,
    label: { bn: fieldKey, en: fieldKey },
    fieldType,
    isRequired: false,
    visibility: VISIBLE_TO_ADMIN,
    botAsk: false,
    isSearchable: false,
    isSensitive: false,
    sortOrder: 10,
  };
}

const FILE_FIELDS = [
  { entityType: "organization", fieldKey: "shop_photo", fieldType: "IMAGE" },
  { entityType: "organization", fieldKey: "licence_scan", fieldType: "FILE" },
  { entityType: "member", fieldKey: "staff_photo", fieldType: "IMAGE" },
] as const;

async function aWorld(): Promise<TwoOrganizations> {
  const world = await createTwoOrganizations(harness.app, harness.connections, {
    industryTemplateKey: "RETAIL",
  });
  const path = `/orgs/${world.organizationA}/custom-fields`;
  for (const field of FILE_FIELDS) {
    const created = await world.alice.call(
      "post",
      path,
      definitionOf(field.entityType, field.fieldKey, field.fieldType),
    );
    const { fieldKey } = field;
    if (created.status !== 201) throw new Error(`field ${fieldKey}: ${created.status}`);
  }
  return world;
}

async function upload(
  actor: ApiActor,
  organizationId: string,
  purpose: string,
  kind: "image" | "pdf" = "image",
): Promise<string> {
  const response = await uploadFile(harness.app, actor, {
    organizationId,
    bytes: kind === "image" ? await pngImage() : pdfDocument(),
    filename: kind === "image" ? "a.png" : "a.pdf",
    purpose,
  });
  if (response.status !== 201) throw new Error(`upload ${purpose}: ${response.status}`);
  return response.body.data.fileId;
}

async function setProfileFields(world: TwoOrganizations, customFields: object) {
  const path = `/orgs/${world.organizationA}/profile`;
  const current = await world.alice.call("get", path);
  return world.alice.call("patch", path, {
    version: current.body.data.version,
    customFields,
  });
}

describe("FILE and IMAGE custom field values", () => {
  it("accepts an image uploaded for a custom field image of this organization", async () => {
    const world = await aWorld();
    const fileId = await upload(world.alice, world.organizationA, "CUSTOM_FIELD_IMAGE");

    const response = await setProfileFields(world, { shop_photo: fileId });

    expect(response.status).toBe(200);
    expect(response.body.data.customFields).toEqual({ shop_photo: fileId });
  });

  it("accepts a PDF uploaded for a custom field file", async () => {
    const world = await aWorld();
    const fileId = await upload(world.alice, world.organizationA, "CUSTOM_FIELD_FILE", "pdf");

    const response = await setProfileFields(world, { licence_scan: fileId });

    expect(response.status).toBe(200);
  });

  it("refuses another organization's file at customFields.<key>", async () => {
    const world = await aWorld();
    const foreignFileId = await upload(world.bob, world.organizationB, "CUSTOM_FIELD_IMAGE");

    const response = await setProfileFields(world, { shop_photo: foreignFileId });

    expect(response.status).toBe(400);
    expect(response.body.error.details.fields).toEqual([
      { path: "customFields.shop_photo", messageKey: "errors.file_reference_invalid" },
    ]);
  });

  it("refuses a deleted file", async () => {
    const world = await aWorld();
    const fileId = await upload(world.alice, world.organizationA, "CUSTOM_FIELD_IMAGE");
    await world.alice.call("delete", `/orgs/${world.organizationA}/files/${fileId}`);

    const response = await setProfileFields(world, { shop_photo: fileId });

    expect(response.status).toBe(400);
  });

  it("refuses a file uploaded for another purpose, such as a logo", async () => {
    const world = await aWorld();
    const logoId = await upload(world.alice, world.organizationA, "LOGO");

    const response = await setProfileFields(world, { shop_photo: logoId });

    expect(response.status).toBe(400);
    expect(response.body.error.details.fields[0].path).toBe("customFields.shop_photo");
  });

  it("refuses an image where a file field expects a document", async () => {
    const world = await aWorld();
    const imageId = await upload(world.alice, world.organizationA, "CUSTOM_FIELD_IMAGE");

    const response = await setProfileFields(world, { licence_scan: imageId });

    expect(response.status).toBe(400);
  });

  it("applies the same check to a member's image field", async () => {
    const world = await aWorld();
    const memberPath = `/orgs/${world.organizationA}/members/${world.samMemberId}`;
    const current = await world.alice.call("get", memberPath);
    const foreignFileId = await upload(world.bob, world.organizationB, "CUSTOM_FIELD_IMAGE");
    const ownFileId = await upload(world.alice, world.organizationA, "CUSTOM_FIELD_IMAGE");

    const refused = await world.alice.call("patch", memberPath, {
      version: current.body.data.version,
      customFields: { staff_photo: foreignFileId },
    });
    const accepted = await world.alice.call("patch", memberPath, {
      version: current.body.data.version,
      customFields: { staff_photo: ownFileId },
    });

    expect(refused.status).toBe(400);
    expect(accepted.status).toBe(200);
  });
});
