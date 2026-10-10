import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadConfig } from "../config/index.js";
import { initializeModels, type DatabaseConnections } from "../kernel/db/index.js";
import { registerModuleModels } from "../routes/v1.js";
import { MutableClock } from "../test-support/mutable-clock.js";
import { createTestConfig } from "../test-support/test-config.js";
import {
  connectTestDatabases,
  disposeTestDatabases,
  installTestLogger,
} from "../test-support/test-databases.js";
import { seedPlatformAdmin } from "./seed-platform-admin.js";

registerModuleModels();

let connections: DatabaseConnections;
const clock = new MutableClock();

const baseConfig = createTestConfig();
const seededConfig = (password: string) =>
  loadConfig({
    NODE_ENV: "test",
    DB_PLATFORM_URL: "mongodb://127.0.0.1:27018/platform_test",
    DB_TENANT_SHARED_URL: "mongodb://127.0.0.1:27018/tenant_test",
    REDIS_URL: "redis://127.0.0.1:6379",
    CORS_ALLOWED_ORIGINS: "http://localhost:3000",
    AUTH_ACCESS_TOKEN_SECRET: baseConfig.auth.accessTokenSecret,
    PLATFORM_ADMIN_EMAIL: "Seed.Admin@Example.com",
    PLATFORM_ADMIN_PASSWORD: password,
  });

beforeAll(async () => {
  installTestLogger();
  connections = await connectTestDatabases();
  await initializeModels();
});

afterAll(async () => {
  await disposeTestDatabases(connections);
});

async function countDocuments(collection: string): Promise<number> {
  return connections.platform.collection(collection).countDocuments();
}

describe("seedPlatformAdmin", () => {
  it("does nothing when PLATFORM_ADMIN_* is not set", async () => {
    const outcome = await seedPlatformAdmin({ config: baseConfig, clock });

    expect(outcome).toEqual({ status: "SKIPPED" });
    expect(await countDocuments("users")).toBe(0);
  });

  it("creates one user and one operator, and a second run changes nothing, not even the password", async () => {
    const first = await seedPlatformAdmin({
      config: seededConfig("first seeded passphrase"),
      clock,
    });
    const hashBefore = (await connections.platform.collection("users").findOne({}))?.[
      "passwordHash"
    ];

    const second = await seedPlatformAdmin({
      config: seededConfig("a different passphrase"),
      clock,
    });

    expect(first).toEqual({ status: "DONE", isUserCreated: true, isOperatorCreated: true });
    expect(second).toEqual({ status: "DONE", isUserCreated: false, isOperatorCreated: false });
    expect(await countDocuments("users")).toBe(1);
    expect(await countDocuments("platform_operators")).toBe(1);
    const user = await connections.platform.collection("users").findOne({});
    expect(user?.["passwordHash"]).toBe(hashBefore);
    expect(user?.["email"]).toBe("seed.admin@example.com");
  });
});
