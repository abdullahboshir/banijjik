import { MODULE_KEY, MODULE_OVERRIDE_EFFECT } from "@banijjik/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { writeModuleOverride } from "../../../test-support/entitlement-world.js";
import {
  registerIamApiModels,
  startIamApi,
  type IamApiHarness,
} from "../../../test-support/iam-api-harness.js";
import { callStorefront } from "../../../test-support/storefront-world.js";
import { createTwoOrganizations } from "../../../test-support/two-organizations.js";

registerIamApiModels();

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startIamApi({ tenantRouters: [] });
});

afterAll(async () => {
  await harness.dispose();
});

const TITLE_LIMIT = 120;
const BODY_LIMIT = 20_000;

function pagePath(organizationId: string, pageKey = "ABOUT"): string {
  return `/orgs/${organizationId}/website/pages/${pageKey}`;
}

function pageBody(overrides: object = {}) {
  return {
    title: { bn: "আমাদের সম্পর্কে", en: "About us" },
    body: { bn: "", en: "We are a small team." },
    isPublished: false,
    version: 0,
    ...overrides,
  };
}

async function aWorld() {
  return createTwoOrganizations(harness.app, harness.connections, {
    industryTemplateKey: "RETAIL",
  });
}

function storefrontPage(organizationId: string, pageKey = "ABOUT") {
  return callStorefront(harness.app, {
    method: "get",
    organizationId,
    suffix: `/pages/${pageKey}`,
  });
}

describe("website pages API", () => {
  it("stores a page, then answers it on the storefront once published", async () => {
    const world = await aWorld();
    const organizationA = world.organizationA;

    const saved = await world.alice.call("put", pagePath(organizationA), pageBody());
    expect(saved.status).toBe(200);
    expect(saved.body.data.version).toBe(1);
    expect((await storefrontPage(organizationA)).status).toBe(404);

    const published = await world.alice.call(
      "put",
      pagePath(organizationA),
      pageBody({ isPublished: true, version: 1 }),
    );
    expect(published.status).toBe(200);

    const answered = await storefrontPage(organizationA);
    expect(answered.status).toBe(200);
    expect(answered.body.data).toEqual({
      pageKey: "ABOUT",
      title: { bn: "আমাদের সম্পর্কে", en: "About us" },
      body: { bn: "", en: "We are a small team." },
    });
  });

  it("refuses a stale page version with 409 and changes nothing", async () => {
    const world = await aWorld();
    const organizationA = world.organizationA;
    await world.alice.call("put", pagePath(organizationA), pageBody());
    const second = await world.alice.call(
      "put",
      pagePath(organizationA),
      pageBody({ version: 1, title: { bn: "", en: "Second" } }),
    );
    expect(second.status).toBe(200);

    const stale = await world.alice.call(
      "put",
      pagePath(organizationA),
      pageBody({ version: 1, title: { bn: "", en: "Stale" } }),
    );
    expect(stale.status).toBe(409);

    const listed = await world.alice.call("get", `/orgs/${organizationA}/website/pages`);
    const about = listed.body.data.find((row: { pageKey: string }) => row.pageKey === "ABOUT");
    expect(about.version).toBe(2);
    expect(about.title.en).toBe("Second");
  });

  it("refuses a title over 120 characters and a body over 20,000 with 400", async () => {
    const world = await aWorld();
    const organizationA = world.organizationA;

    const longTitle = await world.alice.call(
      "put",
      pagePath(organizationA),
      pageBody({ title: { bn: "", en: "x".repeat(TITLE_LIMIT + 1) } }),
    );
    expect(longTitle.status).toBe(400);

    const longBody = await world.alice.call(
      "put",
      pagePath(organizationA),
      pageBody({ body: { bn: "", en: "x".repeat(BODY_LIMIT + 1) } }),
    );
    expect(longBody.status).toBe(400);
  });

  it("refuses publishing a page with no title in either language", async () => {
    const world = await aWorld();
    const response = await world.alice.call(
      "put",
      pagePath(world.organizationA),
      pageBody({ title: { bn: "", en: "" }, isPublished: true }),
    );
    expect(response.status).toBe(400);
  });

  it("lets a staff member read pages but not change them", async () => {
    const world = await aWorld();
    const organizationA = world.organizationA;

    const read = await world.sam.call("get", `/orgs/${organizationA}/website/pages`);
    expect(read.status).toBe(200);
    expect(read.body.data).toHaveLength(6);

    const write = await world.sam.call("put", pagePath(organizationA), pageBody());
    expect(write.status).toBe(403);
  });

  it("does not show one organization's page to another", async () => {
    const world = await aWorld();
    await world.alice.call("put", pagePath(world.organizationA), pageBody({ isPublished: true }));

    expect((await storefrontPage(world.organizationA)).status).toBe(200);
    expect((await storefrontPage(world.organizationB)).status).toBe(404);

    const crossRead = await world.bob.call("get", `/orgs/${world.organizationA}/website/pages`);
    expect([403, 404]).toContain(crossRead.status);
  });

  it("lists all six page keys, a missing one as an empty unpublished page", async () => {
    const world = await aWorld();
    const listed = await world.alice.call("get", `/orgs/${world.organizationA}/website/pages`);
    expect(listed.status).toBe(200);
    expect(listed.body.data).toHaveLength(6);
    const faq = listed.body.data.find((row: { pageKey: string }) => row.pageKey === "FAQ");
    expect(faq).toEqual({
      pageKey: "FAQ",
      title: { bn: "", en: "" },
      body: { bn: "", en: "" },
      isPublished: false,
      version: 0,
      updatedAt: null,
    });
  });
});

describe("storefront site API", () => {
  it("returns branding, features and published page titles only", async () => {
    const world = await aWorld();
    const organizationA = world.organizationA;
    await world.alice.call("put", pagePath(organizationA), pageBody({ isPublished: true }));

    const response = await callStorefront(harness.app, {
      method: "get",
      organizationId: organizationA,
      suffix: "/site",
    });
    expect(response.status).toBe(200);
    expect(Object.keys(response.body.data).sort()).toEqual(
      ["colors", "features", "logoUrl", "name", "organizationId", "pages", "tagline"].sort(),
    );
    expect(response.body.data.pages).toEqual([
      { pageKey: "ABOUT", title: { bn: "আমাদের সম্পর্কে", en: "About us" } },
    ]);
    expect(Object.keys(response.body.data.features).sort()).toEqual([
      "credit",
      "customerLogin",
      "directory",
      "website",
    ]);
  });

  it("answers 404 for pages while the website module is off, and the site lists none", async () => {
    const world = await aWorld();
    await world.alice.call("put", pagePath(world.organizationA), pageBody({ isPublished: true }));
    await writeModuleOverride({
      organizationId: world.organizationA,
      moduleKey: MODULE_KEY.WEBSITE,
      effect: MODULE_OVERRIDE_EFFECT.PLATFORM_REVOKE,
    });

    expect((await storefrontPage(world.organizationA)).status).toBe(404);
    const site = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/site",
    });
    expect(site.status).toBe(200);
    expect(site.body.data.features.website).toBe(false);
    expect(site.body.data.pages).toEqual([]);
  });

  it("reports customer sign-in off until the business switches it on", async () => {
    const world = await aWorld();
    const response = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/site",
    });
    expect(response.body.data.features.customerLogin).toBe(false);
  });
});
