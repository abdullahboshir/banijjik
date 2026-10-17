import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pngImage } from "../../../../test-support/file-fixtures.js";
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

const uploadRoot = mkdtempSync(join(tmpdir(), "branding-test-"));
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

const GREEN = "#15803d";
const LIGHT_YELLOW = "#fde68a";

function aWorld(): Promise<TwoOrganizations> {
  return createTwoOrganizations(harness.app, harness.connections, {
    industryTemplateKey: "RETAIL",
  });
}

async function uploadFor(
  actor: ApiActor,
  organizationId: string,
  purpose: string,
): Promise<string> {
  const response = await uploadFile(harness.app, actor, {
    organizationId,
    bytes: await pngImage(),
    filename: "logo.png",
    purpose,
  });
  if (response.status !== 201) throw new Error(`upload ${purpose}: ${response.status}`);
  return response.body.data.fileId;
}

function profilePath(world: TwoOrganizations): string {
  return `/orgs/${world.organizationA}/profile`;
}

async function setBranding(world: TwoOrganizations, branding: object, version = 1) {
  return world.alice.call("patch", profilePath(world), { version, branding });
}

async function auditChangesOf(world: TwoOrganizations): Promise<Record<string, unknown>[]> {
  const rows = await harness.connections.tenantShared
    .collection("audit_logs")
    .find({ organizationId: world.organizationA, action: "organization.organization.updated" })
    .toArray();
  return rows.map((row) => row["changes"] as Record<string, unknown>);
}

describe("a business that has not set its branding", () => {
  it("reads an empty branding on its profile and no logo on its organization list", async () => {
    const world = await aWorld();

    const profile = await world.alice.call("get", profilePath(world));
    const organizations = await world.alice.call("get", "/me/orgs");

    expect(profile.body.data.branding).toEqual({});
    const listed = organizations.body.data.find(
      (row: { organizationId: string }) => row.organizationId === world.organizationA,
    );
    expect(listed).not.toHaveProperty("logoUrl");
  });
});

describe("PATCH /profile with branding", () => {
  it("sets the logo, both colours and the tagline, and reads them back with the logo address", async () => {
    const world = await aWorld();
    const logoFileId = await uploadFor(world.alice, world.organizationA, "LOGO");

    const response = await setBranding(world, {
      logoFileId,
      primaryColor: "#15803D",
      accentColor: "#16A34A",
      tagline: "  Fresh every day  ",
    });
    const read = await world.alice.call("get", profilePath(world));

    expect(response.status).toBe(200);
    const expected = {
      logoFileId,
      logoUrl: `/api/v1/public/files/${logoFileId}/medium`,
      primaryColor: GREEN,
      accentColor: "#16a34a",
      tagline: "Fresh every day",
    };
    expect(response.body.data.branding).toEqual(expected);
    expect(read.body.data.branding).toEqual(expected);
    expect(response.body.data.version).toBe(2);
  });

  it("clears each key with null and leaves the keys that are not sent", async () => {
    const world = await aWorld();
    const logoFileId = await uploadFor(world.alice, world.organizationA, "LOGO");
    await setBranding(world, { logoFileId, primaryColor: GREEN, tagline: "Hello" });

    const cleared = await setBranding(world, { tagline: null, logoFileId: null }, 2);

    expect(cleared.status).toBe(200);
    expect(cleared.body.data.branding).toEqual({ primaryColor: GREEN });
  });

  it("writes one audit entry that names each branding key that changed", async () => {
    const world = await aWorld();
    const before = await auditChangesOf(world);

    await setBranding(world, { primaryColor: GREEN, tagline: "Hello" });
    const entries = await auditChangesOf(world);

    expect(before).toHaveLength(0);
    expect(entries).toHaveLength(1);
    expect(Object.keys(entries[0] ?? {}).sort()).toEqual([
      "branding.primaryColor",
      "branding.tagline",
    ]);
  });

  it("lists the logo as a thumbnail address in the person's organizations", async () => {
    const world = await aWorld();
    const logoFileId = await uploadFor(world.alice, world.organizationA, "LOGO");
    await setBranding(world, { logoFileId });

    const organizations = await world.alice.call("get", "/me/orgs");

    const listed = organizations.body.data.find(
      (row: { organizationId: string }) => row.organizationId === world.organizationA,
    );
    expect(listed.logoUrl).toBe(`/api/v1/public/files/${logoFileId}/thumb`);
  });
});

describe("the colour rules", () => {
  it("refuses a primary colour that is too pale for white text, at branding.primaryColor", async () => {
    const world = await aWorld();

    const response = await setBranding(world, { primaryColor: "#ffffff" });

    expect(response.status).toBe(400);
    expect(response.body.error.details.fields).toEqual([
      { path: "branding.primaryColor", messageKey: "validation.color_low_contrast" },
    ]);
  });

  it("refuses a pale accent colour, at branding.accentColor", async () => {
    const world = await aWorld();

    const response = await setBranding(world, { accentColor: LIGHT_YELLOW });

    expect(response.status).toBe(400);
    expect(response.body.error.details.fields).toEqual([
      { path: "branding.accentColor", messageKey: "validation.color_low_contrast" },
    ]);
  });

  it("names both colours when both fail, and writes nothing, not even the valid tagline", async () => {
    const world = await aWorld();

    const response = await setBranding(world, {
      primaryColor: "#ffffff",
      accentColor: LIGHT_YELLOW,
      tagline: "Hello",
    });
    const after = await world.alice.call("get", profilePath(world));

    expect(response.status).toBe(400);
    expect(response.body.error.details.fields.map((field: { path: string }) => field.path)).toEqual(
      ["branding.primaryColor", "branding.accentColor"],
    );
    expect(after.body.data).toMatchObject({ branding: {}, version: 1 });
    expect(await auditChangesOf(world)).toHaveLength(0);
  });

  it("checks every colour that is set but never a null, so a colour can always be cleared", async () => {
    const world = await aWorld();
    await setBranding(world, { primaryColor: GREEN });

    const cleared = await setBranding(world, { primaryColor: null }, 2);

    expect(cleared.status).toBe(200);
    expect(cleared.body.data.branding).toEqual({});
  });

  it.each([
    ["a colour that is not #RRGGBB", { primaryColor: "green" }],
    ["a tagline of 81 characters", { tagline: "a".repeat(81) }],
    ["an unknown key", { fontFamily: "Inter" }],
  ])("refuses %s with a validation error", async (_description, branding) => {
    const world = await aWorld();

    const response = await setBranding(world, branding);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("the logo rule", () => {
  it("refuses another organization's logo at branding.logoFileId", async () => {
    const world = await aWorld();
    const foreignLogo = await uploadFor(world.bob, world.organizationB, "LOGO");

    const response = await setBranding(world, { logoFileId: foreignLogo });

    expect(response.status).toBe(400);
    expect(response.body.error.details.fields).toEqual([
      { path: "branding.logoFileId", messageKey: "errors.file_reference_invalid" },
    ]);
  });

  it("refuses a deleted file", async () => {
    const world = await aWorld();
    const logoFileId = await uploadFor(world.alice, world.organizationA, "LOGO");
    await world.alice.call("delete", `/orgs/${world.organizationA}/files/${logoFileId}`);

    const response = await setBranding(world, { logoFileId });

    expect(response.status).toBe(400);
  });

  it("refuses a file that was uploaded as an offering image", async () => {
    const world = await aWorld();
    const imageId = await uploadFor(world.alice, world.organizationA, "OFFERING_IMAGE");

    const response = await setBranding(world, { logoFileId: imageId });

    expect(response.status).toBe(400);
    expect(response.body.error.details.fields[0].path).toBe("branding.logoFileId");
  });

  it("refuses a file id that does not exist", async () => {
    const world = await aWorld();

    const response = await setBranding(world, {
      logoFileId: "01a149dc-377b-73dd-acc6-291b003c93ba",
    });

    expect(response.status).toBe(400);
  });
});

describe("who may change the branding", () => {
  it("refuses a staff member who lacks the profile permission, and changes nothing", async () => {
    const world = await aWorld();

    const response = await world.sam.call("patch", profilePath(world), {
      version: 1,
      branding: { tagline: "Hijacked" },
    });
    const after = await world.alice.call("get", profilePath(world));

    expect(response.status).toBe(403);
    expect(after.body.data.branding).toEqual({});
  });

  it("lets any active member read the branding", async () => {
    const world = await aWorld();
    await setBranding(world, { tagline: "Open to all" });

    const read = await world.sam.call("get", profilePath(world));

    expect(read.status).toBe(200);
    expect(read.body.data.branding).toEqual({ tagline: "Open to all" });
  });

  it("answers 404 for another business and leaves its branding untouched", async () => {
    const world = await aWorld();

    const response = await world.alice.call("patch", `/orgs/${world.organizationB}/profile`, {
      version: 1,
      branding: { tagline: "Hijacked" },
    });
    const untouched = await world.bob.call("get", `/orgs/${world.organizationB}/profile`);

    expect(response.status).toBe(404);
    expect(untouched.body.data.branding).toEqual({});
  });

  it("answers 409 for a stale version", async () => {
    const world = await aWorld();
    await setBranding(world, { tagline: "First" });

    const stale = await setBranding(world, { tagline: "Second" }, 1);

    expect(stale.status).toBe(409);
  });
});
