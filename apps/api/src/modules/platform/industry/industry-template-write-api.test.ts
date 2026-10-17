import {
  MODULE_CLASS,
  MODULE_KEY,
  ORGANIZATION_EVENT_TYPE,
  PLATFORM_AUDIT_ACTION,
  PLATFORM_ROLE,
} from "@banijjik/contracts";
import type { Response } from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { defineModule } from "../../../kernel/modules/index.js";
import { asCookies, callApi } from "../../../test-support/auth-api-client.js";
import { registerViaApi } from "../../../test-support/auth-api-scenarios.js";
import {
  registerIamApiModels,
  startIamApi,
  type IamApiHarness,
} from "../../../test-support/iam-api-harness.js";
import { createOrganizationAs, newActor } from "../../../test-support/organization-tenant-world.js";
import { createPlatformActor, type PlatformActor } from "../../../test-support/platform-world.js";
import { loadSeedIndustryTemplates } from "./infrastructure/load-seed-templates.js";

registerIamApiModels();

/** CORE booking, so /me/config can show it once a template allows it. */
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

const RETAIL_MODULES = [
  "ai",
  "audit",
  "contact",
  "custom-field",
  "file",
  "iam",
  "organization",
  "settings",
];
const WITH_BOOKING = [
  "ai",
  "audit",
  "booking",
  "contact",
  "custom-field",
  "file",
  "iam",
  "organization",
  "settings",
];

interface TemplateDetail {
  readonly industryTemplateId: string;
  readonly industryTemplateKey: string;
  readonly status: string;
  readonly version: number;
  readonly enabledKinds: readonly string[];
  readonly allowedModuleKeys: readonly string[];
  readonly configuration: {
    readonly customFields: readonly { readonly fieldKey: string }[];
    readonly contactRoleKeys: readonly string[];
    readonly terms: Readonly<Record<string, unknown>>;
    readonly settingsDefaults: Readonly<Record<string, unknown>>;
  };
  readonly pendingSettingKeys: readonly string[];
}

let harness: IamApiHarness;
let operator: PlatformActor;

beforeAll(async () => {
  harness = await startIamApi({ tenantRouters: [], extraManifests: [BOOKING_PROBE] });
  operator = await createPlatformActor(harness.app, harness.connections, [
    PLATFORM_ROLE.SUPER_ADMIN,
  ]);
});

afterAll(async () => {
  if (harness !== undefined) await harness.dispose();
});

function seed(key: string) {
  const found = loadSeedIndustryTemplates().find((entry) => entry.industryTemplateKey === key);
  if (found === undefined) throw new Error(`${key} seed missing`);
  return found;
}

function detailOf(response: Response): TemplateDetail {
  return response.body.data as TemplateDetail;
}

async function createFrom(sourceKey: string, industryTemplateKey: string): Promise<Response> {
  const source = seed(sourceKey);
  return operator.call("post", "/industry-templates", {
    industryTemplateKey,
    name: source.name,
    description: source.description,
    iconKey: source.iconKey,
    reason: "create for 2.1b",
    enabledKinds: source.enabledKinds,
    allowedModuleKeys: source.allowedModuleKeys,
    configuration: source.configuration,
  });
}

async function publish(template: TemplateDetail): Promise<Response> {
  return operator.call("post", `/industry-templates/${template.industryTemplateId}/publish`, {
    version: template.version,
    reason: "publish for 2.1b",
  });
}

async function auditActions(targetId: string): Promise<string[]> {
  const rows = await harness.connections.platform
    .collection("platform_audit_logs")
    .find({ targetId })
    .toArray();
  return rows.map((row) => String(row["action"]));
}

async function readConfig(organizationId: string, cookies: Record<string, string>) {
  return callApi(harness.app, {
    method: "get",
    path: `/api/v1/orgs/${organizationId}/me/config`,
    cookies,
  });
}

describe("POST /platform/industry-templates", () => {
  it("creates PHARMACY as a DRAFT", async () => {
    const response = await createFrom("RETAIL", "PHARMACY");

    expect(response.status).toBe(201);
    expect(detailOf(response).status).toBe("DRAFT");
    expect(detailOf(response).industryTemplateKey).toBe("PHARMACY");
    expect(await auditActions(detailOf(response).industryTemplateId)).toEqual([
      PLATFORM_AUDIT_ACTION.INDUSTRY_TEMPLATE_CREATED,
    ]);
  });

  it("answers 409 when the key is taken and 400 for a bad key or a system module", async () => {
    const retail = seed("RETAIL");
    const taken = await createFrom("RETAIL", "RETAIL");
    const badKey = await operator.call("post", "/industry-templates", {
      industryTemplateKey: "pharmacy",
      name: retail.name,
      description: retail.description,
      iconKey: retail.iconKey,
      reason: "bad key",
      enabledKinds: retail.enabledKinds,
      allowedModuleKeys: retail.allowedModuleKeys,
      configuration: retail.configuration,
    });
    const withIam = await operator.call("post", "/industry-templates", {
      industryTemplateKey: "SYSTEM_SHOP",
      name: retail.name,
      description: retail.description,
      iconKey: retail.iconKey,
      reason: "system module",
      enabledKinds: retail.enabledKinds,
      allowedModuleKeys: ["iam"],
      configuration: retail.configuration,
    });

    expect(taken.status).toBe(409);
    expect(taken.body.error.code).toBe("CONFLICT");
    expect(taken.body.error.messageKey).toBe("errors.industry_template_key_taken");
    expect(badKey.status).toBe(400);
    expect(withIam.status).toBe(400);
    expect(withIam.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("copies kinds, modules and configuration from a template of any status", async () => {
    const listed = await operator.call("get", "/industry-templates?limit=100");
    const salon = (listed.body.data as TemplateDetail[]).find(
      (row) => row.industryTemplateKey === "SALON",
    );
    if (salon === undefined) throw new Error("SALON missing");

    const response = await operator.call("post", "/industry-templates", {
      industryTemplateKey: "SALON_COPY",
      name: seed("SALON").name,
      description: seed("SALON").description,
      iconKey: "scissors",
      reason: "clone salon",
      cloneFromIndustryTemplateId: salon.industryTemplateId,
    });

    expect(response.status).toBe(201);
    expect(detailOf(response).status).toBe("DRAFT");
    expect(detailOf(response).enabledKinds).toEqual(seed("SALON").enabledKinds);
    expect(detailOf(response).allowedModuleKeys).toEqual(seed("SALON").allowedModuleKeys);
    expect(detailOf(response).configuration.contactRoleKeys).toEqual(
      seed("SALON").configuration.contactRoleKeys,
    );
  });
});

describe("PATCH /platform/industry-templates", () => {
  it("moves version, refuses a stale version, and shows a new module after the cache window", async () => {
    const created = detailOf(await createFrom("RETAIL", "CACHE_SHOP"));
    const published = detailOf(await publish(created));
    const owner = await newActor(harness.app);
    const { organizationId } = await createOrganizationAs(owner, harness.connections, {
      industryTemplateKey: "CACHE_SHOP",
    });
    const before = await readConfig(organizationId, asCookies(owner.person.session));
    const stale = await operator.call(
      "patch",
      `/industry-templates/${published.industryTemplateId}`,
      {
        version: created.version,
        reason: "stale",
        iconKey: "store",
      },
    );
    const added = await operator.call(
      "patch",
      `/industry-templates/${published.industryTemplateId}`,
      {
        version: published.version,
        reason: "add booking",
        allowedModuleKeys: [...published.allowedModuleKeys, MODULE_KEY.BOOKING],
      },
    );
    const duringCache = await readConfig(organizationId, asCookies(owner.person.session));
    harness.clock.advanceSeconds(31);
    const afterCache = await readConfig(organizationId, asCookies(owner.person.session));

    expect(published.version).toBe(created.version + 1);
    expect(stale.status).toBe(409);
    expect(added.status).toBe(200);
    expect(detailOf(added).version).toBe(published.version + 1);
    expect(before.body.data.modules).toEqual(RETAIL_MODULES);
    expect(duringCache.body.data.modules).toEqual(RETAIL_MODULES);
    expect(afterCache.body.data.modules).toEqual(WITH_BOOKING);
  });

  it("lists every removal on a published template and accepts an addition", async () => {
    const published = detailOf(await publish(detailOf(await createFrom("SALON", "LOCKED_SHOP"))));
    const configuration = {
      ...seed("SALON").configuration,
      customFields: seed("SALON").configuration.customFields.filter(
        (field) => field.fieldKey !== "skin_type",
      ),
    };
    const removed = await operator.call(
      "patch",
      `/industry-templates/${published.industryTemplateId}`,
      {
        version: published.version,
        reason: "remove parts",
        enabledKinds: published.enabledKinds.filter((kind) => kind !== "SERVICE"),
        allowedModuleKeys: published.allowedModuleKeys.filter((key) => key !== "booking"),
        configuration,
      },
    );
    const added = await operator.call(
      "patch",
      `/industry-templates/${published.industryTemplateId}`,
      {
        version: published.version,
        reason: "add a kind",
        enabledKinds: [...published.enabledKinds, "EVENT"],
      },
    );

    expect(removed.status).toBe(422);
    expect(removed.body.error.details.ruleKey).toBe("INDUSTRY_TEMPLATE_CHANGE_NOT_ADDITIVE");
    expect(removed.body.error.details.removed).toEqual([
      "customField:contact::skin_type",
      "kind:SERVICE",
      "module:booking",
    ]);
    expect(added.status).toBe(200);
    expect(detailOf(added).enabledKinds).toContain("EVENT");
  });

  it("refuses a field type change on a published template", async () => {
    const published = detailOf(await publish(detailOf(await createFrom("SALON", "TYPED_SHOP"))));
    const source = seed("SALON").configuration;
    const changed = await operator.call(
      "patch",
      `/industry-templates/${published.industryTemplateId}`,
      {
        version: published.version,
        reason: "change a field type",
        configuration: {
          ...source,
          customFields: source.customFields.map((field) =>
            field.fieldKey === "skin_type"
              ? { ...field, fieldType: "TEXT", options: undefined, optionLabels: undefined }
              : field,
          ),
        },
      },
    );

    expect(changed.status).toBe(422);
    expect(changed.body.error.details.removed).toContain("fieldType:contact::skin_type");
  });

  it("lets an unused draft remove a module, and locks a draft an organization uses", async () => {
    const unused = detailOf(await createFrom("SALON", "FREE_DRAFT"));
    const freed = await operator.call("patch", `/industry-templates/${unused.industryTemplateId}`, {
      version: unused.version,
      reason: "drop booking",
      allowedModuleKeys: unused.allowedModuleKeys.filter((key) => key !== "booking"),
    });
    const used = detailOf(await createFrom("SALON", "USED_DRAFT"));
    const owner = await newActor(harness.app);
    const { organizationId } = await createOrganizationAs(owner, harness.connections, {
      industryTemplateKey: "RETAIL",
    });
    const moved = await operator.call(
      "post",
      `/organizations/${organizationId}/change-industry-template`,
      { industryTemplateKey: "USED_DRAFT", reason: "pilot on a draft" },
    );
    const locked = await operator.call("patch", `/industry-templates/${used.industryTemplateId}`, {
      version: used.version,
      reason: "drop booking",
      allowedModuleKeys: used.allowedModuleKeys.filter((key) => key !== "booking"),
    });

    expect(freed.status).toBe(200);
    expect(moved.status).toBe(200);
    expect(locked.status).toBe(422);
    expect(locked.body.error.details.removed).toEqual(["module:booking"]);
  });
});

describe("isInUse on the template detail", () => {
  it("is false for an unused draft and true once an organization is moved onto it", async () => {
    const created = await createFrom("SALON", "FLAG_DRAFT");
    const draft = detailOf(created);
    const before = await operator.call("get", `/industry-templates/${draft.industryTemplateId}`);
    const owner = await newActor(harness.app);
    const { organizationId } = await createOrganizationAs(owner, harness.connections, {
      industryTemplateKey: "RETAIL",
    });
    const moved = await operator.call(
      "post",
      `/organizations/${organizationId}/change-industry-template`,
      { industryTemplateKey: "FLAG_DRAFT", reason: "pilot on a draft" },
    );
    const after = await operator.call("get", `/industry-templates/${draft.industryTemplateId}`);
    const renamed = await operator.call(
      "patch",
      `/industry-templates/${draft.industryTemplateId}`,
      {
        version: after.body.data.version,
        reason: "reword the description",
        description: { bn: "নতুন বর্ণনা", en: "New description" },
      },
    );

    expect(created.body.data.isInUse).toBe(false);
    expect(before.body.data.isInUse).toBe(false);
    expect(moved.status).toBe(200);
    expect(after.body.data.isInUse).toBe(true);
    expect(renamed.status).toBe(200);
    expect(renamed.body.data.isInUse).toBe(true);
  });
});

describe("publish and retire", () => {
  it("publishes for signup, retires new signups, and publishes again", async () => {
    const created = detailOf(await createFrom("RETAIL", "SIGNUP_SHOP"));
    const published = detailOf(await publish(created));
    const owner = await newActor(harness.app);
    const signedUp = await createOrganizationAs(owner, harness.connections, {
      industryTemplateKey: "SIGNUP_SHOP",
    });
    const retired = await operator.call(
      "post",
      `/industry-templates/${published.industryTemplateId}/retire`,
      { version: published.version, reason: "stop new signups" },
    );
    const refused = await owner.call("post", "/me/orgs", {
      name: "Late shop",
      slug: "late-signup-shop",
      industryTemplateKey: "SIGNUP_SHOP",
    });
    const stillWorks = await readConfig(signedUp.organizationId, asCookies(owner.person.session));
    const again = await operator.call(
      "post",
      `/industry-templates/${published.industryTemplateId}/publish`,
      { version: detailOf(retired).version, reason: "publish again" },
    );

    expect(published.status).toBe("PUBLISHED");
    expect(retired.status).toBe(200);
    expect(detailOf(retired).status).toBe("RETIRED");
    expect(refused.status).toBe(422);
    expect(refused.body.error.details.ruleKey).toBe("INDUSTRY_TEMPLATE_NOT_AVAILABLE");
    expect(stillWorks.status).toBe(200);
    expect(again.status).toBe(200);
    expect(detailOf(again).status).toBe("PUBLISHED");
  });

  it("refuses an invalid transition and writes no audit when the status is unchanged", async () => {
    const created = detailOf(await createFrom("RETAIL", "STATUS_SHOP"));
    const retired = await operator.call(
      "post",
      `/industry-templates/${created.industryTemplateId}/retire`,
      { version: created.version, reason: "cannot retire a draft" },
    );
    const published = detailOf(await publish(created));
    const before = await auditActions(created.industryTemplateId);
    const repeated = await operator.call(
      "post",
      `/industry-templates/${created.industryTemplateId}/publish`,
      { version: published.version, reason: "already published" },
    );

    expect(retired.status).toBe(422);
    expect(retired.body.error.details.ruleKey).toBe("INDUSTRY_TEMPLATE_STATUS_INVALID");
    expect(repeated.status).toBe(200);
    expect(detailOf(repeated).version).toBe(published.version);
    expect(await auditActions(created.industryTemplateId)).toEqual(before);
  });
});

describe("POST /organizations/{organizationId}/change-industry-template", () => {
  it("moves RETAIL onto SALON, bumps config, and records the event and the audit", async () => {
    const owner = await newActor(harness.app);
    const { organizationId } = await createOrganizationAs(owner, harness.connections, {
      industryTemplateKey: "RETAIL",
    });
    const before = await readConfig(organizationId, asCookies(owner.person.session));

    const moved = await operator.call(
      "post",
      `/organizations/${organizationId}/change-industry-template`,
      { industryTemplateKey: "SALON", reason: "salon is a superset" },
    );
    const after = await readConfig(organizationId, asCookies(owner.person.session));
    const organization = await harness.connections.platform
      .collection("organizations")
      .findOne({ organizationId });
    const events = await harness.connections.platform
      .collection("outbox_events")
      .find({ organizationId, type: ORGANIZATION_EVENT_TYPE.INDUSTRY_TEMPLATE_CHANGED })
      .toArray();
    const audits = await harness.connections.platform
      .collection("platform_audit_logs")
      .find({
        targetId: organizationId,
        action: PLATFORM_AUDIT_ACTION.ORGANIZATION_INDUSTRY_TEMPLATE_CHANGED,
      })
      .toArray();

    expect(moved.status).toBe(200);
    expect(moved.body.data.industryTemplateKey).toBe("SALON");
    expect(moved.body.data.configVersion).toBe(2);
    expect(organization?.["configVersion"]).toBe(2);
    expect(before.body.data.modules).toEqual(RETAIL_MODULES);
    expect(after.body.data.modules).toEqual(WITH_BOOKING);
    expect(events).toHaveLength(1);
    expect(audits).toHaveLength(1);
  });

  it("refuses a narrower template, a retired target and an unknown key, and ignores the same key", async () => {
    const owner = await newActor(harness.app);
    const { organizationId } = await createOrganizationAs(owner, harness.connections, {
      industryTemplateKey: "RETAIL",
    });
    const ontoSalon = await operator.call(
      "post",
      `/organizations/${organizationId}/change-industry-template`,
      { industryTemplateKey: "SALON", reason: "move onto salon first" },
    );
    const retiredTemplate = detailOf(
      await publish(detailOf(await createFrom("SALON", "RETIRED_TARGET"))),
    );
    await operator.call(
      "post",
      `/industry-templates/${retiredTemplate.industryTemplateId}/retire`,
      {
        version: retiredTemplate.version,
        reason: "retire the target",
      },
    );
    const before = await auditActions(organizationId);

    const narrower = await operator.call(
      "post",
      `/organizations/${organizationId}/change-industry-template`,
      { industryTemplateKey: "RETAIL", reason: "retail drops booking" },
    );
    const retired = await operator.call(
      "post",
      `/organizations/${organizationId}/change-industry-template`,
      { industryTemplateKey: "RETIRED_TARGET", reason: "retired target" },
    );
    const unknown = await operator.call(
      "post",
      `/organizations/${organizationId}/change-industry-template`,
      { industryTemplateKey: "BAKERY", reason: "unknown key" },
    );
    const same = await operator.call(
      "post",
      `/organizations/${organizationId}/change-industry-template`,
      { industryTemplateKey: "SALON", reason: "same key" },
    );

    expect(narrower.status).toBe(422);
    expect(narrower.body.error.details.ruleKey).toBe("INDUSTRY_TEMPLATE_CHANGE_NOT_ADDITIVE");
    expect(narrower.body.error.details.removed).toEqual(
      expect.arrayContaining(["kind:SERVICE", "module:booking"]),
    );
    expect(retired.status).toBe(422);
    expect(retired.body.error.details.ruleKey).toBe("INDUSTRY_TEMPLATE_STATUS_INVALID");
    expect(unknown.status).toBe(404);
    expect(ontoSalon.status).toBe(200);
    expect(same.status).toBe(200);
    expect(same.body.data.configVersion).toBe(2);
    expect(await auditActions(organizationId)).toEqual(before);
  });
});

describe("template write permissions", () => {
  it("answers 403 for support and billing, and 401 without a platform session", async () => {
    const created = detailOf(await createFrom("RETAIL", "GUARD_SHOP"));
    const owner = await newActor(harness.app);
    const { organizationId } = await createOrganizationAs(owner, harness.connections, {
      industryTemplateKey: "RETAIL",
    });
    const support = await createPlatformActor(harness.app, harness.connections, [
      PLATFORM_ROLE.SUPPORT,
    ]);
    const billing = await createPlatformActor(harness.app, harness.connections, [
      PLATFORM_ROLE.BILLING,
    ]);
    const person = await registerViaApi(harness.app);
    const paths: { method: "post" | "patch"; path: string; body: object }[] = [
      {
        method: "post",
        path: "/industry-templates",
        body: {
          industryTemplateKey: "GUARD_TWO",
          name: seed("RETAIL").name,
          description: seed("RETAIL").description,
          iconKey: "store",
          reason: "denied",
          cloneFromIndustryTemplateId: created.industryTemplateId,
        },
      },
      {
        method: "patch",
        path: `/industry-templates/${created.industryTemplateId}`,
        body: { version: created.version, reason: "denied", iconKey: "store" },
      },
      {
        method: "post",
        path: `/industry-templates/${created.industryTemplateId}/publish`,
        body: { version: created.version, reason: "denied" },
      },
      {
        method: "post",
        path: `/industry-templates/${created.industryTemplateId}/retire`,
        body: { version: created.version, reason: "denied" },
      },
      {
        method: "post",
        path: `/organizations/${organizationId}/change-industry-template`,
        body: { industryTemplateKey: "SALON", reason: "denied" },
      },
    ];

    for (const call of paths) {
      expect((await support.call(call.method, call.path, call.body)).status).toBe(403);
      expect((await billing.call(call.method, call.path, call.body)).status).toBe(403);
      expect(
        (
          await callApi(harness.app, {
            method: call.method,
            path: `/api/v1/platform${call.path}`,
            body: call.body,
          })
        ).status,
      ).toBe(401);
      expect(
        (
          await callApi(harness.app, {
            method: call.method,
            path: `/api/v1/platform${call.path}`,
            cookies: asCookies(person.session),
            body: call.body,
          })
        ).status,
      ).toBe(401);
    }
  });
});

describe("setting defaults against the registry", () => {
  it("lists organization.digitScript for support and answers 401 without a session", async () => {
    const support = await createPlatformActor(harness.app, harness.connections, [
      PLATFORM_ROLE.SUPPORT,
    ]);
    const listed = await support.call("get", "/setting-definitions");
    const anonymous = await callApi(harness.app, {
      method: "get",
      path: "/api/v1/platform/setting-definitions",
    });
    const rows = listed.body.data as {
      settingKey: string;
      moduleKey: string;
      value: { kind: string; values?: readonly string[] };
    }[];
    const keys = rows.map((row) => row.settingKey);

    expect(listed.status).toBe(200);
    expect(keys).toEqual([...keys].sort((left, right) => left.localeCompare(right, "en")));
    expect(rows.find((row) => row.settingKey === "organization.digitScript")).toMatchObject({
      moduleKey: "organization",
      value: { kind: "ENUM", values: ["LATIN", "BENGALI"] },
    });
    expect(anonymous.status).toBe(401);
  });

  it("rejects a bad registered default and lists an unregistered key as pending", async () => {
    const created = detailOf(await createFrom("RETAIL", "SETTING_SHOP"));
    const invalid = await operator.call(
      "patch",
      `/industry-templates/${created.industryTemplateId}`,
      {
        version: created.version,
        reason: "bad digit script",
        configuration: {
          ...created.configuration,
          settingsDefaults: {
            ...created.configuration.settingsDefaults,
            "organization.digitScript": "ROMAN",
          },
        },
      },
    );
    const accepted = await operator.call(
      "patch",
      `/industry-templates/${created.industryTemplateId}`,
      {
        version: created.version,
        reason: "keep an unbuilt setting",
        configuration: {
          ...created.configuration,
          settingsDefaults: {
            ...created.configuration.settingsDefaults,
            "sales.returnWindowDays": 14,
          },
        },
      },
    );

    expect(invalid.status).toBe(422);
    expect(invalid.body.error.code).toBe("BUSINESS_RULE");
    expect(invalid.body.error.details.ruleKey).toBe("INDUSTRY_TEMPLATE_SETTING_INVALID");
    expect(invalid.body.error.details.settingKeys).toEqual(["organization.digitScript"]);
    expect(accepted.status).toBe(200);
    expect(detailOf(accepted).pendingSettingKeys).toContain("sales.returnWindowDays");
  });
});
