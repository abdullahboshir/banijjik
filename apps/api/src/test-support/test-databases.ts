import { inject } from "vitest";
import { newId } from "@banijjik/ids";
import type { AppConfig } from "../config/index.js";
import { connectDatabases, type DatabaseConnections } from "../kernel/db/index.js";
import { createLogger, setRootLogger } from "../kernel/logger/index.js";
import { createLogCapture, type LogCapture } from "./log-capture.js";
import { createTestConfig } from "./test-config.js";

const SUFFIX_LENGTH = 12;

export interface TestDatabaseUrls {
  readonly platformUrl: string;
  readonly tenantSharedUrl: string;
}

function withDatabaseName(replicaSetUri: string, databaseName: string): string {
  return replicaSetUri.replace("/?", `/${databaseName}?`);
}

/** Fresh database names per call, so test files never see each other's documents. */
export function createTestDatabaseUrls(): TestDatabaseUrls {
  const suffix = newId().replaceAll("-", "").slice(-SUFFIX_LENGTH);
  const replicaSetUri = inject("mongoUri");
  return {
    platformUrl: withDatabaseName(replicaSetUri, `platform_${suffix}`),
    tenantSharedUrl: withDatabaseName(replicaSetUri, `tenant_${suffix}`),
  };
}

export function createDatabaseTestConfig(
  urls: TestDatabaseUrls = createTestDatabaseUrls(),
): AppConfig {
  return createTestConfig({
    DB_PLATFORM_URL: urls.platformUrl,
    DB_TENANT_SHARED_URL: urls.tenantSharedUrl,
  });
}

export async function connectTestDatabases(): Promise<DatabaseConnections> {
  return connectDatabases(createDatabaseTestConfig());
}

export async function disposeTestDatabases(connections: DatabaseConnections): Promise<void> {
  await connections.platform.dropDatabase();
  await connections.tenantShared.dropDatabase();
  await connections.close();
}

/** The kernel logs through getLogger(), which needs a root logger; production sets it in buildApp. */
export function installTestLogger(): LogCapture {
  const logs = createLogCapture();
  setRootLogger(createLogger({ level: "debug", destination: logs.destination }));
  return logs;
}
