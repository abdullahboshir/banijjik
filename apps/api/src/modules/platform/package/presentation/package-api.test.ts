import {
  LIMIT_KEY,
  MODULE_KEY,
  PACKAGE_KEY,
  PACKAGE_STATUS,
  PLATFORM_AUDIT_ACTION,
  PLATFORM_ROLE,
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
import { PACKAGE_CATALOG_REFRESH_MILLISECONDS } from "../../entitlement/index.js";

registerIamApiModels();

let harness: IamApiHarness;
let operator: PlatformActor;
let issuedKeys = 0;

beforeAll(async () => {
  harness = await startIamApi();
  operator = await createPlatformActor(harness.app, harness.connections, [
    PLATFORM_ROLE.SUPER_ADMIN,
  ]);
});

afterAll(async () => {
  await harness.dispose();
});

const LIMITS = {
  [LIMIT_KEY.LOCATIONS]: 2,
  [LIMIT_KEY.MEMBERS]: 5,
  [LIMIT_KEY.OFFERINGS]: null,
  [LIMIT_KEY.ORDERS_PER_MONTH]: 100,
  [LIMIT_KEY.AI_MESSAGES_PER_MONTH]: 0,
  [LIMIT_KEY.SMS_PER_MONTH]: 0,
  [LIMIT_KEY.CHANNELS]: 1,
  [LIMIT_KEY.POS_DEVICES]: 0,
};

function uniquePackageKey(): string {
  issuedKeys += 1;
  return `TRY_PACKAGE_${issuedKeys}`;
}

function createPackage(overrides: object = {}) {
  return operator.call("post", "/packages", {
    packageKey: uniquePackageKey(),
    name: "Try package",
    isAddOn: false,
    moduleKeys: [MODULE_KEY.SALES, MODULE_KEY.CATALOG],
    limits: LIMITS,
    ...overrides,
  });
}

async function auditActions(targetId: string) {
  const rows = await harness.connections.platform
    .collection("platform_audit_logs")
    .find({ targetId })
    .toArray();
  return rows.map((row) => row["action"]);
}

describe("creating a package", () => {
  it("saves a base package and lists the module keys that have no manifest yet", async () => {
    const response = await createPackage();

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      isAddOn: false,
      status: PACKAGE_STATUS.ACTIVE,
      version: 1,
      unbuiltModuleKeys: [MODULE_KEY.SALES, MODULE_KEY.CATALOG],
    });
    expect(await auditActions(response.body.data.packageId)).toEqual([
      PLATFORM_AUDIT_ACTION.PACKAGE_CREATED,
    ]);
  });

  it("refuses a base package that lacks a dependency of one of its modules", async () => {
    const response = await createPackage({ moduleKeys: [MODULE_KEY.SAAS_BILLING] });

    expect(response.status).toBe(422);
    expect(response.body.error.details.ruleKey).toBe("PACKAGE_NOT_CLOSED");
    expect(response.body.error.details.gaps).toEqual([
      { moduleKey: MODULE_KEY.SAAS_BILLING, missingDependency: MODULE_KEY.PACKAGE },
    ]);
  });

  it("accepts the same modules once the dependency is part of the package", async () => {
    const response = await createPackage({
      moduleKeys: [MODULE_KEY.SAAS_BILLING, MODULE_KEY.PACKAGE],
    });

    expect(response.status).toBe(201);
    expect(response.body.data.unbuiltModuleKeys).toEqual([]);
  });

  it("does not apply the closure rule to an add-on", async () => {
    const response = await createPackage({
      isAddOn: true,
      moduleKeys: [MODULE_KEY.SAAS_BILLING],
      limitIncrements: { [LIMIT_KEY.MEMBERS]: 3 },
    });

    expect(response.status).toBe(201);
  });

  it("answers 409 DUPLICATE for a taken key and 400 for a bad key or an unknown module", async () => {
    const duplicate = await createPackage({ packageKey: PACKAGE_KEY.BUNDLE });
    const badKey = await createPackage({ packageKey: "not upper case" });
    const unknownModule = await createPackage({ moduleKeys: ["no-such-module"] });

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("DUPLICATE");
    expect(badKey.status).toBe(400);
    expect(unknownModule.status).toBe(400);
  });

  it("refuses limit increments on a base package", async () => {
    const response = await createPackage({ limitIncrements: { [LIMIT_KEY.MEMBERS]: 1 } });

    expect(response.status).toBe(400);
  });
});

describe("the display name of a package", () => {
  it("is required on create, 2 to 60 characters, and comes back next to a null nameKey", async () => {
    const created = await createPackage({ name: "  Shop Plus  " });
    const missing = await operator.call("post", "/packages", {
      packageKey: uniquePackageKey(),
      isAddOn: false,
      moduleKeys: [],
      limits: LIMITS,
    });
    const tooShort = await createPackage({ name: "A" });
    const tooLong = await createPackage({ name: "x".repeat(61) });

    expect(created.body.data).toMatchObject({ name: "Shop Plus", nameKey: null });
    expect([missing.status, tooShort.status, tooLong.status]).toEqual([400, 400, 400]);
  });

  it("can be changed on an operator-made package but not on a seed package", async () => {
    const created = await createPackage();
    const renamed = await operator.call("patch", `/packages/${created.body.data.packageId}`, {
      version: 1,
      name: "Renamed",
    });
    const list = await operator.call("get", "/packages?limit=100");
    const bundle = list.body.data.find(
      (row: { packageKey: string }) => row.packageKey === PACKAGE_KEY.BUNDLE,
    );
    const seedRename = await operator.call("patch", `/packages/${bundle.packageId}`, {
      version: bundle.version,
      name: "Nope",
    });

    expect(renamed.body.data.name).toBe("Renamed");
    expect(bundle).toMatchObject({ name: null, nameKey: "package.BUNDLE.name" });
    expect(seedRename.status).toBe(400);
  });
});

describe("editing a package", () => {
  it("saves the change, moves the version and writes one audit entry", async () => {
    const created = await createPackage();
    const { packageId } = created.body.data;

    const edited = await operator.call("patch", `/packages/${packageId}`, {
      version: 1,
      moduleKeys: [MODULE_KEY.SALES],
      limits: { ...LIMITS, [LIMIT_KEY.MEMBERS]: 9 },
    });

    expect(edited.status).toBe(200);
    expect(edited.body.data).toMatchObject({ version: 2, moduleKeys: [MODULE_KEY.SALES] });
    expect(edited.body.data.limits[LIMIT_KEY.MEMBERS]).toBe(9);
    expect(await auditActions(packageId)).toContain(PLATFORM_AUDIT_ACTION.PACKAGE_UPDATED);
  });

  it("answers 409 for a stale version and refuses a closure gap on edit", async () => {
    const created = await createPackage();
    const { packageId } = created.body.data;
    await operator.call("patch", `/packages/${packageId}`, { version: 1, moduleKeys: [] });

    const stale = await operator.call("patch", `/packages/${packageId}`, {
      version: 1,
      moduleKeys: [],
    });
    const gap = await operator.call("patch", `/packages/${packageId}`, {
      version: 2,
      moduleKeys: [MODULE_KEY.SAAS_BILLING],
    });

    expect(stale.status).toBe(409);
    expect(stale.body.error.details.currentVersion).toBe(2);
    expect(gap.status).toBe(422);
  });

  it("shows an edit to the organizations that use the package after the catalogue refresh", async () => {
    const owner = await newActor(harness.app);
    const { organizationId } = await createOrganizationAs(owner, harness.connections, {
      industryTemplateKey: "RETAIL",
    });
    const before = await owner.call("get", `/orgs/${organizationId}/me/config`);
    const bundle = await operator.call("get", "/packages?limit=100");
    const bundleRow = bundle.body.data.find(
      (row: { packageKey: string }) => row.packageKey === PACKAGE_KEY.BUNDLE,
    );

    const edited = await operator.call("patch", `/packages/${bundleRow.packageId}`, {
      version: bundleRow.version,
      limits: { ...bundleRow.limits, [LIMIT_KEY.LOCATIONS]: 77 },
    });
    harness.clock.advanceSeconds(PACKAGE_CATALOG_REFRESH_MILLISECONDS / 1000 + 1);
    const after = await owner.call("get", `/orgs/${organizationId}/me/config`);

    expect(edited.status).toBe(200);
    expect(before.body.data.limits[LIMIT_KEY.LOCATIONS]).not.toBe(77);
    expect(after.body.data.limits[LIMIT_KEY.LOCATIONS]).toBe(77);
  });
});

describe("archiving a package", () => {
  it("archives a package nobody uses and makes it read-only", async () => {
    const created = await createPackage();
    const { packageId } = created.body.data;

    const archived = await operator.call("post", `/packages/${packageId}/archive`, { version: 1 });
    const again = await operator.call("post", `/packages/${packageId}/archive`, { version: 2 });
    const edit = await operator.call("patch", `/packages/${packageId}`, {
      version: 2,
      moduleKeys: [],
    });

    expect(archived.status).toBe(200);
    expect(archived.body.data.status).toBe(PACKAGE_STATUS.ARCHIVED);
    expect(again.status).toBe(409);
    expect(edit.status).toBe(409);
    expect(await auditActions(packageId)).toContain(PLATFORM_AUDIT_ACTION.PACKAGE_ARCHIVED);
  });

  it("answers 422 PACKAGE_IN_USE while a trialing subscription uses the package", async () => {
    const owner = await newActor(harness.app);
    await createOrganizationAs(owner, harness.connections, { industryTemplateKey: "RETAIL" });
    const list = await operator.call("get", "/packages?limit=100");
    const bundle = list.body.data.find(
      (row: { packageKey: string }) => row.packageKey === PACKAGE_KEY.BUNDLE,
    );

    const response = await operator.call("post", `/packages/${bundle.packageId}/archive`, {
      version: bundle.version,
    });

    expect(response.status).toBe(422);
    expect(response.body.error.details.ruleKey).toBe("PACKAGE_IN_USE");
  });
});

describe("reading packages", () => {
  it("pages the list and filters by status", async () => {
    await createPackage();

    const page = await operator.call("get", "/packages?limit=2");
    const archived = await operator.call("get", `/packages?status=${PACKAGE_STATUS.ARCHIVED}`);

    expect(page.body.data).toHaveLength(2);
    expect(page.body.meta.hasNext).toBe(true);
    expect(
      archived.body.data.every((row: { status: string }) => row.status === PACKAGE_STATUS.ARCHIVED),
    ).toBe(true);
  });

  it("answers 404 for an unknown package and never shows the Mongo _id", async () => {
    const created = await createPackage();

    const unknown = await operator.call("get", `/packages/${newId()}`);
    const known = await operator.call("get", `/packages/${created.body.data.packageId}`);

    expect(unknown.status).toBe(404);
    expect(JSON.stringify(known.body)).not.toContain("_id");
  });
});
