import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pngImage } from "../../../test-support/file-fixtures.js";
import { uploadFile } from "../../../test-support/file-upload-client.js";
import { registerIamApiModels, startIamApi } from "../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../test-support/iam-api-harness.js";
import {
  createTwoOrganizations,
  type TwoOrganizations,
} from "../../../test-support/two-organizations.js";
import { LocalFileStorage } from "./infrastructure/local-file-storage.js";
import { SharpImageProcessor } from "./infrastructure/sharp-image-processor.js";

registerIamApiModels();

const uploadRoot = mkdtempSync(join(tmpdir(), "file-quota-test-"));
const SLACK_BYTES = 16;
let harness: IamApiHarness;
let image: Buffer;

beforeAll(async () => {
  image = await pngImage(400, 300);
  const variants = await new SharpImageProcessor().process(image);
  const oneUploadBytes = variants.reduce((total, variant) => total + variant.bytes.length, 0);
  // Room for exactly one upload of this image, never two.
  harness = await startIamApi({
    fileOverrides: {
      fileStorage: new LocalFileStorage(uploadRoot),
      quotaBytes: oneUploadBytes + SLACK_BYTES,
    },
  });
});

afterAll(async () => {
  await harness.dispose();
  rmSync(uploadRoot, { recursive: true, force: true });
});

async function aWorld(): Promise<TwoOrganizations> {
  return createTwoOrganizations(harness.app, harness.connections, {
    industryTemplateKey: "RETAIL",
  });
}

function uploadLogo(world: TwoOrganizations, organizationId = world.organizationA) {
  const actor = organizationId === world.organizationA ? world.alice : world.bob;
  return uploadFile(harness.app, actor, {
    organizationId,
    bytes: image,
    filename: "logo.png",
    purpose: "LOGO",
  });
}

describe("the storage quota of an organization", () => {
  it("refuses an upload that would pass the quota with 422 FILE_QUOTA_EXCEEDED", async () => {
    const world = await aWorld();
    expect((await uploadLogo(world)).status).toBe(201);

    const second = await uploadLogo(world);

    expect(second.status).toBe(422);
    expect(second.body.error).toMatchObject({
      code: "BUSINESS_RULE",
      messageKey: "errors.file_quota_exceeded",
      details: { ruleKey: "FILE_QUOTA_EXCEEDED" },
    });
  });

  it("lets only one of two concurrent uploads at the edge through", async () => {
    const world = await aWorld();

    const responses = await Promise.all([uploadLogo(world), uploadLogo(world)]);

    expect(responses.map((response) => response.status).sort()).toEqual([201, 422]);
  });

  it("counts each organization on its own", async () => {
    const world = await aWorld();
    expect((await uploadLogo(world)).status).toBe(201);

    expect((await uploadLogo(world, world.organizationB)).status).toBe(201);
  });

  it("gives the space back when a file is deleted", async () => {
    const world = await aWorld();
    const first = await uploadLogo(world);
    expect((await uploadLogo(world)).status).toBe(422);

    await world.alice.call(
      "delete",
      `/orgs/${world.organizationA}/files/${first.body.data.fileId}`,
    );

    expect((await uploadLogo(world)).status).toBe(201);
  });
});
