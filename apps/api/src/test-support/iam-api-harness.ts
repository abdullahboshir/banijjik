import type { Express, Router } from "express";
import { buildApp } from "../app.js";
import type { AppConfig } from "../config/index.js";
import {
  connectDatabases,
  initializeModels,
  type DatabaseConnections,
} from "../kernel/db/index.js";
import { createLogger } from "../kernel/logger/index.js";
import { MongoRateLimiter, registerRateLimitModel } from "../kernel/rate-limit/index.js";
import { registerSequenceModel } from "../kernel/sequence/index.js";
import { buildV1Router, registerModuleModels } from "../routes/v1.js";
import { createLogCapture, type LogCapture } from "./log-capture.js";
import { MutableClock } from "./mutable-clock.js";
import { createDatabaseTestConfig, disposeTestDatabases } from "./test-databases.js";

export interface IamApiHarness {
  readonly app: Express;
  readonly config: AppConfig;
  readonly clock: MutableClock;
  readonly logs: LogCapture;
  readonly connections: DatabaseConnections;
  dispose(): Promise<void>;
}

/**
 * Registers the models the real v1 router needs. Call it once at the top of a test file: the model
 * registry is per module instance, and registering twice throws.
 */
export function registerIamApiModels(): void {
  registerRateLimitModel();
  registerSequenceModel();
  registerModuleModels();
}

/** The real app on a real replica set, with a clock the test controls and the logs captured. */
export async function startIamApi(
  options: { readonly tenantRouters?: readonly Router[] } = {},
): Promise<IamApiHarness> {
  const config = createDatabaseTestConfig();
  const connections = await connectDatabases(config);
  await initializeModels();
  const logs = createLogCapture();
  const logger = createLogger({ level: "debug", destination: logs.destination });
  // The real time as the starting point: stored TTL dates must not look expired to MongoDB.
  const clock = new MutableClock(new Date());
  // Without tenant routers the app builds its own v1 router, exactly as production does.
  const v1Router =
    options.tenantRouters === undefined
      ? undefined
      : buildV1Router({
          config,
          clock,
          rateLimiter: new MongoRateLimiter(clock),
          tenantRouters: options.tenantRouters,
        });
  const app = buildApp({ config, logger, clock, ...(v1Router === undefined ? {} : { v1Router }) });
  return {
    app,
    config,
    clock,
    logs,
    connections,
    dispose: () => disposeTestDatabases(connections),
  };
}
