import {
  MODULE_CLASS,
  MODULE_KEY,
  MODULE_OVERRIDE_EFFECT,
  PACKAGE_KEY,
  PLATFORM_ROLE,
  SEED_INDUSTRY_TEMPLATE_KEY,
} from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { defineModule } from "../../../kernel/modules/index.js";
import { IndustryTemplate } from "./domain/industry-template.entity.js";
import { loadSeedIndustryTemplates } from "./infrastructure/load-seed-templates.js";
import { MongoIndustryTemplateRepository } from "./infrastructure/mongo-industry-template.repository.js";
import { asCookies, callApi } from "../../../test-support/auth-api-client.js";
import { registerViaApi, type RegisteredPerson } from "../../../test-support/auth-api-scenarios.js";
import { writeModuleOverride } from "../../../test-support/entitlement-world.js";
import {
  registerIamApiModels,
  startIamApi,
  type IamApiHarness,
} from "../../../test-support/iam-api-harness.js";
import {
  asPlatformCookies,
  createPlatformActor,
  type PlatformActor,
} from "../../../test-support/platform-world.js";

registerIamApiModels();

/** CORE booking, so a template that does not list it must drop it even when a grant or package names it. */
const BOOKING_PROBE = defineModule({
  key: MODULE_KEY.BOOKING,
  path: "capability/booking",
  moduleClass: MODULE_CLASS.CORE,
  dependsOn: [],
  providesKinds: [],
  requiresAnyKind: [],
  tenantCanDisable: false,
  permissions: [],
  routes: { admin: ["/orgs/:organizationId/bookings"] },
  menu: [],
  settings: [],
  customFieldEntities: [],
  botTools: [],
  storefrontSections: [],
  events: { emits: [], consumes: [] },
  limitKeys: [],
  sequenceKeys: [],
});

const RETAIL_MODULES = ["audit", "custom-field", "file", "iam", "organization", "settings"];
const SALON_MODULES = [
  "audit",
  "booking",
  "custom-field",
  "file",
  "iam",
  "organization",
  "settings",
];

let harness: IamApiHarness;
let issuedSlugs = 0;

beforeAll(async () => {
  harness = await startIamApi({ tenantRouters: [], extraManifests: [BOOKING_PROBE] });
  await insertRetiredTemplate();
});

afterAll(async () => {
  await harness.dispose();
});

function freshSlug(): string {
  issuedSlugs += 1;
  return `industry-${issuedSlugs}`;
}

function createOrganization(person: RegisteredPerson, industryTemplateKey: string) {
  return callApi(harness.app, {
    method: "post",
    path: "/api/v1/me/orgs",
    cookies: asCookies(person.session),
    body: { name: "Rahim Store", slug: freshSlug(), industryTemplateKey },
  });
}

async function insertRetiredTemplate(): Promise<void> {
  const salon = loadSeedIndustryTemplates().find(
    (entry) => entry.industryTemplateKey === SEED_INDUSTRY_TEMPLATE_KEY.SALON,
  );
  if (salon === undefined) throw new Error("salon seed missing");
  await new MongoIndustryTemplateRepository().insert(
    IndustryTemplate.create({
      ...salon,
      industryTemplateKey: "RETIRED_SHOP",
      status: "RETIRED",
      now: new Date(),
    }),
  );
}

async function readConfig(person: RegisteredPerson, organizationId: string) {
  return callApi(harness.app, {
    method: "get",
    path: `/api/v1/orgs/${organizationId}/me/config`,
    cookies: asCookies(person.session),
  });
}

describe("signup template availability", () => {
  it("accepts the two published templates", async () => {
    const person = await registerViaApi(harness.app);

    const retail = await createOrganization(person, "RETAIL");
    const fcommerce = await createOrganization(person, "FCOMMERCE");

    expect(retail.status).toBe(201);
    expect(fcommerce.status).toBe(201);
  });

  it.each([
    ["a draft", "SALON"],
    ["a retired template", "RETIRED_SHOP"],
    ["an unknown key", "BAKERY"],
  ])("rejects %s with 422", async (_label, industryTemplateKey) => {
    const person = await registerViaApi(harness.app);

    const response = await createOrganization(person, industryTemplateKey);

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("BUSINESS_RULE");
    expect(response.body.error.details.ruleKey).toBe("INDUSTRY_TEMPLATE_NOT_AVAILABLE");
  });
});

describe("template filter on GET /me/config", () => {
  it("hides booking on RETAIL even with a package entry and a grant, and shows it on SALON", async () => {
    const person = await registerViaApi(harness.app);
    const created = await createOrganization(person, "RETAIL");
    const organizationId = created.body.data.organizationId as string;
    await harness.connections.platform
      .collection("packages")
      .updateOne(
        { packageKey: PACKAGE_KEY.BUNDLE },
        { $addToSet: { moduleKeys: MODULE_KEY.BOOKING } },
      );
    harness.clock.advanceSeconds(6);
    await writeModuleOverride({
      organizationId,
      moduleKey: MODULE_KEY.BOOKING,
      effect: MODULE_OVERRIDE_EFFECT.PLATFORM_GRANT,
    });

    const retail = await readConfig(person, organizationId);
    await harness.connections.platform
      .collection("organizations")
      .updateOne(
        { organizationId },
        { $set: { industryTemplateKey: "SALON" }, $inc: { configVersion: 1 } },
      );
    const salon = await readConfig(person, organizationId);

    expect(retail.status).toBe(200);
    expect(retail.body.data.modules).toEqual(RETAIL_MODULES);
    expect(salon.status).toBe(200);
    expect(salon.body.data.modules).toEqual(SALON_MODULES);
  });
});

describe("GET /industry-templates", () => {
  it("lists only the published templates, in key order, in both languages", async () => {
    const person = await registerViaApi(harness.app);

    const response = await callApi(harness.app, {
      method: "get",
      path: "/api/v1/industry-templates",
      cookies: asCookies(person.session),
    });

    expect(response.status).toBe(200);
    expect(
      response.body.data.map((card: { industryTemplateKey: string }) => card.industryTemplateKey),
    ).toEqual(["FCOMMERCE", "RETAIL"]);
    expect(response.body.data[0].name.bn).toBe("অনলাইন বিক্রেতা");
    expect(response.body.data[0].name.en).toBe("Online seller");
    expect(response.body.data[0].description.en).toContain("Facebook");
  });

  it("answers 401 without a session and 401 for a platform operator cookie", async () => {
    const operator = await createPlatformActor(harness.app, harness.connections, [
      PLATFORM_ROLE.SUPER_ADMIN,
    ]);

    const anonymous = await callApi(harness.app, {
      method: "get",
      path: "/api/v1/industry-templates",
    });
    const platformCookie = await callApi(harness.app, {
      method: "get",
      path: "/api/v1/industry-templates",
      cookies: asPlatformCookies(operator.cookies),
    });

    expect(anonymous.status).toBe(401);
    expect(platformCookie.status).toBe(401);
  });
});

describe("GET /platform/industry-templates", () => {
  async function actor(
    role: (typeof PLATFORM_ROLE)[keyof typeof PLATFORM_ROLE],
  ): Promise<PlatformActor> {
    return createPlatformActor(harness.app, harness.connections, [role]);
  }

  it("lets a super admin, support and billing list and read one template", async () => {
    const superAdmin = await actor(PLATFORM_ROLE.SUPER_ADMIN);
    const support = await actor(PLATFORM_ROLE.SUPPORT);
    const billing = await actor(PLATFORM_ROLE.BILLING);

    const listed = await superAdmin.call("get", "/industry-templates?status=PUBLISHED");
    const drafts = await support.call("get", "/industry-templates?status=DRAFT");
    const templateId = listed.body.data[0].industryTemplateId as string;
    const detail = await billing.call("get", `/industry-templates/${templateId}`);

    expect(listed.status).toBe(200);
    expect(
      listed.body.data.map((row: { industryTemplateKey: string }) => row.industryTemplateKey),
    ).toEqual(["FCOMMERCE", "RETAIL"]);
    expect(listed.body.meta).toMatchObject({ page: 1, hasNext: false });
    expect(drafts.status).toBe(200);
    expect(drafts.body.data).toHaveLength(6);
    expect(detail.status).toBe(200);
    expect(detail.body.data.configuration.contactRoleKeys).toEqual(
      expect.arrayContaining(["CUSTOMER"]),
    );
  });

  it("answers 404 for an unknown id", async () => {
    const superAdmin = await actor(PLATFORM_ROLE.SUPER_ADMIN);

    const response = await superAdmin.call("get", `/industry-templates/${newId()}`);

    expect(response.status).toBe(404);
  });

  it("answers 401 without a platform session and 401 for an admin cookie", async () => {
    const person = await registerViaApi(harness.app);

    const anonymous = await callApi(harness.app, {
      method: "get",
      path: "/api/v1/platform/industry-templates",
    });
    const adminCookie = await callApi(harness.app, {
      method: "get",
      path: "/api/v1/platform/industry-templates",
      cookies: asCookies(person.session),
    });

    expect(anonymous.status).toBe(401);
    expect(adminCookie.status).toBe(401);
  });
});
