import { MODULE_CLASS, MODULE_KEY, SYSTEM_ROLE_KEY, type SystemRoleKey } from "@banijjik/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Router } from "express";
import { defineModule } from "../../../../kernel/modules/index.js";
import { sendData } from "../../../../kernel/http/index.js";
import { registerIamApiModels, startIamApi } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import { addMemberWithAssignments, findSystemRoleId } from "../../../../test-support/rbac-world.js";
import {
  createTwoOrganizations,
  type ApiActor,
  type TwoOrganizations,
} from "../../../../test-support/two-organizations.js";

const EMPTY = {
  dependsOn: [],
  providesKinds: [],
  requiresAnyKind: [],
  permissions: [],
  menu: [],
  botTools: [],
  storefrontSections: [],
  events: { emits: [], consumes: [] },
  limitKeys: [],
  sequenceKeys: [],
} as const;

const FIELD_PROBE = defineModule({
  ...EMPTY,
  key: MODULE_KEY.NOTIFICATION,
  path: "core/notification",
  moduleClass: MODULE_CLASS.SYSTEM,
  tenantCanDisable: false,
  routes: {},
  settings: [
    {
      settingKey: "notification.probeFlag",
      value: { kind: "BOOLEAN" },
      systemDefault: false,
      allowsLocationOverride: false,
      isClientVisible: false,
    },
  ],
  customFieldEntities: ["contact"],
});

const WORKFLOW_PROBE = defineModule({
  ...EMPTY,
  key: MODULE_KEY.WORKFLOW,
  path: "capability/workflow",
  moduleClass: MODULE_CLASS.OPTIONAL,
  dependsOn: [MODULE_KEY.WEBSITE],
  tenantCanDisable: true,
  routes: { admin: ["/orgs/:organizationId/flows"] },
  settings: [],
  customFieldEntities: [],
});

function probeRouter(): Router {
  const router = Router({ mergeParams: true });
  router.get("/flows", (_request, response) => sendData(response, { module: "workflow" }));
  return router;
}

registerIamApiModels();

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startIamApi({
    tenantRouters: [probeRouter()],
    extraManifests: [FIELD_PROBE, WORKFLOW_PROBE],
  });
});

afterAll(async () => {
  await harness.dispose();
});

function world(): Promise<TwoOrganizations> {
  return createTwoOrganizations(harness.app, harness.connections, {
    industryTemplateKey: "RETAIL",
  });
}

async function useSalon(organizationId: string): Promise<void> {
  await harness.connections.platform
    .collection("organizations")
    .updateOne(
      { organizationId },
      { $set: { industryTemplateKey: "SALON" }, $inc: { configVersion: 1 } },
    );
}

async function configVersion(organizationId: string): Promise<number> {
  const row = await harness.connections.platform
    .collection("organizations")
    .findOne({ organizationId });
  return Number(row?.["configVersion"]);
}

function audits(organizationId: string, action: string): Promise<unknown[]> {
  return harness.connections.tenantShared
    .collection("audit_logs")
    .find({ organizationId, action })
    .toArray();
}

function events(organizationId: string, type: string): Promise<unknown[]> {
  return harness.connections.platform
    .collection("outbox_events")
    .find({ organizationId, type })
    .toArray();
}

async function member(world: TwoOrganizations, roleKey: SystemRoleKey): Promise<ApiActor> {
  const roleId = await findSystemRoleId(harness.connections, world.organizationA, roleKey);
  const added = await addMemberWithAssignments(harness.app, world.organizationA, [
    { locationId: world.locationA1, roleId },
  ]);
  return added.actor;
}

describe("terms", () => {
  it("shows the template, then an override, then the template again", async () => {
    const organizations = await world();
    await useSalon(organizations.organizationA);
    const path = `/orgs/${organizations.organizationA}/terms`;
    const listed = await organizations.alice.call("get", path);
    const before = await configVersion(organizations.organizationA);

    const patched = await organizations.alice.call("patch", path, {
      items: [{ termKey: "contact", locale: "bn", text: "অতিথি" }],
    });
    const config = await organizations.alice.call(
      "get",
      `/orgs/${organizations.organizationA}/me/config`,
    );
    const afterPatch = await audits(organizations.organizationA, "settings.term.changed");
    const eventsAfterPatch = await events(organizations.organizationA, "settings.term.changed");
    const versionAfterPatch = await configVersion(organizations.organizationA);

    const removed = await organizations.alice.call("patch", path, {
      items: [{ termKey: "contact", locale: "bn", text: null, version: 1 }],
    });
    const unchanged = await organizations.alice.call("patch", path, {
      items: [{ termKey: "contact", locale: "bn", text: "ক্লায়েন্ট" }],
    });

    expect(listed.status).toBe(200);
    expect(
      listed.body.data.terms.find((row: { termKey: string }) => row.termKey === "contact"),
    ).toMatchObject({
      bn: { text: "ক্লায়েন্ট", source: "INDUSTRY" },
      en: { text: "Client", source: "INDUSTRY" },
    });
    expect(patched.status).toBe(200);
    expect(config.body.data.terms.contact).toEqual({ bn: "অতিথি", en: "Client" });
    expect(afterPatch).toHaveLength(1);
    expect(eventsAfterPatch).toHaveLength(1);
    expect(versionAfterPatch).toBe(before + 1);
    expect(
      removed.body.data.terms.find((row: { termKey: string }) => row.termKey === "contact").bn.text,
    ).toBe("ক্লায়েন্ট");
    expect(unchanged.status).toBe(200);
    expect(await audits(organizations.organizationA, "settings.term.changed")).toHaveLength(2);
  });

  it("refuses an unknown key, a bad text, a stale version, staff and a one-location manager", async () => {
    const organizations = await world();
    await useSalon(organizations.organizationA);
    const path = `/orgs/${organizations.organizationA}/terms`;
    const staff = await member(organizations, SYSTEM_ROLE_KEY.STAFF);
    const manager = await member(organizations, SYSTEM_ROLE_KEY.MANAGER);
    await organizations.alice.call("patch", path, {
      items: [{ termKey: "contact", locale: "en", text: "Guest" }],
    });

    const unknown = await organizations.alice.call("patch", path, {
      items: [{ termKey: "not-a-term", locale: "bn", text: "ক" }],
    });
    const empty = await organizations.alice.call("patch", path, {
      items: [{ termKey: "contact", locale: "bn", text: "  " }],
    });
    const long = await organizations.alice.call("patch", path, {
      items: [{ termKey: "contact", locale: "bn", text: "ক".repeat(41) }],
    });
    const stale = await organizations.alice.call("patch", path, {
      items: [{ termKey: "contact", locale: "en", text: "Patron", version: 9 }],
    });
    const staffWrite = await staff.call("patch", path, {
      items: [{ termKey: "contact", locale: "bn", text: "অতিথি" }],
    });
    const managerWrite = await manager.call("patch", path, {
      items: [{ termKey: "contact", locale: "bn", text: "অতিথি" }],
    });
    const foreign = await organizations.bob.call("get", path);

    expect(unknown.status).toBe(404);
    expect(unknown.body.error.messageKey).toBe("errors.term_not_available");
    expect(empty.status).toBe(400);
    expect(long.status).toBe(400);
    expect(stale.status).toBe(409);
    expect(staffWrite.status).toBe(403);
    expect(managerWrite.status).toBe(403);
    expect(foreign.status).toBe(404);
  });
});

describe("resolved config", () => {
  it("returns client-visible settings and probe fields, and hides a private setting", async () => {
    const organizations = await world();
    const configPath = `/orgs/${organizations.organizationA}/me/config`;
    const started = Date.now();
    const before = await organizations.alice.call("get", configPath);
    const elapsed = Date.now() - started;
    const bytes = Buffer.byteLength(JSON.stringify(before.body));

    const patched = await organizations.alice.call(
      "patch",
      `/orgs/${organizations.organizationA}/settings`,
      {
        items: [{ settingKey: "organization.digitScript", value: "BENGALI" }],
      },
    );
    const afterSetting = await organizations.alice.call("get", configPath);
    const created = await organizations.alice.call(
      "post",
      `/orgs/${organizations.organizationA}/custom-fields`,
      {
        entityType: "contact",
        fieldKey: "visit_note",
        label: { bn: "নোট", en: "Note" },
        fieldType: "TEXT",
        isRequired: false,
        visibility: { admin: true, storefront: false, bot: false },
        botAsk: false,
        isSearchable: false,
        isSensitive: false,
        sortOrder: 20,
      },
    );
    const afterField = await organizations.alice.call("get", configPath);

    expect(bytes, `cold /me/config ${bytes} bytes in ${elapsed}ms`).toBeLessThan(50 * 1024);
    expect(before.body.data.settings["organization.digitScript"]).toBe("LATIN");
    expect(before.body.data.settings["notification.probeFlag"]).toBeUndefined();
    expect(patched.status).toBe(200);
    expect(afterSetting.body.data.settings["organization.digitScript"]).toBe("BENGALI");
    expect(created.status).toBe(201);
    expect(
      afterField.body.data.fields.contact.some(
        (field: { fieldKey: string }) => field.fieldKey === "visit_note",
      ),
    ).toBe(true);
  });

  it("shows a template term added after the reader window", async () => {
    const organizations = await world();
    await useSalon(organizations.organizationA);
    const configPath = `/orgs/${organizations.organizationA}/me/config`;
    await organizations.alice.call("get", configPath);
    await harness.connections.platform.collection("industry_templates").updateOne(
      { industryTemplateKey: "SALON" },
      {
        $set: { "configuration.terms.menuProbe": { bn: "নতুন", en: "New" } },
        $inc: { version: 1 },
      },
    );
    const duringWindow = await organizations.alice.call("get", configPath);
    harness.clock.advanceSeconds(31);
    const afterWindow = await organizations.alice.call("get", configPath);

    expect(duringWindow.body.data.terms.menuProbe).toBeUndefined();
    expect(afterWindow.body.data.terms.menuProbe).toEqual({ bn: "নতুন", en: "New" });
  });
});

describe("tenant module switches", () => {
  it("disables an optional module, refuses the others, and enables it again", async () => {
    const organizations = await world();
    const base = `/orgs/${organizations.organizationA}/modules`;
    const staff = await member(organizations, SYSTEM_ROLE_KEY.STAFF);
    const manager = await member(organizations, SYSTEM_ROLE_KEY.MANAGER);

    const disabled = await organizations.alice.call("post", `${base}/workflow/disable`, {
      reason: "not used",
    });
    const hidden = await organizations.alice.call(
      "get",
      `/orgs/${organizations.organizationA}/me/config`,
    );
    const route = await organizations.alice.call(
      "get",
      `/orgs/${organizations.organizationA}/flows`,
    );
    const enabled = await organizations.alice.call("post", `${base}/workflow/enable`, {
      reason: "needed",
    });
    const back = await organizations.alice.call(
      "get",
      `/orgs/${organizations.organizationA}/flows`,
    );
    const fixed = await organizations.alice.call("post", `${base}/iam/disable`, { reason: "no" });
    const required = await organizations.alice.call("post", `${base}/website/disable`, {
      reason: "no",
    });
    const staffWrite = await staff.call("post", `${base}/workflow/disable`, { reason: "no" });
    const managerWrite = await manager.call("post", `${base}/workflow/disable`, { reason: "no" });
    const foreign = await organizations.bob.call("get", base);

    expect(disabled.status).toBe(200);
    expect(hidden.body.data.modules).not.toContain("workflow");
    expect(route.status).toBe(403);
    expect(route.body.error.code).toBe("MODULE_DISABLED");
    expect(enabled.status).toBe(200);
    expect(back.status).toBe(200);
    expect(fixed.status).toBe(422);
    expect(fixed.body.error.messageKey).toBe("errors.module_not_tenant_disablable");
    expect(required.status).toBe(422);
    expect(required.body.error.details.requiredBy).toEqual(["workflow"]);
    expect(staffWrite.status).toBe(403);
    expect(managerWrite.status).toBe(403);
    expect(foreign.status).toBe(404);
  });
});
