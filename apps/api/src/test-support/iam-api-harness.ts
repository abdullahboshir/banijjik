import type { ModuleManifest } from "@banijjik/contracts";
import type { Express, Router } from "express";
import type { PermissionMiddlewareFactory } from "../kernel/access/index.js";
import type { IndustryTemplateReader } from "../modules/platform/entitlement/index.js";
import { buildApp } from "../app.js";
import type { AppConfig } from "../config/index.js";
import {
  connectDatabases,
  initializeModels,
  type DatabaseConnections,
} from "../kernel/db/index.js";
import { createLogger } from "../kernel/logger/index.js";
import { registerIdempotencyModel } from "../kernel/idempotency/index.js";
import { registerEventModels } from "../kernel/events/index.js";
import {
  MongoRateLimiter,
  registerRateLimitModel,
  type RateLimiter,
} from "../kernel/rate-limit/index.js";
import type { RedisClient } from "../kernel/redis/index.js";
import { registerSequenceModel } from "../kernel/sequence/index.js";
import { buildEnsureSeedPackagesUseCase } from "../modules/platform/package/index.js";
import { buildV1Router, registerModuleModels } from "../routes/v1.js";
import { createLogCapture, type LogCapture } from "./log-capture.js";
import { MutableClock } from "./mutable-clock.js";
import { KERNEL_PROBE_MANIFEST } from "./probe-manifests.js";
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
  registerIdempotencyModel();
  registerEventModels();
  registerModuleModels();
}

type StartIamApiOptions = NonNullable<Parameters<typeof startIamApi>[0]>;

/**
 * Without probe routers or a replaced limiter the app builds its own v1 router, exactly as
 * production does (it then has no Redis, so no per-user limit); with them, the same router plus
 * what the test asked for.
 */
function buildProbeV1Router(
  options: StartIamApiOptions,
  config: AppConfig,
  clock: MutableClock,
): Router | undefined {
  const needsOwnRouter =
    options.tenantRouters !== undefined ||
    options.tenantRouterFactories !== undefined ||
    options.userRateLimiter !== undefined;
  if (!needsOwnRouter) return undefined;
  return buildV1Router({
    config,
    clock,
    rateLimiter: new MongoRateLimiter(clock),
    tenantRouters: options.tenantRouters ?? [],
    tenantRouterFactories: options.tenantRouterFactories ?? [],
    extraManifests: [KERNEL_PROBE_MANIFEST, ...(options.extraManifests ?? [])],
    ...(options.templateReader === undefined ? {} : { templateReader: options.templateReader }),
    ...(options.userRateLimiter === undefined ? {} : { userRateLimiter: options.userRateLimiter }),
  });
}
/** The real app on a real replica set, with a clock the test controls and the logs captured. */
export async function startIamApi(
  options: {
    readonly tenantRouters?: readonly Router[];
    readonly tenantRouterFactories?: readonly ((
      permission: PermissionMiddlewareFactory,
    ) => Router)[];
    /** Probe modules registered next to the kernel probe module (card 1.6a). */
    readonly extraManifests?: readonly ModuleManifest[];
    /** Lets a test choose which modules and kinds the industry template allows (card 1.6b). */
    readonly templateReader?: IndustryTemplateReader;
    /** Replaces the Redis-backed per-user limiter, which the harness has no Redis for (card 1.9d). */
    readonly userRateLimiter?: RateLimiter;
    /** The API role's cache client: with it the app builds the real Redis per-user limiter, as production does. */
    readonly redis?: RedisClient;
  } = {},
): Promise<IamApiHarness> {
  const config = createDatabaseTestConfig();
  const connections = await connectDatabases(config);
  await initializeModels();
  const logs = createLogCapture();
  const logger = createLogger({ level: "debug", destination: logs.destination });
  // The real time as the starting point: stored TTL dates must not look expired to MongoDB.
  const clock = new MutableClock(new Date());
  // Every new organization starts a trial on the BUNDLE package, so the packages are seeded first.
  await buildEnsureSeedPackagesUseCase(clock).execute();
  const v1Router = buildProbeV1Router(options, config, clock);
  const app = buildApp({
    config,
    logger,
    clock,
    ...(v1Router === undefined ? {} : { v1Router }),
    ...(options.redis === undefined ? {} : { redis: options.redis }),
  });
  return {
    app,
    config,
    clock,
    logs,
    connections,
    dispose: () => disposeTestDatabases(connections),
  };
}
