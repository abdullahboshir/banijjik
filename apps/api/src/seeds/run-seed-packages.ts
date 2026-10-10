import { fileURLToPath } from "node:url";
import { ConfigError, loadConfigFromProcess, type AppConfig } from "../config/index.js";
import { connectDatabases, initializeModels } from "../kernel/db/index.js";
import { createLogger, setRootLogger, type Logger } from "../kernel/logger/index.js";
import { systemClock } from "../kernel/time/index.js";
import { registerModuleModels } from "../routes/v1.js";
import { seedPackages } from "./seed-packages.js";

const ENV_FILE_PATH = fileURLToPath(new URL("../../.env", import.meta.url));

async function seedWithConnectedDatabases(config: AppConfig, logger: Logger): Promise<void> {
  registerModuleModels();
  const connections = await connectDatabases(config);
  try {
    await initializeModels();
    const outcome = await seedPackages(systemClock);
    logger.info({ event: "seed.packages_done", ...outcome }, "package seed finished");
  } finally {
    await connections.close();
  }
}

async function run(): Promise<number> {
  let config: AppConfig;
  try {
    config = loadConfigFromProcess(ENV_FILE_PATH);
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    createLogger({ level: "info" }).fatal(
      { event: "config.invalid", issues: error.issues },
      "invalid configuration",
    );
    return 1;
  }
  const logger = createLogger({ level: config.logLevel });
  setRootLogger(logger);
  try {
    await seedWithConnectedDatabases(config, logger);
    return 0;
  } catch (error) {
    logger.fatal({ event: "seed.packages_failed", err: error }, "package seed failed");
    return 1;
  }
}

process.exitCode = await run();
