import {
  ERROR_CODE,
  MODULE_KEY,
  MODULE_OVERRIDE_EFFECT,
  SYSTEM_ROLE_KEY,
} from "@banijjik/contracts";
import {
  CONSERVATIVE_PAGE_RULES,
  SITE_PAGE_KEY,
  type SiteDesign,
  type SiteEditPolicy,
} from "@banijjik/contracts/website";
import {
  asId,
  newId,
  type OrganizationId,
  type SiteId,
  type UserId,
  type WebsiteVersionId,
} from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { models } from "../../../kernel/db/index.js";
import { writeModuleOverride } from "../../../test-support/entitlement-world.js";
import {
  registerIamApiModels,
  startIamApi,
  type IamApiHarness,
} from "../../../test-support/iam-api-harness.js";
import { withOrganizationContext } from "../../../test-support/organization-context.js";
import { addMemberWithAssignments, findSystemRoleId } from "../../../test-support/rbac-world.js";
import { callStorefront } from "../../../test-support/storefront-world.js";
import { createTwoOrganizations } from "../../../test-support/two-organizations.js";
import { Site } from "./domain/site.entity.js";
import { MongoSiteRepository } from "./infrastructure/mongo-site.repository.js";
import { SITE_PAGE_MODEL_NAME, type SitePageDocument } from "./infrastructure/site-page.schema.js";
import {
  WEBSITE_VERSION_MODEL_NAME,
  type WebsiteVersionDocument,
} from "./infrastructure/website-version.schema.js";

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
      publicationState: "LEGACY",
      siteVersion: null,
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

const SECTION_ID_A = "01926b48-1234-7abc-8def-0123456789a1";
const SECTION_ID_B = "01926b48-1234-7abc-8def-0123456789a2";
const SECTION_ID_C = "01926b48-1234-7abc-8def-0123456789a3";
const SECTION_ID_D = "01926b48-1234-7abc-8def-0123456789a4";
const SAMPLE_TEXT = { bn: "শিরোনাম", en: "Title" };

function sampleSiteDesign(staticContent: SiteDesign["staticContent"] = []): SiteDesign {
  return {
    schemaVersion: 1,
    tokens: {
      color: {
        primary: "#15803d",
        accent: "#16a34a",
        background: "#ffffff",
        surface: "#f8fafc",
        text: "#0f172a",
        mutedText: "#334155",
        onPrimary: "#ffffff",
        focus: "#1d4ed8",
      },
      type: { fontPairKey: "inter-noto", scale: "MEDIUM" },
      shape: {
        cardRadius: "MEDIUM",
        buttonRadius: "MEDIUM",
        inputRadius: "SMALL",
        imageRadius: "SMALL",
        border: "THIN",
        shadow: "LOW",
      },
      spacing: { density: "COMFORTABLE" },
      size: {
        imageRatio: "LANDSCAPE",
        cardSize: "MEDIUM",
        columns: { mobile: 1, tablet: 2, desktop: 3 },
      },
    },
    header: {
      sectionId: SECTION_ID_A,
      sectionKey: "header",
      variantKey: "SIMPLE",
      regionKey: "header",
      binding: null,
      content: { links: [{ label: SAMPLE_TEXT, path: "/home" }] },
    },
    footer: {
      sectionId: SECTION_ID_B,
      sectionKey: "footer",
      variantKey: "SIMPLE",
      regionKey: "footer",
      binding: null,
      content: { links: [{ label: SAMPLE_TEXT, path: "/home" }] },
    },
    pages: [
      {
        pageId: SECTION_ID_C,
        path: "/home",
        title: SAMPLE_TEXT,
        seo: { description: { bn: "", en: "" }, noIndex: false },
        sections: [
          {
            sectionId: SECTION_ID_D,
            sectionKey: "hero",
            variantKey: "SPLIT",
            regionKey: "main",
            binding: null,
            content: { heading: SAMPLE_TEXT, body: { bn: "স্বাগতম", en: "Welcome" } },
          },
        ],
      },
    ],
    staticContent,
  };
}

function staticPageRegions(): SiteEditPolicy["regions"] {
  return Object.values(SITE_PAGE_KEY).map((pageKey) => ({
    regionKey: `static.${pageKey}`,
    lock: "CONTENT_ONLY" as const,
    required: false,
    sectionKeys: [],
    maxSections: 1,
    editableContentKeys: ["title", "body", "includeInPublication"],
  }));
}

function openStaticPolicy(): SiteEditPolicy {
  return {
    regions: [
      {
        regionKey: "header",
        lock: "LOCKED",
        required: true,
        sectionKeys: ["header"],
        maxSections: 1,
        editableContentKeys: [],
      },
      {
        regionKey: "footer",
        lock: "FULL",
        required: true,
        sectionKeys: ["footer"],
        maxSections: 1,
        editableContentKeys: ["links"],
      },
      {
        regionKey: "main",
        lock: "FULL",
        required: false,
        sectionKeys: ["hero", "rich-text"],
        maxSections: 5,
        editableContentKeys: [],
      },
      ...staticPageRegions(),
    ],
    tokenGroups: { color: true, type: true, shape: true, spacing: true, size: true },
    allowedColors: null,
    allowedVariantsBySection: {
      header: ["SIMPLE"],
      footer: ["SIMPLE"],
      hero: ["SPLIT", "CENTERED"],
    },
    pageRules: CONSERVATIVE_PAGE_RULES,
  };
}

async function insertDraftSite(organizationId: string, actorUserId: string): Promise<Site> {
  return withOrganizationContext(organizationId, async () => {
    const site = Site.create({
      organizationId: asId<OrganizationId>(organizationId),
      draftDesign: sampleSiteDesign(),
      editPolicy: openStaticPolicy(),
      sourceTemplateKey: "retail-starter",
      sourceTemplateRevision: 1,
      now: new Date(),
      actorUserId: asId<UserId>(actorUserId),
    });
    const outcome = await new MongoSiteRepository().insert(site);
    if (outcome !== "inserted") throw new Error("site insert failed");
    return site;
  });
}

async function readLegacyAbout(organizationId: string): Promise<SitePageDocument | null> {
  return withOrganizationContext(organizationId, async () => {
    return models({})
      .get<SitePageDocument>(SITE_PAGE_MODEL_NAME)
      .findOne({ pageKey: "ABOUT" })
      .lean();
  });
}

async function insertPublishedSite(input: {
  readonly organizationId: string;
  readonly liveTitle: string;
  readonly draftTitle: string;
}): Promise<void> {
  const websiteVersionId = newId();
  const now = new Date();
  await withOrganizationContext(input.organizationId, async () => {
    const site = Site.rehydrate({
      siteId: asId<SiteId>(newId()),
      organizationId: asId<OrganizationId>(input.organizationId),
      draftDesign: sampleSiteDesign([
        {
          pageKey: "ABOUT",
          title: { bn: "", en: input.draftTitle },
          body: { bn: "", en: "Draft body" },
          includeInPublication: true,
        },
      ]),
      editPolicy: openStaticPolicy(),
      sourceTemplateKey: "retail-starter",
      sourceTemplateRevision: 1,
      publishedWebsiteVersionId: asId<WebsiteVersionId>(websiteVersionId),
      nextRevision: 2,
      hasPublishedOnce: true,
      canonicalSiteDomainId: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
      createdByUserId: null,
      updatedByUserId: null,
    });
    await models({})
      .get<WebsiteVersionDocument>(WEBSITE_VERSION_MODEL_NAME)
      .create({
        websiteVersionId,
        organizationId: input.organizationId,
        siteId: site.siteId,
        revision: 1,
        schemaVersion: 1,
        design: sampleSiteDesign([
          {
            pageKey: "ABOUT",
            title: { bn: "", en: input.liveTitle },
            body: { bn: "", en: "Live body" },
            includeInPublication: true,
          },
        ]),
        sourceTemplateKey: "retail-starter",
        sourceTemplateRevision: 1,
        publishedByUserId: null,
        publishedByPlatformOperatorId: null,
        publishedAt: now,
        createdByUserId: null,
        updatedByUserId: null,
      });
    const outcome = await new MongoSiteRepository().insert(site);
    if (outcome !== "inserted") throw new Error("published site insert failed");
  });
}

describe("website pages API after a Site exists", () => {
  it("keeps the public URL on the frozen legacy page while the Site edit stays draft", async () => {
    const world = await aWorld();
    const organizationA = world.organizationA;
    const published = await world.alice.call(
      "put",
      pagePath(organizationA),
      pageBody({ isPublished: true }),
    );
    expect(published.status).toBe(200);
    const site = await insertDraftSite(organizationA, world.alice.userId);

    const edited = await world.alice.call(
      "put",
      pagePath(organizationA),
      pageBody({
        isPublished: true,
        version: 1,
        siteVersion: site.version,
        title: { bn: "", en: "Draft about" },
        body: { bn: "", en: "Only in the draft" },
      }),
    );
    expect(edited.status).toBe(200);
    expect(edited.body.data.publicationState).toBe("DRAFT");
    expect(edited.body.data.siteVersion).toBe(site.version + 1);
    expect(edited.body.data.title.en).toBe("Draft about");

    const publicPage = await storefrontPage(organizationA);
    expect(publicPage.status).toBe(200);
    expect(publicPage.body.data.title.en).toBe("About us");
    expect(publicPage.body.data.body.en).toBe("We are a small team.");

    const legacy = await readLegacyAbout(organizationA);
    expect(legacy?.title.en).toBe("About us");
    expect(legacy?.body.en).toBe("We are a small team.");
    expect(legacy?.isPublished).toBe(true);
  });

  it("refuses a stale or missing siteVersion with 409 and does not write the legacy row", async () => {
    const world = await aWorld();
    const organizationA = world.organizationA;
    await world.alice.call("put", pagePath(organizationA), pageBody({ isPublished: true }));
    const site = await insertDraftSite(organizationA, world.alice.userId);

    const missing = await world.alice.call(
      "put",
      pagePath(organizationA),
      pageBody({ isPublished: true, version: 1, title: { bn: "", en: "No token" } }),
    );
    expect(missing.status).toBe(409);

    const stale = await world.alice.call(
      "put",
      pagePath(organizationA),
      pageBody({
        isPublished: true,
        version: 1,
        siteVersion: site.version + 9,
        title: { bn: "", en: "Stale site" },
      }),
    );
    expect(stale.status).toBe(409);

    const listed = await world.alice.call("get", `/orgs/${organizationA}/website/pages`);
    const about = listed.body.data.find((row: { pageKey: string }) => row.pageKey === "ABOUT");
    expect(about.title.en).toBe("About us");
    expect(about.siteVersion).toBe(site.version);
  });

  it("lets a staff member read the Site-backed list but not change it", async () => {
    const world = await aWorld();
    await insertDraftSite(world.organizationA, world.alice.userId);
    const read = await world.sam.call("get", `/orgs/${world.organizationA}/website/pages`);
    expect(read.status).toBe(200);
    const about = read.body.data.find((row: { pageKey: string }) => row.pageKey === "ABOUT");
    expect(about.publicationState).toBe("DRAFT");

    const write = await world.sam.call(
      "put",
      pagePath(world.organizationA),
      pageBody({ siteVersion: 1 }),
    );
    expect(write.status).toBe(403);
  });

  it("serves the published snapshot after hasPublishedOnce, not the draft or the frozen legacy row", async () => {
    const world = await aWorld();
    const organizationA = world.organizationA;
    await world.alice.call("put", pagePath(organizationA), pageBody({ isPublished: true }));
    await insertPublishedSite({
      organizationId: organizationA,
      liveTitle: "From snapshot",
      draftTitle: "Still draft",
    });

    const publicPage = await storefrontPage(organizationA);
    expect(publicPage.status).toBe(200);
    expect(publicPage.body.data).toEqual({
      pageKey: "ABOUT",
      title: { bn: "", en: "From snapshot" },
      body: { bn: "", en: "Live body" },
    });
    const publicSite = await callStorefront(harness.app, {
      method: "get",
      organizationId: organizationA,
      suffix: "/site",
    });
    expect(publicSite.body.data.pages).toEqual([
      { pageKey: "ABOUT", title: { bn: "", en: "From snapshot" } },
    ]);

    const listed = await world.alice.call("get", `/orgs/${organizationA}/website/pages`);
    const about = listed.body.data.find((row: { pageKey: string }) => row.pageKey === "ABOUT");
    expect(about.publicationState).toBe("PUBLISHED");
    expect(about.title.en).toBe("Still draft");
  });

  it("refuses a static page edit when the stored policy has no static region", async () => {
    const world = await aWorld();
    const organizationA = world.organizationA;
    await withOrganizationContext(organizationA, async () => {
      const site = Site.create({
        organizationId: asId<OrganizationId>(organizationA),
        draftDesign: sampleSiteDesign(),
        editPolicy: { ...openStaticPolicy(), regions: openStaticPolicy().regions.slice(0, 3) },
        sourceTemplateKey: "retail-starter",
        sourceTemplateRevision: 1,
        now: new Date(),
        actorUserId: asId<UserId>(world.alice.userId),
      });
      await new MongoSiteRepository().insert(site);
    });

    const denied = await world.alice.call(
      "put",
      pagePath(organizationA),
      pageBody({ siteVersion: 1, title: { bn: "", en: "Blocked" } }),
    );
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe(ERROR_CODE.WEBSITE_POLICY_DENIED);
  });
});

describe("website site publication API", () => {
  it("publishes a snapshot, then serves it on the public published-site route", async () => {
    const world = await aWorld();
    const site = await insertDraftSite(world.organizationA, world.alice.userId);
    const key = newId();
    const published = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/website/publish`,
      body: { expectedVersion: site.version },
      idempotencyKey: key,
    });
    expect(published.status).toBe(200);
    expect(published.body.data.revision).toBe(1);

    const replay = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/website/publish`,
      body: { expectedVersion: site.version },
      idempotencyKey: key,
    });
    expect(replay.status).toBe(200);
    expect(replay.body.data.websiteVersionId).toBe(published.body.data.websiteVersionId);

    const stale = await world.alice.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/website/publish`,
      body: { expectedVersion: site.version },
      idempotencyKey: newId(),
    });
    expect(stale.status).toBe(409);

    const publicSite = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/published-site",
    });
    expect(publicSite.status).toBe(200);
    expect(publicSite.body.data.revision).toBe(1);
  });

  it("answers the same 404 for an unpublished site and for a business with no site", async () => {
    const world = await aWorld();
    await insertDraftSite(world.organizationA, world.alice.userId);
    const unpublished = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/published-site",
    });
    expect(unpublished.status).toBe(404);

    const missing = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationB,
      suffix: "/published-site",
    });
    expect(missing.status).toBe(404);
  });

  it("refuses a member who holds publish at one location only", async () => {
    const world = await aWorld();
    const site = await insertDraftSite(world.organizationA, world.alice.userId);
    const ownerRoleId = await findSystemRoleId(
      harness.connections,
      world.organizationA,
      SYSTEM_ROLE_KEY.OWNER,
    );
    const { actor } = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: world.locationA1, roleId: ownerRoleId },
    ]);
    const refused = await actor.callWith({
      method: "post",
      path: `/orgs/${world.organizationA}/website/publish`,
      body: { expectedVersion: site.version },
      idempotencyKey: newId(),
    });
    expect(refused.status).toBe(403);
  });
});

describe("website domains on production v1 (card 4.2 A2I)", () => {
  it("lists domains through the composed HostClaims, not a private router", async () => {
    const world = await aWorld();
    await insertDraftSite(world.organizationA, world.alice.userId);
    const list = await world.alice.call("get", `/orgs/${world.organizationA}/website/domains`);
    expect(list.status).toBe(200);
    expect(list.body.data.items).toEqual([]);
    expect(list.body.data.total).toBe(0);
  });
});
