import {
  MODULE_CLASS,
  MODULE_KEY,
  SETTING_VALUE_SOURCE,
  SETTINGS_RULE_KEY,
  SYSTEM_ROLE_KEY,
} from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { registerStructuredSettingSchema } from "@banijjik/validation";
import { z } from "zod";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { defineModule } from "../../../../kernel/modules/index.js";
import { registerIamApiModels, startIamApi } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import { addMemberWithAssignments, findSystemRoleId } from "../../../../test-support/rbac-world.js";
import {
  createTwoOrganizations,
  type ApiActor,
  type TwoOrganizations,
} from "../../../../test-support/two-organizations.js";

/**
 * SYSTEM, so it is effective for every organization. `file` is the kernel probe when a test builds
 * its own router, so this probe uses `notification` (ADR-103).
 */
const LOCATION_PROBE = defineModule({
  key: MODULE_KEY.NOTIFICATION,
  path: "core/notification",
  moduleClass: MODULE_CLASS.SYSTEM,
  dependsOn: [],
  providesKinds: [],
  requiresAnyKind: [],
  tenantCanDisable: false,
  permissions: [],
  routes: {},
  menu: [],
  settings: [
    {
      settingKey: "notification.probeFlag",
      value: { kind: "BOOLEAN" },
      systemDefault: false,
      allowsLocationOverride: true,
      isClientVisible: false,
    },
    {
      settingKey: "notification.probeShape",
      value: { kind: "STRUCTURED", schemaKey: "notification.probeShape" },
      systemDefault: { name: "none" },
      allowsLocationOverride: false,
      isClientVisible: false,
    },
  ],
  customFieldEntities: [],
  botTools: [],
  storefrontSections: [],
  events: { emits: [], consumes: [] },
  limitKeys: [],
  sequenceKeys: [],
});

registerIamApiModels();

let harness: IamApiHarness;

beforeAll(async () => {
  registerStructuredSettingSchema("notification.probeShape", z.object({ name: z.string() }));
  harness = await startIamApi({ tenantRouters: [], extraManifests: [LOCATION_PROBE] });
});

afterAll(async () => {
  await harness.dispose();
});

function settingsPath(organizationId: string, query = ""): string {
  return `/orgs/${organizationId}/settings${query}`;
}

function aWorld(): Promise<TwoOrganizations> {
  return createTwoOrganizations(harness.app, harness.connections, {
    industryTemplateKey: "RETAIL",
  });
}

interface ResolvedBody {
  value: unknown;
  source: string;
  version?: number;
}

function settingsOf(response: { body: { data: { settings: Record<string, ResolvedBody> } } }) {
  return response.body.data.settings;
}

async function configVersion(organizationId: string): Promise<number> {
  const row = await harness.connections.platform
    .collection("organizations")
    .findOne({ organizationId });
  return Number(row?.["configVersion"]);
}

function warnCount(): number {
  return harness.logs.lines().filter((line) => line["msg"] === "settings.template_default_skipped")
    .length;
}

async function retailDefaults(): Promise<Record<string, unknown>> {
  const row = await harness.connections.platform
    .collection("industry_templates")
    .findOne({ industryTemplateKey: "RETAIL" });
  const configuration = row?.["configuration"] as { settingsDefaults: Record<string, unknown> };
  return configuration.settingsDefaults;
}

async function replaceRetailDefaults(settingsDefaults: Record<string, unknown>): Promise<void> {
  await harness.connections.platform
    .collection("industry_templates")
    .updateOne(
      { industryTemplateKey: "RETAIL" },
      { $set: { "configuration.settingsDefaults": settingsDefaults } },
    );
}

describe("GET /settings", () => {
  it("resolves effective keys in order and hides keys no module has registered", async () => {
    const world = await aWorld();

    const response = await world.alice.call("get", settingsPath(world.organizationA));

    expect(response.status).toBe(200);
    expect(Object.keys(settingsOf(response))).toEqual([
      "notification.probeFlag",
      "notification.probeShape",
      "organization.digitScript",
      "organization.numberGrouping",
    ]);
    expect(settingsOf(response)["organization.digitScript"]).toEqual({
      value: "LATIN",
      source: SETTING_VALUE_SOURCE.INDUSTRY,
    });
    expect(settingsOf(response)["notification.probeFlag"]).toEqual({
      value: false,
      source: SETTING_VALUE_SOURCE.SYSTEM,
    });
    expect(settingsOf(response)).not.toHaveProperty("sales.returnWindowDays");
  });

  it("returns only the requested keys, in sorted order", async () => {
    const world = await aWorld();

    const response = await world.alice.call(
      "get",
      settingsPath(
        world.organizationA,
        "?keys=organization.numberGrouping,organization.digitScript",
      ),
    );

    expect(response.status).toBe(200);
    expect(Object.keys(settingsOf(response))).toEqual([
      "organization.digitScript",
      "organization.numberGrouping",
    ]);
  });

  it("answers 404 for a key that is not registered", async () => {
    const world = await aWorld();

    const response = await world.alice.call(
      "get",
      settingsPath(world.organizationA, "?keys=sales.returnWindowDays"),
    );

    expect(response.status).toBe(404);
    expect(response.body.error.messageKey).toBe("errors.setting_not_available");
    expect(response.body.error.details.settingKey).toBe("sales.returnWindowDays");
  });

  it("answers 404 to another organization's owner", async () => {
    const world = await aWorld();

    const response = await world.bob.call("get", settingsPath(world.organizationA));

    expect(response.status).toBe(404);
  });
});

describe("PATCH /settings", () => {
  it("stores an organization value, then requires its version, then falls back when deleted", async () => {
    const world = await aWorld();
    const path = settingsPath(world.organizationA);
    const before = await configVersion(world.organizationA);

    const created = await world.alice.call("patch", path, {
      items: [{ settingKey: "organization.digitScript", value: "BENGALI" }],
    });
    const missingVersion = await world.alice.call("patch", path, {
      items: [{ settingKey: "organization.digitScript", value: "LATIN" }],
    });
    const updated = await world.alice.call("patch", path, {
      items: [{ settingKey: "organization.digitScript", value: "LATIN", version: 1 }],
    });
    const stale = await world.alice.call("patch", path, {
      items: [{ settingKey: "organization.digitScript", value: "BENGALI", version: 1 }],
    });
    const removed = await world.alice.call("patch", path, {
      items: [{ settingKey: "organization.digitScript", value: null, version: 2 }],
    });

    expect(created.status).toBe(200);
    expect(settingsOf(created)["organization.digitScript"]).toEqual({
      value: "BENGALI",
      source: SETTING_VALUE_SOURCE.ORGANIZATION,
      version: 1,
    });
    expect(missingVersion.status).toBe(409);
    expect(missingVersion.body.error.details.currentVersion).toBe(1);
    expect(updated.status).toBe(200);
    expect(settingsOf(updated)["organization.digitScript"]?.version).toBe(2);
    expect(stale.status).toBe(409);
    expect(stale.body.error.details.currentVersion).toBe(2);
    expect(removed.status).toBe(200);
    expect(settingsOf(removed)["organization.digitScript"]).toEqual({
      value: "LATIN",
      source: SETTING_VALUE_SOURCE.INDUSTRY,
    });
    expect(await configVersion(world.organizationA)).toBe(before + 3);
  });

  it("writes one audit entry and one event for the batch", async () => {
    const world = await aWorld();

    const response = await world.alice.call("patch", settingsPath(world.organizationA), {
      items: [
        { settingKey: "organization.digitScript", value: "BENGALI" },
        { settingKey: "organization.numberGrouping", value: "INDIAN" },
      ],
    });
    const audits = await harness.connections.tenantShared
      .collection("audit_logs")
      .find({ organizationId: world.organizationA, action: "settings.setting.changed" })
      .toArray();
    const events = await harness.connections.platform
      .collection("outbox_events")
      .find({ organizationId: world.organizationA, type: "settings.setting.changed" })
      .toArray();

    expect(response.status).toBe(200);
    expect(audits).toHaveLength(1);
    expect(audits[0]?.["entityType"]).toBe("setting");
    expect(audits[0]?.["entityId"]).toBe(world.organizationA);
    expect(audits[0]?.["changes"]).toMatchObject({
      "organization.digitScript": { from: null, to: "BENGALI" },
      "organization.numberGrouping": { from: null, to: "INDIAN" },
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.["payload"]).toEqual({
      settingKeys: ["organization.digitScript", "organization.numberGrouping"],
    });
  });

  it("stores a null locationId for an organization row", async () => {
    const world = await aWorld();

    await world.alice.call("patch", settingsPath(world.organizationA), {
      items: [{ settingKey: "organization.digitScript", value: "BENGALI" }],
    });
    const row = await harness.connections.tenantShared
      .collection("setting_values")
      .findOne({ organizationId: world.organizationA, settingKey: "organization.digitScript" });

    expect(row?.["locationId"]).toBeNull();
  });

  it("refuses a location on a key that cannot vary by location and writes nothing", async () => {
    const world = await aWorld();

    const response = await world.alice.call("patch", settingsPath(world.organizationA), {
      items: [
        {
          settingKey: "organization.digitScript",
          value: "BENGALI",
          locationId: world.locationA1,
        },
      ],
    });
    const stored = await harness.connections.tenantShared
      .collection("setting_values")
      .countDocuments({ organizationId: world.organizationA });

    expect(response.status).toBe(422);
    expect(response.body.error.messageKey).toBe("errors.setting_not_location_scoped");
    expect(response.body.error.details.ruleKey).toBe(SETTINGS_RULE_KEY.SETTING_NOT_LOCATION_SCOPED);
    expect(stored).toBe(0);
  });

  it("rejects a value outside the spec and leaves the previous value", async () => {
    const world = await aWorld();
    const path = settingsPath(world.organizationA);
    await world.alice.call("patch", path, {
      items: [{ settingKey: "organization.digitScript", value: "BENGALI" }],
    });

    const response = await world.alice.call("patch", path, {
      items: [
        { settingKey: "organization.digitScript", value: "LATIN", version: 1 },
        { settingKey: "organization.numberGrouping", value: "BANGLA" },
      ],
    });
    const listed = await world.alice.call("get", path);

    expect(response.status).toBe(400);
    expect(response.body.error.details.fields).toEqual([
      { path: "items.1.value", messageKey: "validation.invalid_value" },
    ]);
    expect(settingsOf(listed)["organization.digitScript"]?.value).toBe("BENGALI");
  });

  it("answers 404 for an unknown key, a version on a missing row, and another organization's location", async () => {
    const world = await aWorld();
    const path = settingsPath(world.organizationA);

    const unknown = await world.alice.call("patch", path, {
      items: [{ settingKey: "sales.returnWindowDays", value: 3 }],
    });
    const versionOnCreate = await world.alice.call("patch", path, {
      items: [{ settingKey: "organization.digitScript", value: "BENGALI", version: 1 }],
    });
    const otherOrganization = await world.alice.call("patch", path, {
      items: [
        {
          settingKey: "notification.probeFlag",
          value: true,
          locationId: world.locationB1,
        },
      ],
    });
    const missing = await world.alice.call("patch", path, {
      items: [{ settingKey: "notification.probeFlag", value: true, locationId: newId() }],
    });

    expect(unknown.status).toBe(404);
    expect(unknown.body.error.messageKey).toBe("errors.setting_not_available");
    expect(versionOnCreate.status).toBe(404);
    expect(otherOrganization.status).toBe(404);
    expect(missing.status).toBe(404);
  });

  it("answers 404 for an archived location", async () => {
    const world = await aWorld();
    const archived = await world.alice.call(
      "post",
      `/orgs/${world.organizationA}/locations/${world.locationA2}/archive`,
      { version: 1 },
    );
    const response = await world.alice.call("patch", settingsPath(world.organizationA), {
      items: [
        {
          settingKey: "notification.probeFlag",
          value: true,
          locationId: world.locationA2,
        },
      ],
    });

    expect(archived.status).toBe(200);
    expect(response.status).toBe(404);
  });

  it("stores the parsed structured value and drops a key the schema does not name", async () => {
    const world = await aWorld();
    const response = await world.alice.call("patch", settingsPath(world.organizationA), {
      items: [
        {
          settingKey: "notification.probeShape",
          value: { name: "Dhaka", extra: true },
        },
      ],
    });
    const row = await harness.connections.tenantShared
      .collection("setting_values")
      .findOne({ organizationId: world.organizationA, settingKey: "notification.probeShape" });
    const audits = await harness.connections.tenantShared
      .collection("audit_logs")
      .find({ organizationId: world.organizationA, action: "settings.setting.changed" })
      .toArray();

    expect(response.status).toBe(200);
    expect(settingsOf(response)["notification.probeShape"]?.value).toEqual({ name: "Dhaka" });
    expect(row?.["value"]).toEqual({ name: "Dhaka" });
    expect(audits[0]?.["changes"]).toMatchObject({
      "notification.probeShape": { from: null, to: JSON.stringify({ name: "Dhaka" }) },
    });
  });

  it("rejects an empty batch, a duplicate item and more than 50 items", async () => {
    const world = await aWorld();
    const path = settingsPath(world.organizationA);

    const empty = await world.alice.call("patch", path, { items: [] });
    const duplicate = await world.alice.call("patch", path, {
      items: [
        { settingKey: "organization.digitScript", value: "LATIN" },
        { settingKey: "organization.digitScript", value: "BENGALI" },
      ],
    });
    const tooMany = await world.alice.call("patch", path, {
      items: Array.from({ length: 51 }, (_item, index) => ({
        settingKey: `organization.extra${index}`,
        value: true,
      })),
    });

    expect(empty.status).toBe(400);
    expect(duplicate.status).toBe(400);
    expect(duplicate.body.error.details.fields[0].path).toBe("items.1.settingKey");
    expect(duplicate.body.error.details.fields[0].messageKey).toBe("validation.custom");
    expect(tooMany.status).toBe(400);
    expect(tooMany.body.error.details.fields[0].messageKey).toBe("validation.too_big");
  });

  it("resolves a location override only when the read names that location", async () => {
    const world = await aWorld();
    const path = settingsPath(world.organizationA);

    const patched = await world.alice.call("patch", path, {
      items: [{ settingKey: "notification.probeFlag", value: true, locationId: world.locationA1 }],
    });
    const atLocation = await world.alice.call(
      "get",
      settingsPath(
        world.organizationA,
        `?location=${world.locationA1}&keys=notification.probeFlag`,
      ),
    );
    const atOrganization = await world.alice.call(
      "get",
      settingsPath(world.organizationA, "?keys=notification.probeFlag"),
    );

    expect(patched.status).toBe(200);
    expect(settingsOf(patched)["notification.probeFlag"]).toEqual({
      value: true,
      source: SETTING_VALUE_SOURCE.LOCATION,
      version: 1,
    });
    expect(settingsOf(atLocation)["notification.probeFlag"]?.source).toBe(
      SETTING_VALUE_SOURCE.LOCATION,
    );
    expect(settingsOf(atOrganization)["notification.probeFlag"]).toEqual({
      value: false,
      source: SETTING_VALUE_SOURCE.SYSTEM,
    });
  });

  it("lets one create win and answers 409 to the other", async () => {
    const world = await aWorld();
    const path = settingsPath(world.organizationA);
    const body = { items: [{ settingKey: "organization.digitScript", value: "BENGALI" }] };

    const [first, second] = await Promise.all([
      world.alice.call("patch", path, body),
      world.alice.call("patch", path, body),
    ]);
    const statuses = [first.status, second.status].sort();

    expect(statuses).toEqual([200, 409]);
    const conflict = first.status === 409 ? first : second;
    expect(conflict.body.error.details.currentVersion).toBe(1);
  });
});

describe("who may change a setting", () => {
  async function managerAtFirstLocation(world: TwoOrganizations): Promise<ApiActor> {
    const roleId = await findSystemRoleId(
      harness.connections,
      world.organizationA,
      SYSTEM_ROLE_KEY.MANAGER,
    );
    const member = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: world.locationA1, roleId },
    ]);
    return member.actor;
  }

  it("refuses a one-location manager an organization write and another location", async () => {
    const world = await aWorld();
    const manager = await managerAtFirstLocation(world);
    const path = settingsPath(world.organizationA);

    const organizationWrite = await manager.call("patch", path, {
      items: [{ settingKey: "organization.digitScript", value: "BENGALI" }],
    });
    const ownLocation = await manager.call("patch", path, {
      items: [{ settingKey: "notification.probeFlag", value: true, locationId: world.locationA1 }],
    });
    const otherLocation = await manager.call("patch", path, {
      items: [{ settingKey: "notification.probeFlag", value: true, locationId: world.locationA2 }],
    });

    expect(organizationWrite.status).toBe(403);
    expect(ownLocation.status).toBe(200);
    expect(otherLocation.status).toBe(403);
  });

  it("lets a cashier read and refuses the write", async () => {
    const world = await aWorld();
    const roleId = await findSystemRoleId(
      harness.connections,
      world.organizationA,
      SYSTEM_ROLE_KEY.CASHIER,
    );
    const cashier = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: world.locationA1, roleId },
    ]);

    const read = await cashier.actor.call("get", settingsPath(world.organizationA));
    const write = await cashier.actor.call("patch", settingsPath(world.organizationA), {
      items: [{ settingKey: "organization.digitScript", value: "BENGALI" }],
    });

    expect(read.status).toBe(200);
    expect(write.status).toBe(403);
  });
});

describe("industry template defaults", () => {
  it("uses a valid template default and skips a bad one once", async () => {
    const world = await aWorld();
    const previous = await retailDefaults();
    const before = warnCount();
    await replaceRetailDefaults({ ...previous, "organization.digitScript": "BENGALI" });
    try {
      const valid = await world.alice.call(
        "get",
        settingsPath(world.organizationA, "?keys=organization.digitScript"),
      );
      expect(settingsOf(valid)["organization.digitScript"]).toEqual({
        value: "BENGALI",
        source: SETTING_VALUE_SOURCE.INDUSTRY,
      });

      await replaceRetailDefaults({ ...previous, "organization.digitScript": "NOPE" });
      const first = await world.alice.call(
        "get",
        settingsPath(world.organizationA, "?keys=organization.digitScript"),
      );
      const second = await world.alice.call(
        "get",
        settingsPath(world.organizationA, "?keys=organization.digitScript"),
      );

      expect(settingsOf(first)["organization.digitScript"]).toEqual({
        value: "LATIN",
        source: SETTING_VALUE_SOURCE.SYSTEM,
      });
      expect(settingsOf(second)["organization.digitScript"]?.source).toBe(
        SETTING_VALUE_SOURCE.SYSTEM,
      );
      expect(warnCount() - before).toBe(1);
    } finally {
      await replaceRetailDefaults(previous);
    }
  });
});
