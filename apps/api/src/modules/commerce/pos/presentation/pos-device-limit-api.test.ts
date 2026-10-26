import { MODULE_KEY, PACKAGE_KEY, SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  memberWithRole,
  startCatalogApi,
  worldFor,
} from "../../../../test-support/catalog-world.js";
import { registerIamApiModels } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import { createDevice, pairDevice, posPath } from "../../../../test-support/pos-api-world.js";
import { addMemberWithAssignments, findSystemRoleId } from "../../../../test-support/rbac-world.js";
import type { TwoOrganizations } from "../../../../test-support/two-organizations.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startCatalogApi();
});

afterAll(async () => {
  await harness.dispose();
});

function aWorld(): Promise<TwoOrganizations> {
  return worldFor(harness, RETAIL);
}

async function packageIdOf(packageKey: string): Promise<string> {
  const row = await harness.connections.platform.collection("packages").findOne({ packageKey });
  if (row === null) throw new Error(`package ${packageKey} missing`);
  return row["packageId"] as string;
}

async function setOrgPackages(
  organizationId: string,
  baseKey: string,
  addOnKeys: readonly string[] = [],
): Promise<void> {
  const basePackageId = await packageIdOf(baseKey);
  const addOnPackageIds = await Promise.all(addOnKeys.map((key) => packageIdOf(key)));
  await harness.connections.platform
    .collection("platform_subscriptions")
    .updateOne({ organizationId }, { $set: { basePackageId, addOnPackageIds } });
  await harness.connections.platform
    .collection("organizations")
    .updateOne({ organizationId }, { $inc: { configVersion: 1 } });
}

function addDevice(world: TwoOrganizations, locationId: string, name: string) {
  return world.alice.call("post", posPath(world.organizationA, "/devices"), {
    locationId,
    name,
  });
}

async function asShop(world: TwoOrganizations): Promise<void> {
  await setOrgPackages(world.organizationA, PACKAGE_KEY.SHOP);
}

async function activeDeviceCount(organizationId: string): Promise<number> {
  return harness.connections.tenantShared
    .collection("pos_devices")
    .countDocuments({ organizationId, status: "ACTIVE" });
}

describe("POS device package limit", () => {
  it("a SHOP organization adds one device and the second is refused with LIMIT_REACHED", async () => {
    const world = await aWorld();
    await asShop(world);

    const first = await addDevice(world, world.locationA1, "Counter");
    const second = await addDevice(world, world.locationA1, "Spare");

    expect(first.status).toBe(201);
    expect(second.status).toBe(422);
    expect(second.body.error).toMatchObject({
      code: "LIMIT_REACHED",
      details: { limitKey: "posDevices", limit: 1 },
    });
  });

  it("a revoked device frees its slot for a new one", async () => {
    const world = await aWorld();
    await asShop(world);
    const created = await createDevice(world.alice, {
      organizationId: world.organizationA,
      locationId: world.locationA1,
    });
    expect((await addDevice(world, world.locationA1, "Blocked")).status).toBe(422);

    const revoked = await world.alice.call(
      "post",
      posPath(world.organizationA, `/devices/${created.posDeviceId}/revoke`),
      { version: created.version },
    );
    const freed = await addDevice(world, world.locationA1, "Replacement");

    expect(revoked.status).toBe(200);
    expect(freed.status).toBe(201);
  });

  it("two concurrent creates at the last free slot create exactly one device", async () => {
    const world = await aWorld();
    await asShop(world);

    const responses = await Promise.all([
      addDevice(world, world.locationA1, "Race A"),
      addDevice(world, world.locationA1, "Race B"),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([201, 422]);
    expect(await activeDeviceCount(world.organizationA)).toBe(1);
  });

  it("ADDON_POS adds the POS module and one device", async () => {
    const world = await aWorld();
    await setOrgPackages(world.organizationA, PACKAGE_KEY.STORE, [PACKAGE_KEY.ADDON_POS]);

    const config = await world.alice.call("get", `/orgs/${world.organizationA}/me/config`);
    const first = await addDevice(world, world.locationA1, "Till");
    const second = await addDevice(world, world.locationA1, "Extra");

    expect(config.body.data.modules).toContain(MODULE_KEY.POS);
    expect(config.body.data.limits.posDevices).toBe(1);
    expect(first.status).toBe(201);
    expect(second.status).toBe(422);
  });

  it("PACK_POS_DEVICE adds one device to the package limit", async () => {
    const world = await aWorld();
    await setOrgPackages(world.organizationA, PACKAGE_KEY.SHOP);
    const before = await world.alice.call("get", `/orgs/${world.organizationA}/me/config`);
    await setOrgPackages(world.organizationA, PACKAGE_KEY.SHOP, [PACKAGE_KEY.PACK_POS_DEVICE]);
    const after = await world.alice.call("get", `/orgs/${world.organizationA}/me/config`);

    expect(before.body.data.limits.posDevices).toBe(1);
    expect(after.body.data.limits.posDevices).toBe(2);
    expect((await addDevice(world, world.locationA1, "One")).status).toBe(201);
    expect((await addDevice(world, world.locationA2, "Two")).status).toBe(201);
    expect((await addDevice(world, world.locationA1, "Three")).status).toBe(422);
  });

  it("an existing device keeps working after the limit drops below the count", async () => {
    const world = await aWorld();
    const cashier = await memberWithRole(harness, world, SYSTEM_ROLE_KEY.CASHIER);
    const waiting = await createDevice(world.alice, {
      organizationId: world.organizationA,
      locationId: world.locationA1,
      name: "Keep",
    });
    await createDevice(world.alice, {
      organizationId: world.organizationA,
      locationId: world.locationA2,
      name: "Also keep",
    });
    await asShop(world);

    const paired = await pairDevice(harness.app, cashier, {
      organizationId: world.organizationA,
      pairingCode: waiting.pairingCode,
    });
    const extra = await addDevice(world, world.locationA1, "Over");

    expect(paired.status).toBe(200);
    expect(extra.status).toBe(422);
    expect(extra.body.error.code).toBe("LIMIT_REACHED");
  });
});

describe("POS device usage and location scope", () => {
  it("the usage endpoint counts active devices of every location", async () => {
    const world = await aWorld();
    await createDevice(world.alice, {
      organizationId: world.organizationA,
      locationId: world.locationA1,
      name: "Front",
    });
    const back = await createDevice(world.alice, {
      organizationId: world.organizationA,
      locationId: world.locationA2,
      name: "Back",
    });

    const usage = await world.alice.call("get", posPath(world.organizationA, "/devices/usage"));
    await world.alice.call(
      "post",
      posPath(world.organizationA, `/devices/${back.posDeviceId}/revoke`),
      { version: back.version },
    );
    const afterRevoke = await world.alice.call(
      "get",
      posPath(world.organizationA, "/devices/usage"),
    );

    expect(usage.status).toBe(200);
    expect(usage.body.data).toEqual({ activeDeviceCount: 2 });
    expect(afterRevoke.body.data).toEqual({ activeDeviceCount: 1 });
  });

  it("a manager at one location lists only that location's devices", async () => {
    const world = await aWorld();
    await createDevice(world.alice, {
      organizationId: world.organizationA,
      locationId: world.locationA1,
      name: "A1",
    });
    await createDevice(world.alice, {
      organizationId: world.organizationA,
      locationId: world.locationA2,
      name: "A2",
    });
    const manager = await addMemberWithAssignments(harness.app, world.organizationA, [
      {
        locationId: world.locationA2,
        roleId: await findSystemRoleId(
          harness.connections,
          world.organizationA,
          SYSTEM_ROLE_KEY.MANAGER,
        ),
      },
    ]);

    const listed = await manager.actor.call("get", posPath(world.organizationA, "/devices"));
    const elsewhere = await manager.actor.call(
      "get",
      posPath(world.organizationA, `/devices?locationId=${world.locationA1}`),
    );

    expect(listed.body.data).toHaveLength(1);
    expect(listed.body.data[0].locationId).toBe(world.locationA2);
    expect(elsewhere.status).toBe(403);
    expect(elsewhere.body.error.code).toBe("LOCATION_FORBIDDEN");
  });

  it("a manager cannot revoke a device at a location they are not assigned to", async () => {
    const world = await aWorld();
    const device = await createDevice(world.alice, {
      organizationId: world.organizationA,
      locationId: world.locationA1,
    });
    const manager = await addMemberWithAssignments(harness.app, world.organizationA, [
      {
        locationId: world.locationA2,
        roleId: await findSystemRoleId(
          harness.connections,
          world.organizationA,
          SYSTEM_ROLE_KEY.MANAGER,
        ),
      },
    ]);

    const revoked = await manager.actor.call(
      "post",
      posPath(world.organizationA, `/devices/${device.posDeviceId}/revoke`),
      { version: device.version },
    );

    expect(revoked.status).toBe(404);
    expect(await activeDeviceCount(world.organizationA)).toBe(1);
  });

  it("another organization cannot revoke the device", async () => {
    const world = await aWorld();
    const device = await createDevice(world.alice, {
      organizationId: world.organizationA,
      locationId: world.locationA1,
    });

    const revoked = await world.bob.call(
      "post",
      posPath(world.organizationB, `/devices/${device.posDeviceId}/revoke`),
      { version: device.version },
    );

    expect(revoked.status).toBe(404);
    expect(await activeDeviceCount(world.organizationA)).toBe(1);
  });

  it("a cashier gets 403 on create, list, usage and revoke", async () => {
    const world = await aWorld();
    const cashier = await memberWithRole(harness, world, SYSTEM_ROLE_KEY.CASHIER);
    const device = await createDevice(world.alice, {
      organizationId: world.organizationA,
      locationId: world.locationA1,
    });
    const path = posPath(world.organizationA, "/devices");

    const create = await cashier.call("post", path, {
      locationId: world.locationA1,
      name: "Nope",
    });
    const list = await cashier.call("get", path);
    const usage = await cashier.call("get", `${path}/usage`);
    const revoke = await cashier.call("post", `${path}/${device.posDeviceId}/revoke`, {
      version: device.version,
    });

    expect([create.status, list.status, usage.status, revoke.status]).toEqual([403, 403, 403, 403]);
  });
});
