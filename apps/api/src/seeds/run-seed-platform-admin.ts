import { fileURLToPath } from "node:url";
import { ConfigError, loadConfigFromProcess, type AppConfig } from "../config/index.js";
import { connectDatabases, initializeModels } from "../kernel/db/index.js";
import { createLogger, setRootLogger, type Logger } from "../kernel/logger/index.js";
import { systemClock } from "../kernel/time/index.js";
import { registerModuleModels } from "../routes/v1.js";
import { seedPlatformAdmin } from "./seed-platform-admin.js";

const ENV_FILE_PATH = fileURLToPath(new URL("../../.env", import.meta.url));

async function seedWithConnectedDatabases(config: AppConfig, logger: Logger): Promise<void> {
  registerModuleModels();
  const connections = await connectDatabases(config);
  try {
    await initializeModels();
    const outcome = await seedPlatformAdmin({ config, clock: systemClock });
    // Counts and flags only: the admin email is never logged.
    logger.info({ event: "seed.platform_admin_done", ...outcome }, "platform admin seed finished");
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
  if (config.platformAdmin === undefined) {
    logger.info(
      { event: "seed.platform_admin_skipped" },
      "PLATFORM_ADMIN_* is not set, nothing to do",
    );
    return 0;
  }
  try {
    await seedWithConnectedDatabases(config, logger);
    return 0;
  } catch (error) {
    logger.fatal({ event: "seed.platform_admin_failed", err: error }, "platform admin seed failed");
    return 1;
  }
}

process.exitCode = await run();
