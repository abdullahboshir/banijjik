import {
  MODULE_KEY,
  MODULE_OVERRIDE_EFFECT,
  PLATFORM_AUDIT_ACTION,
  PLATFORM_ROLE,
} from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  PAYMENT_GATEWAY_PROBE_MANIFEST,
  buildEntitlementProbeRouter,
} from "../../../../test-support/entitlement-world.js";
import {
  registerIamApiModels,
  startIamApi,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";
import {
  createOrganizationAs,
  newActor,
} from "../../../../test-support/organization-tenant-world.js";
import {
  createPlatformActor,
  type PlatformActor,
} from "../../../../test-support/platform-world.js";
import type { ApiActor } from "../../../../test-support/two-organizations.js";

registerIamApiModels();

let harness: IamApiHarness;
let operator: PlatformActor;

beforeAll(async () => {
  harness = await startIamApi({
    tenantRouters: [buildEntitlementProbeRouter()],
    extraManifests: [PAYMENT_GATEWAY_PROBE_MANIFEST],
  });
  operator = await createPlatformActor(harness.app, harness.connections, [PLATFORM_ROLE.BILLING]);
});

afterAll(async () => {
  await harness.dispose();
});

interface Tenant {
  readonly owner: ApiActor;
  readonly organizationId: string;
}

async function createTenant(): Promise<Tenant> {
  const owner = await newActor(harness.app);
  const { organizationId } = await createOrganizationAs(owner, harness.connections, {
    industryTemplateKey: "RETAIL",
  });
  return { owner, organizationId };
}

function grant(organizationId: string, moduleKey: string, extra: object = {}) {
  return operator.call("post", `/organizations/${organizationId}/module-overrides`, {
    moduleKey,
    effect: MODULE_OVERRIDE_EFFECT.PLATFORM_GRANT,
    reason: "pilot customer",
    ...extra,
  });
}

async function configVersionOf(organizationId: string): Promise<number> {
  const row = await harness.connections.platform
    .collection("organizations")
    .findOne({ organizationId });
  return row?.["configVersion"] as number;
}

function auditEntries(organizationId: string) {
  return harness.connections.platform
    .collection("platform_audit_logs")
    .find({ organizationId })
    .toArray();
}

describe("granting a module outside the package (roadmap Done)", () => {
  it("shows the module in the next /me/config and opens its route, and a delete closes it again", async () => {
    const { owner, organizationId } = await createTenant();
    const before = await owner.call("get", `/orgs/${organizationId}/ledger`);
    expect(before.status).toBe(403);
    expect(before.body.error.code).toBe("MODULE_DISABLED");

    const created = await grant(organizationId, MODULE_KEY.PAYMENT_GATEWAY);
    expect(created.status).toBe(201);

    const config = await owner.call("get", `/orgs/${organizationId}/me/config`);
    expect(config.body.data.modules).toContain(MODULE_KEY.PAYMENT_GATEWAY);
    expect((await owner.call("get", `/orgs/${organizationId}/ledger`)).status).toBe(200);

    const removed = await operator.call(
      "delete",
      `/organizations/${organizationId}/module-overrides/${created.body.data.moduleOverrideId}`,
    );
    expect(removed.status).toBe(204);
    const after = await owner.call("get", `/orgs/${organizationId}/ledger`);
    expect(after.status).toBe(403);
    expect(after.body.error.code).toBe("MODULE_DISABLED");
  });

  it("revokes a module of the package the same way", async () => {
    const { owner, organizationId } = await createTenant();
    await grant(organizationId, MODULE_KEY.PAYMENT_GATEWAY);
    const revoke = await operator.call(
      "post",
      `/organizations/${organizationId}/module-overrides`,
      {
        moduleKey: MODULE_KEY.PAYMENT_GATEWAY,
        effect: MODULE_OVERRIDE_EFFECT.PLATFORM_REVOKE,
        reason: "unpaid",
      },
    );

    expect(revoke.status).toBe(201);
    const response = await owner.call("get", `/orgs/${organizationId}/ledger`);
    expect(response.status).toBe(403);
  });
});

describe("module override rules", () => {
  it("refuses SYSTEM and PLATFORM modules with a 422 business rule", async () => {
    const { organizationId } = await createTenant();

    for (const moduleKey of [MODULE_KEY.IAM, MODULE_KEY.PACKAGE]) {
      const response = await grant(organizationId, moduleKey);
      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe("BUSINESS_RULE");
      expect(response.body.error.details.ruleKey).toBe("MODULE_CLASS_FIXED");
    }
  });

  it("refuses a module that has no manifest yet", async () => {
    const { organizationId } = await createTenant();

    const response = await grant(organizationId, MODULE_KEY.KITCHEN_DISPLAY);

    expect(response.status).toBe(422);
    expect(response.body.error.details.ruleKey).toBe("MODULE_NOT_REGISTERED");
  });

  it("answers 409 DUPLICATE for the same module and effect twice", async () => {
    const { organizationId } = await createTenant();
    await grant(organizationId, MODULE_KEY.PAYMENT_GATEWAY);

    const response = await grant(organizationId, MODULE_KEY.PAYMENT_GATEWAY);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("DUPLICATE");
  });

  it("refuses an expiry in the past and the tenant-only effect", async () => {
    const { organizationId } = await createTenant();

    const past = await grant(organizationId, MODULE_KEY.PAYMENT_GATEWAY, {
      expiresAt: "2001-01-01",
    });
    const tenantEffect = await operator.call(
      "post",
      `/organizations/${organizationId}/module-overrides`,
      { moduleKey: MODULE_KEY.PAYMENT_GATEWAY, effect: "TENANT_DISABLE", reason: "x" },
    );

    expect(past.status).toBe(400);
    expect(tenantEffect.status).toBe(400);
  });

  it("answers 404 for an unknown organization and an unknown override", async () => {
    const { organizationId } = await createTenant();

    const unknownOrganization = await grant(newId(), MODULE_KEY.PAYMENT_GATEWAY);
    const unknownOverride = await operator.call(
      "delete",
      `/organizations/${organizationId}/module-overrides/${newId()}`,
    );

    expect(unknownOrganization.status).toBe(404);
    expect(unknownOverride.status).toBe(404);
  });

  it("lists the overrides of one organization only", async () => {
    const first = await createTenant();
    const second = await createTenant();
    await grant(first.organizationId, MODULE_KEY.PAYMENT_GATEWAY);

    const listed = await operator.call(
      "get",
      `/organizations/${first.organizationId}/module-overrides`,
    );
    const other = await operator.call(
      "get",
      `/organizations/${second.organizationId}/module-overrides`,
    );

    expect(listed.body.data).toHaveLength(1);
    expect(listed.body.data[0].moduleKey).toBe(MODULE_KEY.PAYMENT_GATEWAY);
    expect(other.body.data).toEqual([]);
  });
});

describe("module override side effects", () => {
  it("bumps configVersion once per write and writes exactly one platform audit entry per write", async () => {
    const { organizationId } = await createTenant();
    const startVersion = await configVersionOf(organizationId);

    const created = await grant(organizationId, MODULE_KEY.PAYMENT_GATEWAY, { reason: "pilot" });
    await operator.call("get", `/organizations/${organizationId}/module-overrides`);
    await operator.call(
      "delete",
      `/organizations/${organizationId}/module-overrides/${created.body.data.moduleOverrideId}`,
    );

    expect(await configVersionOf(organizationId)).toBe(startVersion + 2);
    const entries = await auditEntries(organizationId);
    expect(entries.map((entry) => entry["action"]).sort()).toEqual(
      [
        PLATFORM_AUDIT_ACTION.MODULE_OVERRIDE_CREATED,
        PLATFORM_AUDIT_ACTION.MODULE_OVERRIDE_DELETED,
      ].sort(),
    );
    expect(entries[0]?.["actorPlatformOperatorId"]).toBe(operator.platformOperatorId);
  });

  it("leaves nothing behind when a refused write is rejected, and logs system access for reads", async () => {
    const { organizationId } = await createTenant();
    const startVersion = await configVersionOf(organizationId);

    await grant(organizationId, MODULE_KEY.IAM);
    await operator.call("get", `/organizations/${organizationId}/module-overrides`);

    expect(await configVersionOf(organizationId)).toBe(startVersion);
    expect(await auditEntries(organizationId)).toEqual([]);
    const reasons = harness.logs
      .lines()
      .filter((line) => line["event"] === "system_access")
      .map((line) => line["reason"]);
    expect(reasons).toContain("PLATFORM_ADMIN");
  });
});
