import {
  LIMIT_KEY,
  MODULE_KEY,
  PACKAGE_KEY,
  PLATFORM_AUDIT_ACTION,
  PLATFORM_ROLE,
  SUBSCRIPTION_STATUS,
} from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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

registerIamApiModels();

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

let harness: IamApiHarness;
let operator: PlatformActor;
let packageIds: Record<string, string>;

beforeAll(async () => {
  harness = await startIamApi();
  operator = await createPlatformActor(harness.app, harness.connections, [PLATFORM_ROLE.BILLING]);
  const rows = await harness.connections.platform.collection("packages").find({}).toArray();
  packageIds = Object.fromEntries(rows.map((row) => [row["packageKey"], row["packageId"]]));
});

afterAll(async () => {
  await harness.dispose();
});

async function createTenant() {
  const owner = await newActor(harness.app);
  const { organizationId } = await createOrganizationAs(owner, harness.connections, {
    industryTemplateKey: "RETAIL",
  });
  return { owner, organizationId };
}

async function configVersionOf(organizationId: string): Promise<number> {
  const row = await harness.connections.platform
    .collection("organizations")
    .findOne({ organizationId });
  return row?.["configVersion"] as number;
}

async function auditActions(organizationId: string) {
  const rows = await harness.connections.platform
    .collection("platform_audit_logs")
    .find({ organizationId })
    .toArray();
  return rows.map((row) => row["action"]);
}

describe("GET subscription", () => {
  it("shows the trial on the BUNDLE package with the package keys", async () => {
    const { organizationId } = await createTenant();

    const response = await operator.call("get", `/organizations/${organizationId}/subscription`);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      status: SUBSCRIPTION_STATUS.TRIALING,
      basePackageKey: PACKAGE_KEY.BUNDLE,
      addOnPackageKeys: [],
      version: 1,
    });
  });

  it("answers 404 for an organization without a subscription", async () => {
    const response = await operator.call("get", `/organizations/${newId()}/subscription`);

    expect(response.status).toBe(404);
  });
});

describe("extending a trial", () => {
  it("adds the days to the end of the trial, bumps configVersion and writes one audit entry", async () => {
    const { organizationId } = await createTenant();
    const before = await operator.call("get", `/organizations/${organizationId}/subscription`);
    const startVersion = await configVersionOf(organizationId);

    const response = await operator.call(
      "post",
      `/organizations/${organizationId}/subscription/extend-trial`,
      { days: 10, reason: "needs more time" },
    );

    const previousEnd = new Date(before.body.data.trialEndsAt).getTime();
    expect(response.status).toBe(200);
    expect(new Date(response.body.data.trialEndsAt).getTime()).toBe(
      previousEnd + 10 * MILLISECONDS_PER_DAY,
    );
    expect(response.body.data.version).toBe(2);
    expect(await configVersionOf(organizationId)).toBe(startVersion + 1);
    expect(await auditActions(organizationId)).toEqual([
      PLATFORM_AUDIT_ACTION.SUBSCRIPTION_TRIAL_EXTENDED,
    ]);
  });

  it("counts from today when the trial already ended", async () => {
    const { organizationId } = await createTenant();
    const endedAt = new Date(harness.clock.now().getTime() - 5 * MILLISECONDS_PER_DAY);
    await harness.connections.platform
      .collection("platform_subscriptions")
      .updateOne({ organizationId }, { $set: { trialEndsAt: endedAt } });

    const response = await operator.call(
      "post",
      `/organizations/${organizationId}/subscription/extend-trial`,
      { days: 3, reason: "late" },
    );

    const expected = harness.clock.now().getTime() + 3 * MILLISECONDS_PER_DAY;
    expect(new Date(response.body.data.trialEndsAt).getTime()).toBe(expected);
  });

  it("refuses more than 30 days, zero days and a missing reason", async () => {
    const { organizationId } = await createTenant();
    const path = `/organizations/${organizationId}/subscription/extend-trial`;

    const tooLong = await operator.call("post", path, { days: 31, reason: "x" });
    const zero = await operator.call("post", path, { days: 0, reason: "x" });
    const noReason = await operator.call("post", path, { days: 5 });

    expect([tooLong.status, zero.status, noReason.status]).toEqual([400, 400, 400]);
    expect(await auditActions(organizationId)).toEqual([]);
  });

  it("refuses a subscription that is not in its trial", async () => {
    const { organizationId } = await createTenant();
    await harness.connections.platform
      .collection("platform_subscriptions")
      .updateOne({ organizationId }, { $set: { status: SUBSCRIPTION_STATUS.ACTIVE } });

    const response = await operator.call(
      "post",
      `/organizations/${organizationId}/subscription/extend-trial`,
      { days: 5, reason: "x" },
    );

    expect(response.status).toBe(422);
    expect(response.body.error.details.ruleKey).toBe("TRIAL_NOT_ACTIVE");
  });
});

describe("changing the package", () => {
  it("moves the subscription to another base package and add-on, keeping the status", async () => {
    const { owner, organizationId } = await createTenant();
    const startVersion = await configVersionOf(organizationId);
    const addOnKey = Object.keys(packageIds).find((key) => key.startsWith("ADDON_")) ?? "";

    const response = await operator.call(
      "post",
      `/organizations/${organizationId}/subscription/change-package`,
      { basePackageId: packageIds[PACKAGE_KEY.STORE], addOnPackageIds: [packageIds[addOnKey]] },
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      status: SUBSCRIPTION_STATUS.TRIALING,
      basePackageKey: PACKAGE_KEY.STORE,
      addOnPackageKeys: [addOnKey],
    });
    expect(await configVersionOf(organizationId)).toBe(startVersion + 1);
    const config = await owner.call("get", `/orgs/${organizationId}/me/config`);
    expect(config.body.data.limits[LIMIT_KEY.LOCATIONS]).toBeDefined();
    expect(config.body.data.modules).not.toContain(MODULE_KEY.SOCIAL);
    expect(await auditActions(organizationId)).toEqual([
      PLATFORM_AUDIT_ACTION.SUBSCRIPTION_PACKAGE_CHANGED,
    ]);
  });

  it("refuses an add-on as base, a base as add-on, an archived package and an unknown one", async () => {
    const { organizationId } = await createTenant();
    const path = `/organizations/${organizationId}/subscription/change-package`;
    const addOnId =
      packageIds[Object.keys(packageIds).find((key) => key.startsWith("ADDON_")) ?? ""];
    await harness.connections.platform
      .collection("packages")
      .updateOne({ packageKey: PACKAGE_KEY.STORE }, { $set: { status: "ARCHIVED" } });

    const addOnAsBase = await operator.call("post", path, {
      basePackageId: addOnId,
      addOnPackageIds: [],
    });
    const baseAsAddOn = await operator.call("post", path, {
      basePackageId: packageIds[PACKAGE_KEY.BUNDLE],
      addOnPackageIds: [packageIds[PACKAGE_KEY.BUNDLE]],
    });
    const archived = await operator.call("post", path, {
      basePackageId: packageIds[PACKAGE_KEY.STORE],
      addOnPackageIds: [],
    });
    const unknown = await operator.call("post", path, {
      basePackageId: newId(),
      addOnPackageIds: [],
    });

    for (const response of [addOnAsBase, baseAsAddOn, archived, unknown]) {
      expect(response.status).toBe(422);
      expect(response.body.error.details.ruleKey).toBe("PACKAGE_KIND_MISMATCH");
    }
    expect(await auditActions(organizationId)).toEqual([]);
  });
});
