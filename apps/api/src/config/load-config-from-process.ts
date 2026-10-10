import type { AppConfig } from "./app-config.js";
import { loadConfig } from "./load-config.js";
import { loadEnvFile } from "./load-env-file.js";

/** The one place that hands the real process environment to the loader. Variables already set win over the file. */
export function loadConfigFromProcess(envFilePath: string): AppConfig {
  loadEnvFile(envFilePath);
  return loadConfig(process.env);
}
