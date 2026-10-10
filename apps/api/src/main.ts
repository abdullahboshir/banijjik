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
import { registerShutdown } from "./kernel/lifecycle/shutdown.js";
import { createLogger, setRootLogger } from "./kernel/logger/index.js";
import { registerSequenceModel } from "./kernel/sequence/index.js";

const ENV_FILE_PATH = fileURLToPath(new URL("../.env", import.meta.url));
const WORKER_KEEP_ALIVE_MS = 60 * 60 * 1000;

function listen(app: Express, port: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = app.listen(port);
    server.once("listening", () => resolve(server));
    server.once("error", reject);
  });
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
  const server = await listen(buildApp({ config, logger }), config.port);
  logger.info({ event: "api.started", port: config.port }, "api started");
  registerShutdown({
    logger,
    tasks: [
      { name: "http-server", run: () => closeServer(server) },
      createCloseDatabasesTask(connections),
    ],
    onTimeout: () => server.closeAllConnections(),
  });
}

function startWorker(logger: Logger, connections: DatabaseConnections): void {
  // The queue consumer arrives in card 1.5; until then the process just stays alive.
  const keepAlive = setInterval(() => undefined, WORKER_KEEP_ALIVE_MS);
  logger.info({ event: "worker.started" }, "worker started");
  registerShutdown({
    logger,
    tasks: [
      { name: "keep-alive", run: async () => clearInterval(keepAlive) },
      createCloseDatabasesTask(connections),
    ],
  });
}

/** Only the error class and driver code are logged: a driver message can contain the connection URL. */
function logConnectFailure(logger: Logger, error: unknown): void {
  const errorName = error instanceof Error ? error.name : "UnknownError";
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
    connections = await connectDatabases(config);
    await initializeModels();
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
    startWorker(logger, connections);
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
  const connections = await openDatabases(config, logger);
  if (connections === undefined) {
    process.exitCode = 1;
    return;
  }
  await runRole(config, logger, connections);
}

await main();
