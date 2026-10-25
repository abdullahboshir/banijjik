import { SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { POS_DEVICE_COOKIE_NAME, POS_PAIRING_RULES } from "@banijjik/contracts/pos";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseSetCookies } from "../../../../test-support/auth-api-client.js";
import {
  memberWithRole,
  startCatalogApi,
  worldFor,
} from "../../../../test-support/catalog-world.js";
import { registerIamApiModels } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import {
  createDevice,
  openRegister,
  pairDevice,
  pairedTill,
  posPath,
  tillCall,
  bdt,
} from "../../../../test-support/pos-api-world.js";
import { addMemberWithAssignments, findSystemRoleId } from "../../../../test-support/rbac-world.js";
import type { TwoOrganizations } from "../../../../test-support/two-organizations.js";

registerIamApiModels();

const RETAIL = { industryTemplateKey: "RETAIL" };
const MS_PER_MINUTE = 60_000;

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startCatalogApi();
});

afterAll(async () => {
  await harness.dispose();
});

async function aWorld(): Promise<TwoOrganizations> {
  return worldFor(harness, RETAIL);
}

describe("POS device pairing", () => {
  it("a manager creates a device, a cashier pairs it with the code once, and the device cookie binds the location", async () => {
    const world = await aWorld();
    const cashier = await memberWithRole(harness, world, SYSTEM_ROLE_KEY.CASHIER);

    const created = await world.alice.call("post", posPath(world.organizationA, "/devices"), {
      locationId: world.locationA1,
      name: "Front counter",
    });
    expect(created.status).toBe(201);
    expect(created.body.data.pairingCode).toMatch(/^[0-9]{8}$/);
    expect(created.body.data).toMatchObject({ status: "ACTIVE", isAwaitingPairing: true });

    const paired = await pairDevice(harness.app, cashier, {
      organizationId: world.organizationA,
      pairingCode: created.body.data.pairingCode,
    });
    expect(paired.status, JSON.stringify(paired.body)).toBe(200);
    expect(paired.body.data).toEqual({
      posDeviceId: created.body.data.posDeviceId,
      locationId: world.locationA1,
      name: "Front counter",
    });
    const cookie = parseSetCookies(paired).find((entry) => entry.name === POS_DEVICE_COOKIE_NAME);
    expect(cookie?.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(cookie?.value).not.toBe(created.body.data.posDeviceId);
    expect(cookie?.attributes).toEqual(
      expect.arrayContaining(["HttpOnly", "SameSite=Lax", "Path=/api/v1"]),
    );
    expect(JSON.stringify(paired.body)).not.toContain(cookie?.value ?? "no cookie");

    const listed = await world.alice.call("get", posPath(world.organizationA, "/devices"));
    expect(listed.body.data).toHaveLength(1);
    expect(listed.body.data[0]).toMatchObject({ isAwaitingPairing: false });
    expect(listed.body.data[0].pairedAt).not.toBeNull();
    expect(JSON.stringify(listed.body)).not.toMatch(/pairingCode|secretHash|pairingCodeHash/);
  });

  it("opens a register at the location of the device, never one from the request", async () => {
    const world = await aWorld();
    const cashier = await memberWithRole(harness, world, SYSTEM_ROLE_KEY.CASHIER);
    const till = await pairedTill(harness.app, {
      manager: world.alice,
      cashier,
      organizationId: world.organizationA,
      locationId: world.locationA2,
    });

    const session = await openRegister(till, 1_000);
    const withLocation = await tillCall(till, {
      method: "post",
      suffix: "/sessions",
      body: { openingFloat: bdt(0), locationId: world.locationA1 },
    });

    expect(session).toBeDefined();
    expect(withLocation.status).toBe(400);
    const opened = await harness.connections.tenantShared
      .collection("pos_sessions")
      .findOne({ posSessionId: session.posSessionId });
    expect(opened?.["locationId"]).toBe(world.locationA2);
  });

  it("a wrong, expired or reused pairing code is the same 400", async () => {
    const world = await aWorld();
    const cashier = await memberWithRole(harness, world, SYSTEM_ROLE_KEY.CASHIER);
    const used = await createDevice(world.alice, {
      organizationId: world.organizationA,
      locationId: world.locationA1,
    });
    const first = await pairDevice(harness.app, cashier, {
      organizationId: world.organizationA,
      pairingCode: used.pairingCode,
    });
    const expiring = await createDevice(world.alice, {
      organizationId: world.organizationA,
      locationId: world.locationA1,
    });
    await harness.connections.tenantShared
      .collection("pos_devices")
      .updateOne(
        { posDeviceId: expiring.posDeviceId },
        { $set: { pairingExpiresAt: new Date(Date.now() - MS_PER_MINUTE) } },
      );

    const attempts = ["00000000", used.pairingCode, expiring.pairingCode].map((pairingCode) =>
      pairDevice(harness.app, cashier, { organizationId: world.organizationA, pairingCode }),
    );
    const answers = await Promise.all(attempts);

    expect(first.status).toBe(200);
    for (const answer of answers) {
      expect(answer.status).toBe(400);
      expect(answer.body.error.code).toBe("VALIDATION_ERROR");
      expect(answer.body.error.messageKey).toBe("errors.pos_pairing_invalid");
      expect(answer.body.error.details).toBeUndefined();
    }
  });

  it("refuses a code that is not eight digits before it counts as a guess", async () => {
    const world = await aWorld();
    const cashier = await memberWithRole(harness, world, SYSTEM_ROLE_KEY.CASHIER);

    const short = await pairDevice(harness.app, cashier, {
      organizationId: world.organizationA,
      pairingCode: "1234",
    });
    const letters = await pairDevice(harness.app, cashier, {
      organizationId: world.organizationA,
      pairingCode: "abcdefgh",
    });

    expect([short.status, letters.status]).toEqual([400, 400]);
    expect(short.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("pairing is rate limited", async () => {
    const world = await aWorld();
    const cashier = await memberWithRole(harness, world, SYSTEM_ROLE_KEY.CASHIER);
    const answers: number[] = [];

    for (let attempt = 0; attempt <= POS_PAIRING_RULES.attemptsPerMemberPerHour; attempt += 1) {
      const answer = await pairDevice(harness.app, cashier, {
        organizationId: world.organizationA,
        pairingCode: String(attempt).padStart(POS_PAIRING_RULES.codeLength, "0"),
      });
      answers.push(answer.status);
      if (attempt === POS_PAIRING_RULES.attemptsPerMemberPerHour) {
        expect(answer.body.error.code).toBe("RATE_LIMITED");
        expect(answer.headers["retry-after"]).toBeDefined();
      }
    }

    expect(answers.slice(0, -1).every((status) => status === 400)).toBe(true);
    expect(answers.at(-1)).toBe(429);
  });
});

describe("POS device revoke", () => {
  it("a revoked device cannot sell but its open session can be closed", async () => {
    const world = await aWorld();
    const cashier = await memberWithRole(harness, world, SYSTEM_ROLE_KEY.CASHIER);
    const till = await pairedTill(harness.app, {
      manager: world.alice,
      cashier,
      organizationId: world.organizationA,
      locationId: world.locationA1,
    });
    const session = await openRegister(till, 500);

    const devices = await world.alice.call("get", posPath(world.organizationA, "/devices"));
    const revoked = await world.alice.call(
      "post",
      posPath(world.organizationA, `/devices/${till.posDeviceId}/revoke`),
      { version: devices.body.data[0].version },
    );
    const sale = await tillCall(till, { method: "post", suffix: "/sales", body: { lines: [] } });
    const reopen = await tillCall(till, {
      method: "post",
      suffix: "/sessions",
      body: { openingFloat: bdt(0) },
    });
    const snapshot = await tillCall(till, { method: "get", suffix: "/catalog-snapshot" });
    const closed = await tillCall(till, {
      method: "post",
      suffix: `/sessions/${session.posSessionId}/close`,
      body: { countedCash: bdt(500), version: session.version },
    });

    expect(revoked.status, JSON.stringify(revoked.body)).toBe(200);
    expect(revoked.body.data.status).toBe("REVOKED");
    for (const refused of [sale, reopen, snapshot]) {
      expect(refused.status).toBe(403);
      expect(refused.body.error.messageKey).toBe("errors.pos_device_required");
    }
    expect(closed.status, JSON.stringify(closed.body)).toBe(200);
    expect(closed.body.data.status).toBe("CLOSED");
  });

  it("answers a stale revoke version with 409 and an unused code cannot pair once revoked", async () => {
    const world = await aWorld();
    const cashier = await memberWithRole(harness, world, SYSTEM_ROLE_KEY.CASHIER);
    const device = await createDevice(world.alice, {
      organizationId: world.organizationA,
      locationId: world.locationA1,
    });

    const stale = await world.alice.call(
      "post",
      posPath(world.organizationA, `/devices/${device.posDeviceId}/revoke`),
      { version: device.version + 5 },
    );
    const revoked = await world.alice.call(
      "post",
      posPath(world.organizationA, `/devices/${device.posDeviceId}/revoke`),
      { version: device.version },
    );
    const pairAfter = await pairDevice(harness.app, cashier, {
      organizationId: world.organizationA,
      pairingCode: device.pairingCode,
    });

    expect(stale.status).toBe(409);
    expect(revoked.status).toBe(200);
    expect(pairAfter.status).toBe(400);
    expect(pairAfter.body.error.messageKey).toBe("errors.pos_pairing_invalid");
  });
});

describe("POS device access", () => {
  it("refuses staff without the POS permissions", async () => {
    const world = await aWorld();
    const cashier = await memberWithRole(harness, world, SYSTEM_ROLE_KEY.CASHIER);
    const till = await pairedTill(harness.app, {
      manager: world.alice,
      cashier,
      organizationId: world.organizationA,
      locationId: world.locationA1,
    });

    const sale = await tillCall(till, {
      method: "post",
      suffix: "/sales",
      body: { lines: [] },
      as: world.sam,
    });
    const create = await world.sam.call("post", posPath(world.organizationA, "/devices"), {
      locationId: world.locationA1,
      name: "Nope",
    });
    const cashierCreate = await cashier.call("post", posPath(world.organizationA, "/devices"), {
      locationId: world.locationA1,
      name: "Nope",
    });

    expect([sale.status, create.status, cashierCreate.status]).toEqual([403, 403, 403]);
    expect(sale.body.error.code).toBe("FORBIDDEN");
  });

  it("answers a device or session of another organization with 404, and its cookie with 403", async () => {
    const world = await aWorld();
    const cashier = await memberWithRole(harness, world, SYSTEM_ROLE_KEY.CASHIER);
    const till = await pairedTill(harness.app, {
      manager: world.alice,
      cashier,
      organizationId: world.organizationA,
      locationId: world.locationA1,
    });
    const session = await openRegister(till);

    const revoke = await world.bob.call(
      "post",
      posPath(world.organizationB, `/devices/${till.posDeviceId}/revoke`),
      { version: 1 },
    );
    const report = await world.bob.call(
      "get",
      posPath(world.organizationB, `/sessions/${session.posSessionId}/z-report`),
    );
    const close = await world.bob.call(
      "post",
      posPath(world.organizationB, `/sessions/${session.posSessionId}/close`),
      { countedCash: bdt(0), version: 1 },
    );
    const foreignCookie = await tillCall(
      { ...till, organizationId: world.organizationB },
      { method: "get", suffix: "/catalog-snapshot", as: world.bob },
    );

    expect([revoke.status, report.status, close.status]).toEqual([404, 404, 404]);
    expect(foreignCookie.status).toBe(403);
    expect(foreignCookie.body.error.messageKey).toBe("errors.pos_device_required");
  });

  it("a device of location A used by a member assigned only to B is 403", async () => {
    const world = await aWorld();
    const cashier = await memberWithRole(harness, world, SYSTEM_ROLE_KEY.CASHIER);
    const till = await pairedTill(harness.app, {
      manager: world.alice,
      cashier,
      organizationId: world.organizationA,
      locationId: world.locationA1,
    });
    const roleId = await findSystemRoleId(
      harness.connections,
      world.organizationA,
      SYSTEM_ROLE_KEY.CASHIER,
    );
    const otherShop = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: world.locationA2, roleId },
    ]);

    const snapshot = await tillCall(till, {
      method: "get",
      suffix: "/catalog-snapshot",
      as: otherShop.actor,
    });
    const open = await tillCall(till, {
      method: "post",
      suffix: "/sessions",
      body: { openingFloat: bdt(0) },
      as: otherShop.actor,
    });

    expect([snapshot.status, open.status]).toEqual([403, 403]);
    expect(snapshot.body.error.messageKey).toBe("errors.pos_device_required");
  });

  it("refuses a device for a location the manager does not reach, and an unknown one", async () => {
    const world = await aWorld();
    const managerRoleId = await findSystemRoleId(
      harness.connections,
      world.organizationA,
      SYSTEM_ROLE_KEY.MANAGER,
    );
    const manager = await addMemberWithAssignments(harness.app, world.organizationA, [
      { locationId: world.locationA2, roleId: managerRoleId },
    ]);

    const elsewhere = await manager.actor.call("post", posPath(world.organizationA, "/devices"), {
      locationId: world.locationA1,
      name: "Wrong place",
    });
    const unknown = await world.alice.call("post", posPath(world.organizationA, "/devices"), {
      locationId: world.locationB1,
      name: "Other organization",
    });
    const own = await manager.actor.call("post", posPath(world.organizationA, "/devices"), {
      locationId: world.locationA2,
      name: "Own place",
    });

    expect(elsewhere.status).toBe(403);
    expect(elsewhere.body.error.code).toBe("LOCATION_FORBIDDEN");
    expect(unknown.status).toBe(404);
    expect(own.status).toBe(201);
  });
});

describe("POS module switch", () => {
  it("module off: the POS routes answer the module-off response", async () => {
    const world = await aWorld();
    const disabled = await world.alice.call(
      "post",
      `/orgs/${world.organizationA}/modules/pos/disable`,
      { reason: "No counter sales yet" },
    );
    expect(disabled.status, JSON.stringify(disabled.body)).toBe(200);

    for (const suffix of ["/devices", "/catalog-snapshot"]) {
      const response = await world.alice.call("get", posPath(world.organizationA, suffix));
      expect(response.status, suffix).toBe(403);
      expect(response.body.error.code).toBe("MODULE_DISABLED");
    }
    const create = await world.alice.call("post", posPath(world.organizationA, "/devices"), {
      locationId: world.locationA1,
      name: "Closed",
    });
    expect(create.status).toBe(403);
    expect(create.body.error.code).toBe("MODULE_DISABLED");
  });
});
