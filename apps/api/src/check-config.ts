import { fileURLToPath } from "node:url";
import { ConfigError, loadConfig, loadEnvFile, type AppConfig } from "./config/index.js";

const ENV_FILE_PATH = fileURLToPath(new URL("../.env", import.meta.url));

/** The database name is the last path segment of the URL; credentials and hosts are never printed. */
function databaseName(url: string): string {
  const withoutQuery = url.split("?")[0] ?? "";
  return withoutQuery.split("/").pop() ?? "";
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
    loadEnvFile(ENV_FILE_PATH);
    process.stdout.write(`${describeSuccess(loadConfig(process.env))}\n`);
    return 0;
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    process.stderr.write(`${describeFailure(error)}\n`);
    return 1;
  }
}

process.exitCode = run();
