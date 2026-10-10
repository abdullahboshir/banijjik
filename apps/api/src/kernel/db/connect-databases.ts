import mongoose, { type ConnectOptions } from "mongoose";
import { ConfigError, parseMongoUrl, type AppConfig } from "../../config/index.js";
import {
  clearDatabaseConnections,
  setDatabaseConnections,
  type DatabaseConnections,
} from "./database-connections.js";

const SERVER_SELECTION_TIMEOUT_MS = 10_000;
const TENANT_URL_KEY = "DB_TENANT_SHARED_URL";
const SAME_CLUSTER_HINT =
  "must be on the same cluster as DB_PLATFORM_URL until dedicated tenants exist";
const SAME_CREDENTIALS_HINT =
  "must use the same credentials and options as DB_PLATFORM_URL until dedicated tenants exist";
const DIFFERENT_DATABASE_HINT = "must name a different database than DB_PLATFORM_URL";

function invalidTenantUrl(hint: string): ConfigError {
  return new ConfigError([{ key: TENANT_URL_KEY, problem: "INVALID", hint }]);
}

/** Pure check, run before any network call so a bad config fails fast and without side effects. */
function resolveTenantDatabaseName(config: AppConfig): string {
  const platform = parseMongoUrl(config.database.platformUrl);
  const tenant = parseMongoUrl(config.database.tenantSharedUrl);
  if (platform === undefined || tenant === undefined) {
    throw invalidTenantUrl("must be a mongodb:// or mongodb+srv:// URL with a database name");
  }
  if (platform.hosts.join(",") !== tenant.hosts.join(",")) {
    throw invalidTenantUrl(SAME_CLUSTER_HINT);
  }
  // Only the platform URL opens a connection (one client for one transaction), so a different login
  // or option in the tenant URL would be ignored without a word (review finding M16).
  if (platform.credentials !== tenant.credentials || platform.options !== tenant.options) {
    throw invalidTenantUrl(SAME_CREDENTIALS_HINT);
  }
  if (platform.databaseName === tenant.databaseName) {
    throw invalidTenantUrl(DIFFERENT_DATABASE_HINT);
  }
  return tenant.databaseName;
}

function buildConnectOptions(config: AppConfig): ConnectOptions {
  return {
    serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
    // Production builds indexes with an explicit sync task, never as a side effect of startup.
    autoIndex: config.nodeEnv !== "production",
  };
}

/**
 * Opens ONE cluster client and derives the tenant database from it with useDb, so a single
 * session (and therefore one transaction) can write to both databases. Dedicated tenants
 * (Phase 8) will add a client per tenant behind models(ctx).
 */
export async function connectDatabases(config: AppConfig): Promise<DatabaseConnections> {
  const tenantDatabaseName = resolveTenantDatabaseName(config);
  const platform = await mongoose
    .createConnection(config.database.platformUrl, buildConnectOptions(config))
    .asPromise();
  const tenantShared = platform.useDb(tenantDatabaseName, { useCache: true });

  const connections: DatabaseConnections = {
    platform,
    tenantShared,
    close: async () => {
      clearDatabaseConnections(connections);
      await platform.close();
    },
  };
  setDatabaseConnections(connections);
  return connections;
}
