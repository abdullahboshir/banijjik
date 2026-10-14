import { fileURLToPath } from "node:url";
import { ConfigError, loadConfigFromProcess, type AppConfig } from "../config/index.js";
import { connectDatabases, initializeModels } from "../kernel/db/index.js";
import { createLogger, setRootLogger, type Logger } from "../kernel/logger/index.js";
import { systemClock } from "../kernel/time/index.js";
import { registerModuleModels } from "../routes/v1.js";
import { seedIndustryTemplates } from "./seed-industry-templates.js";

const ENV_FILE_PATH = fileURLToPath(new URL("../../.env", import.meta.url));

async function seedWithConnectedDatabases(config: AppConfig, logger: Logger): Promise<void> {
  registerModuleModels();
  const connections = await connectDatabases(config);
  try {
    await initializeModels();
    const outcome = await seedIndustryTemplates(systemClock);
    logger.info(
      { event: "seed.industry_templates_done", ...outcome },
      "industry template seed finished",
    );
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
    logger.fatal(
      { event: "seed.industry_templates_failed", err: error },
      "industry template seed failed",
    );
    return 1;
  }
}

process.exitCode = await run();
