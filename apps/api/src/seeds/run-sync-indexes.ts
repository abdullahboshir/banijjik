import { fileURLToPath } from "node:url";
import { ConfigError, loadConfigFromProcess, type AppConfig } from "../config/index.js";
import { connectDatabases, initializeModels } from "../kernel/db/index.js";
import { createLogger, setRootLogger, type Logger } from "../kernel/logger/index.js";
import { registerAllModels } from "../register-all-models.js";
import { syncIndexes, type IndexSyncOutcome } from "./sync-indexes.js";

const ENV_FILE_PATH = fileURLToPath(new URL("../../.env", import.meta.url));

/** One line per collection, and one error line per conflict with the exact command a person can run. */
function reportOutcome(logger: Logger, outcome: IndexSyncOutcome): void {
  for (const entry of outcome.collections) {
    logger.info(
      {
        event: "indexes.collection_synced",
        collection: entry.collectionName,
        created: entry.created,
        alreadyThere: entry.alreadyThere,
        conflicting: entry.conflicting.length,
      },
      "indexes checked",
    );
    for (const conflict of entry.conflicting) {
      logger.error(
        { event: "indexes.conflict", collection: entry.collectionName, keys: conflict.keys },
        `index conflicts with the declared one; nothing was dropped. If the old one is wrong, run: db.getSiblingDB("${entry.databaseName}").getCollection("${entry.collectionName}").dropIndex("${conflict.existingName}") and sync again`,
      );
    }
  }
  logger.info(
    {
      event: "indexes.sync_done",
      createdCount: outcome.createdCount,
      conflictCount: outcome.conflictCount,
    },
    "index sync finished",
  );
}

async function syncWithConnectedDatabases(config: AppConfig, logger: Logger): Promise<number> {
  registerAllModels();
  const connections = await connectDatabases(config);
  try {
    await initializeModels();
    const outcome = await syncIndexes();
    reportOutcome(logger, outcome);
    return outcome.conflictCount === 0 ? 0 : 1;
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
    return await syncWithConnectedDatabases(config, logger);
  } catch (error) {
    logger.fatal({ event: "indexes.sync_failed", err: error }, "index sync failed");
    return 1;
  }
}

process.exitCode = await run();
