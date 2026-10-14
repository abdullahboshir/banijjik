import {
  ACCESS_MODE,
  ALL_LOCATIONS,
  MODULE_OVERRIDE_EFFECT,
  PACKAGE_KEY,
  PAST_DUE_GRACE_DAYS,
  PERMISSION_KEY,
  SUBSCRIPTION_STATUS,
  SYSTEM_ROLE_KEY,
  TRIAL_DAYS,
} from "@banijjik/contracts";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { models } from "../../../../kernel/db/index.js";
import { registerIamApiModels, startIamApi } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import { loginViaApi } from "../../../../test-support/auth-api-scenarios.js";
import {
  BOOKKEEPING_PROBE_MANIFEST,
  buildEntitlementProbeRouter,
  removeModuleOverrides,
  WORKFLOW_PROBE_MANIFEST,
  writeModuleOverride,
} from "../../../../test-support/entitlement-world.js";
import { withOrganizationContext } from "../../../../test-support/organization-context.js";
import { KERNEL_PROBE_MANIFEST } from "../../../../test-support/probe-manifests.js";
import { addMemberWithAssignments, findSystemRoleId } from "../../../../test-support/rbac-world.js";
import { ApiActor } from "../../../../test-support/two-organizations.js";
import { registerViaApi } from "../../../../test-support/auth-api-scenarios.js";
import { buildOrganizationConfigPorts } from "../../../../routes/organization-config-ports.js";
import { buildModuleRegistry } from "../../../../routes/module-registry.js";
import { buildIndustryTemplateReader } from "../../industry/index.js";
import { buildModuleEffectiveness, buildOrgConfigService } from "../index.js";

registerIamApiModels();

const PROBE_MANIFESTS = [WORKFLOW_PROBE_MANIFEST, BOOKKEEPING_PROBE_MANIFEST];
const DAY_SECONDS = 24 * 60 * 60;

let harness: IamApiHarness;
let issuedSlugs = 0;

beforeAll(async () => {
  harness = await startIamApi({
    tenantRouters: [buildEntitlementProbeRouter()],
    extraManifests: PROBE_MANIFESTS,
  });
});

afterAll(async () => {
  await harness.dispose();
});

afterEach(() => {
  vi.restoreAllMocks();
});

interface TrialOrganization {
  readonly owner: ApiActor;
  readonly organizationId: string;
}

async function createTrialOrganization(): Promise<TrialOrganization> {
  issuedSlugs += 1;
  const owner = new ApiActor(harness.app, await registerViaApi(harness.app));
  const response = await owner.call("post", "/me/orgs", {
    name: "Trial Shop",
    slug: `entitlement-shop-${issuedSlugs}`,
    industryTemplateKey: "RETAIL",
  });
  if (response.status !== 201) throw new Error(`organization failed: ${response.status}`);
  return { owner, organizationId: response.body.data.organizationId as string };
}

function documents(collection: string, filter: object = {}) {
  return harness.connections.platform.collection(collection).find(filter).toArray();
}

describe("a new organization", () => {
  it("gets exactly one TRIALING subscription on the BUNDLE package, 14 days long", async () => {
    const { organizationId } = await createTrialOrganization();

    const subscriptions = await documents("platform_subscriptions", { organizationId });
    const bundle = await harness.connections.platform
      .collection("packages")
      .findOne({ packageKey: PACKAGE_KEY.BUNDLE });

    expect(subscriptions).toHaveLength(1);
    expect(subscriptions[0]).toMatchObject({
      status: SUBSCRIPTION_STATUS.TRIALING,
      basePackageId: bundle?.["packageId"],
      addOnPackageIds: [],
      version: 1,
    });
    const trialEndsAt = (subscriptions[0]?.["trialEndsAt"] as Date).getTime();
    expect(trialEndsAt - harness.clock.now().getTime()).toBe(TRIAL_DAYS * DAY_SECONDS * 1000);
  });

  it("is not created at all when the BUNDLE package is not seeded: 500 and no organization", async () => {
    const owner = new ApiActor(harness.app, await registerViaApi(harness.app));
    const packages = await documents("packages");
    await harness.connections.platform.collection("packages").deleteMany({});
    const organizationsBefore = (await documents("organizations")).length;
    const subscriptionsBefore = (await documents("platform_subscriptions")).length;

    const response = await owner.call("post", "/me/orgs", {
      name: "No Package Shop",
      slug: "no-package-shop",
      industryTemplateKey: "RETAIL",
    });
    await harness.connections.platform.collection("packages").insertMany(packages);

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL");
    expect(harness.logs.text()).toContain("errors.trial_package_missing");
    expect((await documents("organizations")).length).toBe(organizationsBefore);
    expect((await documents("platform_subscriptions")).length).toBe(subscriptionsBefore);
  });
});

describe("the entitlement gate", () => {
  it("serves a probe route while its module is in the package", async () => {
    const { owner, organizationId } = await createTrialOrganization();

    const response = await owner.call("get", `/orgs/${organizationId}/flows`);

    expect(response.status).toBe(200);
  });

  it("answers 403 MODULE_DISABLED on the very next request after a PLATFORM_REVOKE, and recovers after undo", async () => {
    const { owner, organizationId } = await createTrialOrganization();
    const path = `/orgs/${organizationId}/flows`;
    await owner.call("get", path);

    await writeModuleOverride({
      organizationId,
      moduleKey: "workflow",
      effect: MODULE_OVERRIDE_EFFECT.PLATFORM_REVOKE,
    });
    const revoked = await owner.call("get", path);
    const config = await owner.call("get", `/orgs/${organizationId}/me/config`);
    await removeModuleOverrides(organizationId, "workflow");
    const restored = await owner.call("get", path);

    expect(revoked.status).toBe(403);
    expect(revoked.body.error).toMatchObject({
      code: "MODULE_DISABLED",
      details: { moduleKey: "workflow" },
    });
    expect(config.body.data.modules).not.toContain("workflow");
    // The workflow probe entries are gone; the organization entries stay (Locations is hidden with one location).
    expect(config.body.data.menu.map((entry: { menuKey: string }) => entry.menuKey)).toEqual([
      "organization.profile",
      "organization.staff",
    ]);
    expect(restored.status).toBe(200);
  });

  it("lets a tenant disable a module that allows it", async () => {
    const { owner, organizationId } = await createTrialOrganization();

    await writeModuleOverride({
      organizationId,
      moduleKey: "workflow",
      effect: MODULE_OVERRIDE_EFFECT.TENANT_DISABLE,
    });
    const response = await owner.call("get", `/orgs/${organizationId}/flows`);

    expect(response.body.error?.code).toBe("MODULE_DISABLED");
  });

  it("ignores TENANT_DISABLE for a module that does not allow it, and an expired override", async () => {
    const { owner, organizationId } = await createTrialOrganization();
    await writeModuleOverride({
      organizationId,
      moduleKey: "bookkeeping",
      effect: MODULE_OVERRIDE_EFFECT.PLATFORM_GRANT,
    });
    await writeModuleOverride({
      organizationId,
      moduleKey: "bookkeeping",
      effect: MODULE_OVERRIDE_EFFECT.TENANT_DISABLE,
    });
    await writeModuleOverride({
      organizationId,
      moduleKey: "workflow",
      effect: MODULE_OVERRIDE_EFFECT.PLATFORM_REVOKE,
      expiresAt: new Date(harness.clock.now().getTime() - 1000),
    });

    const ledger = await owner.call("get", `/orgs/${organizationId}/ledger`);
    const flows = await owner.call("get", `/orgs/${organizationId}/flows`);

    expect(ledger.status).toBe(200);
    expect(flows.status).toBe(200);
  });

  it("enables a module outside the package with PLATFORM_GRANT", async () => {
    const { owner, organizationId } = await createTrialOrganization();
    const before = await owner.call("get", `/orgs/${organizationId}/ledger`);

    await writeModuleOverride({
      organizationId,
      moduleKey: "bookkeeping",
      effect: MODULE_OVERRIDE_EFFECT.PLATFORM_GRANT,
    });
    const after = await owner.call("get", `/orgs/${organizationId}/ledger`);

    expect(before.body.error).toMatchObject({
      code: "MODULE_DISABLED",
      details: { moduleKey: "bookkeeping" },
    });
    expect(after.status).toBe(200);
  });

  it("drops an override at its expiry instant without any version change", async () => {
    const { owner, organizationId } = await createTrialOrganization();
    await writeModuleOverride({
      organizationId,
      moduleKey: "workflow",
      effect: MODULE_OVERRIDE_EFFECT.PLATFORM_REVOKE,
      expiresAt: new Date(harness.clock.now().getTime() + 60_000),
    });
    const whileActive = await owner.call("get", `/orgs/${organizationId}/flows`);

    harness.clock.advanceSeconds(61);
    const afterExpiry = await owner.call("get", `/orgs/${organizationId}/flows`);

    expect(whileActive.status).toBe(403);
    expect(afterExpiry.status).toBe(200);
  });

  it("fails closed with 404 and a warn line for a tenant router that has no manifest", async () => {
    const { owner, organizationId } = await createTrialOrganization();

    const response = await owner.call("get", `/orgs/${organizationId}/forgotten`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
    const warning = harness.logs
      .lines()
      .find((line) => line["event"] === "entitlement.route_without_module");
    expect(warning).toMatchObject({ level: 40, path: "/orgs/*/forgotten" });
  });
});

describe("the config cache", () => {
  it("does not query the subscription or the overrides again on the second request", async () => {
    const { owner, organizationId } = await createTrialOrganization();
    // The compiled models are shared (ADR-023), so a spy on them counts every read the module makes.
    const subscriptionQuery = vi.spyOn(models({}).get("PlatformSubscription"), "findOne");
    const overrideQuery = vi.spyOn(models({}).get("ModuleOverride"), "find");

    await owner.call("get", `/orgs/${organizationId}/flows`);
    await owner.call("get", `/orgs/${organizationId}/flows`);
    await owner.call("get", `/orgs/${organizationId}/me/config`);

    expect(subscriptionQuery).toHaveBeenCalledTimes(1);
    expect(overrideQuery).toHaveBeenCalledTimes(1);
  });

  it("shows a package edit after the catalogue refresh interval, not before", async () => {
    const { owner, organizationId } = await createTrialOrganization();
    const path = `/orgs/${organizationId}/flows`;
    const packages = harness.connections.platform.collection("packages");
    await owner.call("get", path);
    harness.clock.advanceSeconds(6);
    await owner.call("get", path);

    await packages.updateOne(
      { packageKey: PACKAGE_KEY.BUNDLE },
      { $pull: { moduleKeys: "workflow" } as never, $inc: { version: 1 } },
    );
    harness.clock.advanceSeconds(2);
    const beforeRefresh = await owner.call("get", path);
    harness.clock.advanceSeconds(6);
    const afterRefresh = await owner.call("get", path);
    await packages.updateOne(
      { packageKey: PACKAGE_KEY.BUNDLE },
      { $push: { moduleKeys: "workflow" } as never, $inc: { version: 1 } },
    );
    harness.clock.advanceSeconds(6);
    const restored = await owner.call("get", path);

    expect(beforeRefresh.status).toBe(200);
    expect(afterRefresh.body.error?.code).toBe("MODULE_DISABLED");
    expect(restored.status).toBe(200);
  });
});

describe("GET /orgs/{organizationId}/me/config", () => {
  it("gives the owner every effective module, the limits of the package and all permissions", async () => {
    const { owner, organizationId } = await createTrialOrganization();

    const response = await owner.call("get", `/orgs/${organizationId}/me/config`);

    const registry = buildModuleRegistry([KERNEL_PROBE_MANIFEST, ...PROBE_MANIFESTS]);
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      organizationId,
      registryHash: registry.registryHash,
      accessMode: ACCESS_MODE.FULL,
      isPastDue: false,
      kinds: [],
      terms: {},
      settings: {},
      limits: {
        locations: 2,
        members: 10,
        offerings: 5000,
        ordersPerMonth: 10000,
        aiMessagesPerMonth: 3000,
        smsPerMonth: 300,
        channels: 3,
        posDevices: 2,
      },
    });
    expect(response.body.data.modules).toEqual([
      "audit",
      "iam",
      "organization",
      "settings",
      "workflow",
    ]);
    expect(response.body.data.permissions.allLocations).toEqual(
      expect.arrayContaining([
        PERMISSION_KEY.IAM_ROLE_READ,
        PERMISSION_KEY.AUDIT_LOG_READ,
        PERMISSION_KEY.ORGANIZATION_LOCATION_READ,
      ]),
    );
    expect(
      response.body.data.menu.map((entry: { permissionKey: string }) => entry.permissionKey),
    ).toEqual([
      PERMISSION_KEY.ORGANIZATION_LOCATION_READ,
      PERMISSION_KEY.IAM_ROLE_READ,
      PERMISSION_KEY.ORGANIZATION_PROFILE_UPDATE,
      PERMISSION_KEY.ORGANIZATION_MEMBER_READ,
    ]);
  });

  it("gives a viewer only the menu entries and permissions the viewer holds", async () => {
    const { organizationId } = await createTrialOrganization();
    const viewerRoleId = await findSystemRoleId(
      harness.connections,
      organizationId,
      SYSTEM_ROLE_KEY.VIEWER,
    );
    const viewer = await addMemberWithAssignments(harness.app, organizationId, [
      { locationId: ALL_LOCATIONS, roleId: viewerRoleId },
    ]);

    const response = await viewer.actor.call("get", `/orgs/${organizationId}/me/config`);

    expect(response.status).toBe(200);
    expect(response.body.data.permissions.allLocations).toEqual([
      PERMISSION_KEY.ORGANIZATION_LOCATION_READ,
    ]);
    expect(
      response.body.data.menu.map((entry: { permissionKey: string }) => entry.permissionKey),
    ).toEqual([PERMISSION_KEY.ORGANIZATION_LOCATION_READ]);
  });

  it("answers 404 for a person who is not a member, and 401 without a session", async () => {
    const { organizationId } = await createTrialOrganization();
    const stranger = new ApiActor(harness.app, await registerViaApi(harness.app));

    const crossOrganization = await stranger.call("get", `/orgs/${organizationId}/me/config`);
    const anonymous = await request(harness.app).get(`/api/v1/orgs/${organizationId}/me/config`);

    expect(crossOrganization.status).toBe(404);
    expect(anonymous.status).toBe(401);
  });
});

describe("handlers of a module that is off", () => {
  it("are gated by the real effectiveness check: SYSTEM always on, a revoked module off", async () => {
    const { organizationId } = await createTrialOrganization();
    await writeModuleOverride({
      organizationId,
      moduleKey: "workflow",
      effect: MODULE_OVERRIDE_EFFECT.PLATFORM_REVOKE,
    });
    const registry = buildModuleRegistry([KERNEL_PROBE_MANIFEST, ...PROBE_MANIFESTS]);
    const effectiveness = buildModuleEffectiveness(
      buildOrgConfigService({
        registry,
        clock: harness.clock,
        ...buildOrganizationConfigPorts(),
        templates: buildIndustryTemplateReader(harness.clock),
      }),
    );

    const answers = await withOrganizationContext(organizationId, async () => ({
      iam: await effectiveness.isEffective(organizationId, "iam"),
      workflow: await effectiveness.isEffective(organizationId, "workflow"),
      bookkeeping: await effectiveness.isEffective(organizationId, "bookkeeping"),
      unregistered: await effectiveness.isEffective(organizationId, "bot"),
    }));

    expect(answers).toEqual({
      iam: true,
      workflow: false,
      bookkeeping: false,
      unregistered: false,
    });
  });
});

describe("access modes over time", () => {
  it("shows the banner after the trial, then refuses writes but not reads after the grace period", async () => {
    const { owner, organizationId } = await createTrialOrganization();
    const flows = `/orgs/${organizationId}/flows`;
    const config = `/orgs/${organizationId}/me/config`;

    harness.clock.advanceSeconds(TRIAL_DAYS * DAY_SECONDS + 1);
    const loggedInInGrace = await signInAgain(owner);
    const inGrace = await loggedInInGrace.call("get", config);
    const writeInGrace = await loggedInInGrace.call("post", flows, {});

    harness.clock.advanceSeconds(PAST_DUE_GRACE_DAYS * DAY_SECONDS);
    const loggedInLate = await signInAgain(owner);
    const afterGrace = await loggedInLate.call("get", config);
    const write = await loggedInLate.call("post", flows, {});
    const read = await loggedInLate.call("get", flows);

    expect(inGrace.body.data).toMatchObject({ accessMode: ACCESS_MODE.FULL, isPastDue: true });
    expect(writeInGrace.status).toBe(201);
    expect(afterGrace.body.data).toMatchObject({
      accessMode: ACCESS_MODE.READ_ONLY,
      isPastDue: false,
    });
    expect(write.status).toBe(403);
    expect(write.body.error.code).toBe("ORG_READ_ONLY");
    expect(read.status).toBe(200);
  });
});

async function signInAgain(actor: ApiActor): Promise<ApiActor> {
  // The test clock moved far past the access token, so the person signs in again.
  return new ApiActor(harness.app, {
    ...actor.person,
    session: await loginViaApi(harness.app, actor.person),
  });
}
