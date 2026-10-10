import { describe, expect, it } from "vitest";
import { parseMongoUrl } from "../../config/index.js";
import { createTestConfig } from "../../test-support/test-config.js";
import { createDatabaseTestConfig } from "../../test-support/test-databases.js";
import { connectDatabases } from "./connect-databases.js";
import { getDatabaseConnections } from "./database-connections.js";

describe("connectDatabases", () => {
  it("rejects URLs on different hosts with the documented issue and no connection attempt", async () => {
    const config = createTestConfig({
      DB_PLATFORM_URL: "mongodb://db-one.example.com:27017/platform",
      DB_TENANT_SHARED_URL: "mongodb://db-two.example.com:27017/tenant",
    });

    await expect(connectDatabases(config)).rejects.toThrow(
      "DB_TENANT_SHARED_URL: INVALID (must be on the same cluster as DB_PLATFORM_URL until dedicated tenants exist)",
    );
  });

  it.each([
    ["credentials", "mongodb://user:one@db.example.com:27017/tenant"],
    ["options", "mongodb://db.example.com:27017/tenant?replicaSet=other"],
  ])(
    "rejects a tenant URL whose %s differ from the platform URL (M16)",
    async (_name, tenantUrl) => {
      const config = createTestConfig({
        DB_PLATFORM_URL: "mongodb://user:two@db.example.com:27017/platform",
        DB_TENANT_SHARED_URL: tenantUrl,
      });

      await expect(connectDatabases(config)).rejects.toThrow(
        "DB_TENANT_SHARED_URL: INVALID (must use the same credentials and options as DB_PLATFORM_URL until dedicated tenants exist)",
      );
    },
  );

  it("rejects two URLs that name the same database", async () => {
    const config = createTestConfig({
      DB_PLATFORM_URL: "mongodb://db-one.example.com:27017/shared",
      DB_TENANT_SHARED_URL: "mongodb://db-one.example.com:27017/shared",
    });

    await expect(connectDatabases(config)).rejects.toThrow(
      "DB_TENANT_SHARED_URL: INVALID (must name a different database than DB_PLATFORM_URL)",
    );
  });

  it("opens one cluster client with the platform and the tenant database on it", async () => {
    const config = createDatabaseTestConfig();

    const connections = await connectDatabases(config);

    try {
      expect(connections.platform.db?.databaseName).toBe(
        parseMongoUrl(config.database.platformUrl)?.databaseName,
      );
      expect(connections.tenantShared.db?.databaseName).toBe(
        parseMongoUrl(config.database.tenantSharedUrl)?.databaseName,
      );
      expect(connections.tenantShared.getClient()).toBe(connections.platform.getClient());
      expect(getDatabaseConnections()).toBe(connections);
    } finally {
      await connections.close();
    }
  });

  it("disconnects both databases and forgets the connections on close", async () => {
    const connections = await connectDatabases(createDatabaseTestConfig());

    await connections.close();

    expect(connections.platform.readyState).toBe(0);
    expect(connections.tenantShared.readyState).toBe(0);
    expect(() => getDatabaseConnections()).toThrow(/INTERNAL/);
  });
});
