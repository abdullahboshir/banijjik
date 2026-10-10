import { fileURLToPath } from "node:url";
import {
  ConfigError,
  loadConfigFromProcess,
  parseMongoUrl,
  type AppConfig,
} from "./config/index.js";

const ENV_FILE_PATH = fileURLToPath(new URL("../.env", import.meta.url));

/** The database name only; credentials and hosts are never printed. */
function databaseName(url: string): string {
  return parseMongoUrl(url)?.databaseName ?? "(unreadable)";
}

function describeSuccess(config: AppConfig): string {
  return [
    "Config OK",
    `nodeEnv: ${config.nodeEnv}`,
    `port: ${config.port}`,
    `platform database: ${databaseName(config.database.platformUrl)}`,
    `tenant database: ${databaseName(config.database.tenantSharedUrl)}`,
  ].join("\n");
}

function describeFailure(error: ConfigError): string {
  return error.issues.map((issue) => `${issue.key}: ${issue.problem} (${issue.hint})`).join("\n");
}

function run(): number {
  try {
    process.stdout.write(`${describeSuccess(loadConfigFromProcess(ENV_FILE_PATH))}\n`);
    return 0;
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    process.stderr.write(`${describeFailure(error)}\n`);
    return 1;
  }
}

process.exitCode = run();
