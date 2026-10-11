import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { API_PASSWORD, registerViaApi } from "../test-support/auth-api-scenarios.js";
import {
  registerIamApiModels,
  startIamApi,
  type IamApiHarness,
} from "../test-support/iam-api-harness.js";
import { platformLogin } from "../test-support/platform-world.js";
import { seedPlatformAdmin } from "./seed-platform-admin.js";

registerIamApiModels();

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startIamApi();
});

afterAll(async () => {
  await harness.dispose();
});

const ATTACKER_PASSWORD = "an attacker chosen passphrase";

function seededWith(email: string, password: string) {
  return { ...harness.config, platformAdmin: { email, password } };
}

async function countOperators(): Promise<number> {
  return harness.connections.platform.collection("platform_operators").countDocuments();
}

describe("platform admin seed and an account somebody registered first (review B1)", () => {
  it("does not promote the account when the seed password is not the account's password", async () => {
    const owner = await registerViaApi(harness.app);
    const operatorsBefore = await countOperators();

    const outcome = await seedPlatformAdmin({
      config: seededWith(owner.email, ATTACKER_PASSWORD),
      clock: harness.clock,
    });

    expect(outcome).toEqual({ status: "REFUSED", reason: "PASSWORD_MISMATCH" });
    expect(await countOperators()).toBe(operatorsBefore);
    expect((await platformLogin(harness.app, owner)).status).toBe(401);
    const attacker = { email: owner.email, password: ATTACKER_PASSWORD };
    expect((await platformLogin(harness.app, attacker)).status).toBe(401);
  });

  it("promotes the account when the seed password is the account's own, and audits the seeding", async () => {
    const owner = await registerViaApi(harness.app);

    const outcome = await seedPlatformAdmin({
      config: seededWith(owner.email, API_PASSWORD),
      clock: harness.clock,
    });

    expect(outcome).toEqual({ status: "DONE", isUserCreated: false, isOperatorCreated: true });
    const login = await platformLogin(harness.app, owner);
    expect(login.status).toBe(200);
    expect(login.body.data.platformRoles).toEqual(["SUPER_ADMIN"]);
    const entry = await harness.connections.platform
      .collection("platform_audit_logs")
      .findOne({ action: "platform.operator.seeded" });
    expect(entry).toMatchObject({ actorUserId: owner.me.userId, reason: "SEED" });
  });
});
