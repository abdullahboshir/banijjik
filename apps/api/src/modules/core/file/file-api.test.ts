import { ALL_LOCATIONS, SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  EXIF_MARKER,
  htmlPage,
  jpegHeaderWithFiller,
  jpegWithExif,
  pdfDocument,
  pngHeaderThenHtml,
  pngImage,
  svgImage,
} from "../../../test-support/file-fixtures.js";
import {
  downloadFile,
  getWithoutSession,
  uploadFile,
} from "../../../test-support/file-upload-client.js";
import { registerIamApiModels, startIamApi } from "../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../test-support/iam-api-harness.js";
import { addMemberWithAssignments, findSystemRoleId } from "../../../test-support/rbac-world.js";
import {
  createTwoOrganizations,
  type ApiActor,
  type TwoOrganizations,
} from "../../../test-support/two-organizations.js";
import { MAX_IMAGE_UPLOAD_BYTES } from "./domain/file-limits.js";
import { LocalFileStorage } from "./infrastructure/local-file-storage.js";

registerIamApiModels();

const uploadRoot = mkdtempSync(join(tmpdir(), "file-api-test-"));
let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startIamApi({ fileOverrides: { fileStorage: new LocalFileStorage(uploadRoot) } });
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

async function aMemberWithRole(
  world: TwoOrganizations,
  roleKey: (typeof SYSTEM_ROLE_KEY)[keyof typeof SYSTEM_ROLE_KEY],
): Promise<ApiActor> {
  const roleId = await findSystemRoleId(harness.connections, world.organizationA, roleKey);
  const added = await addMemberWithAssignments(harness.app, world.organizationA, [
    { locationId: ALL_LOCATIONS, roleId },
  ]);
  return added.actor;
}

function storedObjectCount(): number {
  return readdirSync(uploadRoot, { recursive: true, withFileTypes: true }).filter((entry) =>
    entry.isFile(),
  ).length;
}

function uploadAs(
  actor: ApiActor,
  organizationId: string,
  purpose: string,
  bytes: Buffer,
  filename = "photo.jpg",
) {
  return uploadFile(harness.app, actor, { organizationId, bytes, filename, purpose });
}

describe("POST /files", () => {
  it("turns a JPEG logo into three WebP variants without EXIF and links it publicly", async () => {
    const world = await aWorld();

    const response = await uploadAs(
      world.alice,
      world.organizationA,
      "LOGO",
      await jpegWithExif(2400, 1800),
    );

    expect(response.status).toBe(201);
    const file = response.body.data;
    expect(file).toMatchObject({ purpose: "LOGO", visibility: "PUBLIC", mimeType: "image/webp" });
    expect(file.variants.map((variant: { variantKey: string }) => variant.variantKey)).toEqual([
      "thumb",
      "medium",
      "large",
      "blurred",
    ]);
    expect(file.url).toBe(`/api/v1/public/files/${file.fileId}/medium`);
    for (const variantKey of ["thumb", "medium", "large", "blurred"]) {
      const content = await downloadFile(
        harness.app,
        world.alice,
        `/orgs/${world.organizationA}/files/${file.fileId}/content?variant=${variantKey}`,
      );
      const metadata = await sharp(content.body).metadata();
      expect(metadata.format).toBe("webp");
      expect(metadata.exif, variantKey).toBeUndefined();
      expect(content.body.includes(EXIF_MARKER), variantKey).toBe(false);
    }
  });

  it("stores a PDF for a file field as received and offers it as a download", async () => {
    const world = await aWorld();
    const pdf = pdfDocument(2048);

    const created = await uploadAs(
      world.alice,
      world.organizationA,
      "CUSTOM_FIELD_FILE",
      pdf,
      "contract.pdf",
    );

    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      visibility: "PRIVATE",
      mimeType: "application/pdf",
      originalName: "contract.pdf",
    });
    expect(created.body.data.url).toBeUndefined();
    const content = await downloadFile(
      harness.app,
      world.alice,
      `/orgs/${world.organizationA}/files/${created.body.data.fileId}/content`,
    );
    expect(content.status).toBe(200);
    expect(content.body.equals(pdf)).toBe(true);
    expect(content.headers["content-disposition"]).toBe(
      "attachment; filename*=UTF-8''contract.pdf",
    );
    expect(content.headers["x-content-type-options"]).toBe("nosniff");
    expect(content.headers["cache-control"]).toContain("private");
  });

  it("takes the visibility from the purpose, never from the request", async () => {
    const world = await aWorld();

    const response = await uploadAs(
      world.alice,
      world.organizationA,
      "CUSTOM_FIELD_IMAGE",
      await pngImage(),
      "a.png",
    );

    expect(response.body.data.visibility).toBe("PRIVATE");
  });

  it.each([
    ["an SVG", svgImage(), "logo.svg"],
    ["an HTML file renamed .jpg", htmlPage(), "logo.jpg"],
    ["a PNG header followed by HTML", pngHeaderThenHtml(), "logo.png"],
  ])("refuses %s with 415 and stores nothing", async (_label, bytes, filename) => {
    const world = await aWorld();
    const before = storedObjectCount();

    const response = await uploadAs(world.alice, world.organizationA, "LOGO", bytes, filename);

    expect(response.status).toBe(415);
    expect(response.body.error.messageKey).toBe("errors.file_type_not_allowed");
    expect(storedObjectCount()).toBe(before);
  });

  it("refuses a PDF for an image purpose", async () => {
    const world = await aWorld();

    const response = await uploadAs(world.alice, world.organizationA, "LOGO", pdfDocument());

    expect(response.status).toBe(415);
  });

  it("refuses an image over 8 MB with 413", async () => {
    const world = await aWorld();

    const response = await uploadAs(
      world.alice,
      world.organizationA,
      "LOGO",
      jpegHeaderWithFiller(MAX_IMAGE_UPLOAD_BYTES + 1024),
    );

    expect(response.status).toBe(413);
    expect(response.body.error.messageKey).toBe("errors.file_too_large");
  });

  it("refuses a second file in one request with 400", async () => {
    const world = await aWorld();

    const response = await uploadFile(harness.app, world.alice, {
      organizationId: world.organizationA,
      bytes: await pngImage(),
      filename: "a.png",
      purpose: "LOGO",
      secondFile: { bytes: await pngImage(), filename: "b.png" },
    });

    expect(response.status).toBe(400);
  });

  it("refuses an unknown purpose and a missing purpose with 400 at purpose", async () => {
    const world = await aWorld();

    const unknown = await uploadAs(world.alice, world.organizationA, "AVATAR", await pngImage());
    const missing = await uploadFile(harness.app, world.alice, {
      organizationId: world.organizationA,
      bytes: await pngImage(),
      filename: "a.png",
    });

    for (const response of [unknown, missing]) {
      expect(response.status).toBe(400);
      expect(response.body.error.details.fields[0].path).toBe("purpose");
    }
  });

  it("stores a website image as PUBLIC and links it publicly", async () => {
    const world = await aWorld();

    const response = await uploadAs(
      world.alice,
      world.organizationA,
      "WEBSITE_IMAGE",
      await pngImage(),
      "hero.png",
    );

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      purpose: "WEBSITE_IMAGE",
      visibility: "PUBLIC",
      mimeType: "image/webp",
    });
    expect(response.body.data.url).toBe(`/api/v1/public/files/${response.body.data.fileId}/medium`);
    const publicRead = await getWithoutSession(harness.app, response.body.data.url);
    expect(publicRead.status).toBe(200);
  });

  it("refuses a PDF labelled as a website image", async () => {
    const world = await aWorld();

    const response = await uploadAs(
      world.alice,
      world.organizationA,
      "WEBSITE_IMAGE",
      pdfDocument(),
      "hero.pdf",
    );

    expect(response.status).toBe(415);
  });

  it("refuses a staff member who may upload files but may not edit the website", async () => {
    const world = await aWorld();

    const logo = await uploadAs(world.sam, world.organizationA, "LOGO", await pngImage());
    const website = await uploadAs(
      world.sam,
      world.organizationA,
      "WEBSITE_IMAGE",
      await pngImage(),
    );

    expect(logo.status).toBe(201);
    expect(website.status).toBe(403);
  });

  it("refuses a rider and a viewer, who may not upload", async () => {
    const world = await aWorld();
    const rider = await aMemberWithRole(world, SYSTEM_ROLE_KEY.RIDER);
    const viewer = await aMemberWithRole(world, SYSTEM_ROLE_KEY.VIEWER);

    for (const actor of [rider, viewer]) {
      const response = await uploadAs(actor, world.organizationA, "LOGO", await pngImage());
      expect(response.status).toBe(403);
    }
  });

  it("lets a viewer read a file but not delete it", async () => {
    const world = await aWorld();
    const viewer = await aMemberWithRole(world, SYSTEM_ROLE_KEY.VIEWER);

    const created = await uploadAs(world.alice, world.organizationA, "ATTACHMENT", pdfDocument());
    const path = `/orgs/${world.organizationA}/files/${created.body.data.fileId}`;

    expect((await viewer.call("get", path)).status).toBe(200);
    expect((await viewer.call("delete", path)).status).toBe(403);
  });
});

describe("reading files", () => {
  it("answers 403 on the content of a private file for a rider", async () => {
    const world = await aWorld();
    const rider = await aMemberWithRole(world, SYSTEM_ROLE_KEY.RIDER);
    const created = await uploadAs(
      world.alice,
      world.organizationA,
      "CUSTOM_FIELD_IMAGE",
      await pngImage(),
    );

    const response = await rider.call(
      "get",
      `/orgs/${world.organizationA}/files/${created.body.data.fileId}/content`,
    );

    expect(response.status).toBe(403);
  });

  it("answers 404 for another organization's file on every route", async () => {
    const world = await aWorld();
    const created = await uploadAs(world.alice, world.organizationA, "LOGO", await pngImage());
    const { fileId } = created.body.data;
    const base = `/orgs/${world.organizationB}/files/${fileId}`;

    const metadata = await world.bob.call("get", base);
    const content = await world.bob.call("get", `${base}/content`);
    const remove = await world.bob.call("delete", base);

    expect([metadata.status, content.status, remove.status]).toEqual([404, 404, 404]);
    const stillThere = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/files/${fileId}`,
    );
    expect(stillThere.status).toBe(200);
  });

  it("serves a PUBLIC file without a session, with long cache and nosniff headers", async () => {
    const world = await aWorld();
    const created = await uploadAs(world.alice, world.organizationA, "LOGO", await pngImage());

    const response = await getWithoutSession(harness.app, created.body.data.url);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toBe("image/webp");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["cache-control"]).toContain("max-age=31536000");
    expect(response.headers["set-cookie"]).toBeUndefined();
    expect((await sharp(response.body).metadata()).format).toBe("webp");
  });

  it("answers 404, not 403, for a PRIVATE file on the public route", async () => {
    const world = await aWorld();
    const created = await uploadAs(
      world.alice,
      world.organizationA,
      "CUSTOM_FIELD_IMAGE",
      await pngImage(),
    );

    const response = await getWithoutSession(
      harness.app,
      `/api/v1/public/files/${created.body.data.fileId}/medium`,
    );

    expect(response.status).toBe(404);
  });

  it("answers 404 for a size the file does not have and 400 for a malformed id", async () => {
    const world = await aWorld();
    const pdf = await uploadAs(world.alice, world.organizationA, "ATTACHMENT", pdfDocument());

    const noSuchVariant = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/files/${pdf.body.data.fileId}/content?variant=thumb`,
    );
    const badId = await getWithoutSession(harness.app, "/api/v1/public/files/not-an-id/medium");

    expect(noSuchVariant.status).toBe(404);
    expect(badId.status).toBe(400);
  });
});

describe("DELETE /files/{fileId}", () => {
  it("removes the stored objects and stops the public URL from working", async () => {
    const world = await aWorld();
    const created = await uploadAs(world.alice, world.organizationA, "LOGO", await pngImage());
    const { fileId, url } = created.body.data;
    const objectsBefore = storedObjectCount();
    const path = `/orgs/${world.organizationA}/files/${fileId}`;

    const removed = await world.alice.call("delete", path);

    expect(removed.status).toBe(204);
    // Images store thumb, medium, large and blurred (ADR-127).
    expect(storedObjectCount()).toBe(objectsBefore - 4);
    expect((await getWithoutSession(harness.app, url)).status).toBe(404);
    expect((await world.alice.call("get", path)).status).toBe(404);
    expect((await world.alice.call("delete", path)).status).toBe(404);
  });
});
