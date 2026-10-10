import type { Server } from "node:http";
import { fileURLToPath } from "node:url";
import type { Express } from "express";
import type { Logger } from "pino";
import { buildApp } from "./app.js";
import { ConfigError, loadConfigFromProcess, type AppConfig } from "./config/index.js";
import {
  connectDatabases,
  createCloseDatabasesTask,
  initializeModels,
  type DatabaseConnections,
} from "./kernel/db/index.js";
import { registerEventModels } from "./kernel/events/index.js";
import { registerCrashHandlers } from "./kernel/lifecycle/crash-handlers.js";
import { registerShutdown } from "./kernel/lifecycle/shutdown.js";
import { createLogger, setRootLogger } from "./kernel/logger/index.js";
import { registerIdempotencyModel } from "./kernel/idempotency/index.js";
import { registerRateLimitModel } from "./kernel/rate-limit/index.js";
import {
  createCacheRedisClient,
  createCloseRedisTask,
  type RedisClient,
} from "./kernel/redis/index.js";
import { registerSequenceModel } from "./kernel/sequence/index.js";
import { systemClock } from "./kernel/time/index.js";
import { registerModuleModels } from "./routes/v1.js";
import { seedPackages } from "./seeds/seed-packages.js";
import { startWorker } from "./start-worker.js";

const ENV_FILE_PATH = fileURLToPath(new URL("../.env", import.meta.url));

function listen(app: Express, port: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = app.listen(port);
    server.once("listening", () => resolve(server));
    server.once("error", reject);
  });
}

/** A port that is taken must not leave the Redis client holding the process open. */
async function listenOrRelease(app: Express, port: number, redis: RedisClient): Promise<Server> {
  try {
    return await listen(app, port);
  } catch (error) {
    redis.disconnect();
    throw error;
  }
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
    // Idle keep-alive sockets would otherwise hold close() open until they time out.
    server.closeIdleConnections();
  });
}

async function startApi(
  config: AppConfig,
  logger: Logger,
  connections: DatabaseConnections,
): Promise<void> {
  // The cache client connects in the background: a Redis that is away costs a database lookup, not startup.
  const redis = createCacheRedisClient(config.redisUrl);
  const server = await listenOrRelease(buildApp({ config, logger, redis }), config.port, redis);
  logger.info({ event: "api.started", port: config.port }, "api started");
  registerShutdown({
    logger,
    tasks: [
      { name: "http-server", run: () => closeServer(server) },
      createCloseRedisTask(redis),
      createCloseDatabasesTask(connections),
    ],
    onTimeout: () => server.closeAllConnections(),
  });
}

/** Only the error class and driver code are logged: a driver message can contain the connection URL. */
function logConnectFailure(logger: Logger, error: unknown): void {
  const errorName = error instanceof Error ? error.name : "UnknownError";
  // Safe: only the optional driver `code` is read, and optional chaining covers null.
  const errorCode = (error as { code?: unknown } | null)?.code;
  logger.fatal({ event: "db.connect_failed", errorName, errorCode }, "database connection failed");
}

async function openDatabases(
  config: AppConfig,
  logger: Logger,
): Promise<DatabaseConnections | undefined> {
  let connections: DatabaseConnections | undefined;
  try {
    registerSequenceModel();
    registerRateLimitModel();
    registerIdempotencyModel();
    registerEventModels();
    registerModuleModels();
    connections = await connectDatabases(config);
    await initializeModels();
    // Idempotent: inserts only the missing packages, so a fresh environment can create its first organization.
    const seeded = await seedPackages(systemClock);
    logger.info({ event: "packages.seeded", ...seeded }, "seed packages ensured");
    logger.info({ event: "db.connected" }, "databases connected");
    return connections;
  } catch (error) {
    await connections?.close();
    if (error instanceof ConfigError) {
      logger.fatal({ event: "config.invalid", issues: error.issues }, "invalid configuration");
    } else {
      logConnectFailure(logger, error);
    }
    return undefined;
  }
}

function loadConfigOrReport(): AppConfig | undefined {
  try {
    return loadConfigFromProcess(ENV_FILE_PATH);
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    const bootLogger = createLogger({ level: "info" });
    bootLogger.fatal({ event: "config.invalid", issues: error.issues }, "invalid configuration");
    return undefined;
  }
}

async function runRole(
  config: AppConfig,
  logger: Logger,
  connections: DatabaseConnections,
): Promise<void> {
  if (config.role === "worker") {
    registerShutdown({ logger, tasks: startWorker(config, logger, connections) });
    return;
  }
  try {
    await startApi(config, logger, connections);
  } catch (error) {
    // Typically EADDRINUSE: report it through the logger and fail the process instead of an unhandled rejection.
    logger.fatal({ event: "api.start_failed", err: error }, "api failed to start");
    await connections.close();
    process.exitCode = 1;
  }
}

async function main(): Promise<void> {
  const config = loadConfigOrReport();
  if (config === undefined) {
    process.exitCode = 1;
    return;
  }
  const logger = createLogger({ level: config.logLevel });
  // buildApp sets this too; the worker has no app, but its code still logs through getLogger().
  setRootLogger(logger);
  registerCrashHandlers();
  const connections = await openDatabases(config, logger);
  if (connections === undefined) {
    process.exitCode = 1;
    return;
  }
  await runRole(config, logger, connections);
}

await main();
