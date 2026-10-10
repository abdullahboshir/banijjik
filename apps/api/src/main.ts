import type { Server } from "node:http";
import { fileURLToPath } from "node:url";
import type { Express } from "express";
import type { Logger } from "pino";
import { buildApp } from "./app.js";
import { ConfigError, loadConfigFromProcess, type AppConfig } from "./config/index.js";
import { createLogger } from "./kernel/logger/index.js";
import { registerShutdown } from "./kernel/lifecycle/shutdown.js";

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

async function startApi(config: AppConfig, logger: Logger): Promise<void> {
  const server = await listen(buildApp({ config, logger }), config.port);
  logger.info({ event: "api.started", port: config.port }, "api started");
  registerShutdown({
    logger,
    tasks: [{ name: "http-server", run: () => closeServer(server) }],
    onTimeout: () => server.closeAllConnections(),
  });
}

function startWorker(logger: Logger): void {
  // The queue consumer arrives in card 1.5; until then the process just stays alive.
  const keepAlive = setInterval(() => undefined, WORKER_KEEP_ALIVE_MS);
  logger.info({ event: "worker.started" }, "worker started");
  registerShutdown({
    logger,
    tasks: [{ name: "keep-alive", run: async () => clearInterval(keepAlive) }],
  });
}

async function main(): Promise<void> {
  let config: AppConfig;
  try {
    config = loadConfigFromProcess(ENV_FILE_PATH);
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    const bootLogger = createLogger({ level: "info" });
    bootLogger.fatal({ event: "config.invalid", issues: error.issues }, "invalid configuration");
    process.exitCode = 1;
    return;
  }
  const logger = createLogger({ level: config.logLevel });
  if (config.role === "worker") {
    startWorker(logger);
    return;
  }
  try {
    await startApi(config, logger);
  } catch (error) {
    // Typically EADDRINUSE: report it through the logger and fail the process instead of an unhandled rejection.
    logger.fatal({ event: "api.start_failed", err: error }, "api failed to start");
    process.exitCode = 1;
  }
}

await main();
