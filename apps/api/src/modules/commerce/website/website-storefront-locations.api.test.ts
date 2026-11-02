import { ERROR_CODE, MODULE_KEY, MODULE_OVERRIDE_EFFECT } from "@banijjik/contracts";
import { WEBSITE_PUBLIC_LOCATION_IDS_SETTING_KEY } from "@banijjik/contracts/website";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startCatalogApi, worldFor } from "../../../test-support/catalog-world.js";
import { writeModuleOverride } from "../../../test-support/entitlement-world.js";
import { registerIamApiModels, type IamApiHarness } from "../../../test-support/iam-api-harness.js";
import { callStorefront } from "../../../test-support/storefront-world.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startCatalogApi();
});

afterAll(async () => {
  await harness.dispose();
});

describe("storefront public locations", () => {
  it("lists ACTIVE locations when website.publicLocationIds is empty", async () => {
    const world = await worldFor(harness, RETAIL);
    const response = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/locations",
    });
    expect(response.status).toBe(200);
    const ids = (response.body.data.items as { locationId: string }[]).map((row) => row.locationId);
    expect(ids).toEqual(expect.arrayContaining([world.locationA1, world.locationA2]));
    expect(
      (response.body.data.items as { locationId: string; name: string }[]).every(
        (row) => typeof row.name === "string" && row.name.length > 0,
      ),
    ).toBe(true);
  });

  it("lists only the publicLocationIds when that setting is non-empty", async () => {
    const world = await worldFor(harness, RETAIL);
    const patched = await world.alice.call("patch", `/orgs/${world.organizationA}/settings`, {
      items: [{ settingKey: WEBSITE_PUBLIC_LOCATION_IDS_SETTING_KEY, value: [world.locationA1] }],
    });
    expect(patched.status).toBe(200);
    const response = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/locations",
    });
    expect(response.status).toBe(200);
    const ids = (response.body.data.items as { locationId: string }[]).map((row) => row.locationId);
    expect(ids).toEqual([world.locationA1]);
  });

  it("answers 404 when the website module is off", async () => {
    const world = await worldFor(harness, RETAIL);
    await writeModuleOverride({
      organizationId: world.organizationA,
      moduleKey: MODULE_KEY.WEBSITE,
      effect: MODULE_OVERRIDE_EFFECT.PLATFORM_REVOKE,
    });
    const response = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/locations",
    });
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe(ERROR_CODE.NOT_FOUND);
  });

  it("does not list another organization's locations", async () => {
    const world = await worldFor(harness, RETAIL);
    const response = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/locations",
    });
    expect(response.status).toBe(200);
    const ids = (response.body.data.items as { locationId: string }[]).map((row) => row.locationId);
    expect(ids).not.toContain(world.locationB1);
    expect(ids).toContain(world.locationA1);
  });
});
