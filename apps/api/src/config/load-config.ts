import { ConfigError, type AppConfig } from "./app-config.js";
import {
  ALLOW_LOCAL_SERVICES_HINT,
  PRODUCTION_LOCAL_HOST_HINT,
  allowLocalServicesRule,
  corsRule,
  isHttpOrigin,
  isLocalHostUrl,
  isTestEnvironment,
  logLevelRule,
  nodeEnvRule,
  outboxPollIntervalRule,
  platformUrlRule,
  portRule,
  redisUrlRule,
  roleRule,
  splitOrigins,
  tenantSharedUrlRule,
  trustedProxyHopsRule,
  WILDCARD_ORIGIN_HINT,
  type FieldRule,
} from "./env.schema.js";
import { readAuthConfig, readPlatformAdmin, type ConfigSection } from "./read-auth-config.js";
import {
  collectIssues,
  failure,
  readField,
  readOptionalField,
  type Environment,
  type FieldResult,
} from "./read-field.js";

function readOrigins(env: Environment): FieldResult<readonly string[]> {
  const field = readField(env, corsRule);
  if (field.issue) return { issue: field.issue };
  if (field.value === undefined) return failure(corsRule, "MISSING");
  const origins = splitOrigins(field.value);
  if (origins.length === 0) return failure(corsRule, "MISSING");
  if (origins.includes("*")) return failure(corsRule, "INVALID", WILDCARD_ORIGIN_HINT);
  const allValid = origins.every(isHttpOrigin);
  if (!allValid) return failure(corsRule, "INVALID");
  return { value: origins };
}

function readUrl(
  env: Environment,
  rule: FieldRule<string>,
  blockLocalHosts: boolean,
): FieldResult<string> {
  const result = readField(env, rule);
  if (!blockLocalHosts || result.value === undefined) return result;
  if (!isLocalHostUrl(result.value)) return result;
  return failure(rule, "INVALID", PRODUCTION_LOCAL_HOST_HINT);
}

/**
 * Production refuses local services, unless CI or the test runner says this process only plays
 * production (the spawned-process tests do). A real deployment cannot opt out by setting the flag.
 */
function readLocalServicesAllowed(env: Environment, isProduction: boolean): FieldResult<boolean> {
  if (!isProduction) return { value: false };
  const flag = readField(env, allowLocalServicesRule);
  if (flag.value !== true || isTestEnvironment(env)) return flag;
  return failure(allowLocalServicesRule, "INVALID", ALLOW_LOCAL_SERVICES_HINT);
}

/** Production must say how many proxies it has (no default); elsewhere 0 is the safe answer. */
function readTrustedProxyHops(env: Environment, isProduction: boolean): FieldResult<number> {
  const rule = isProduction ? trustedProxyHopsRule : { ...trustedProxyHopsRule, defaultValue: "0" };
  return readField(env, rule);
}

type BaseConfig = Omit<AppConfig, "auth" | "platformAdmin">;
type ServerSettings = Pick<
  AppConfig,
  "port" | "logLevel" | "role" | "trustedProxyHops" | "corsAllowedOrigins"
>;
type DataStores = Pick<AppConfig, "database" | "redisUrl">;

function readServerSettings(
  env: Environment,
  isProduction: boolean,
): ConfigSection<ServerSettings> {
  const port = readField(env, portRule);
  const logLevel = readField(env, logLevelRule);
  const role = readField(env, roleRule);
  const trustedProxyHops = readTrustedProxyHops(env, isProduction);
  const cors = readOrigins(env);
  const issues = collectIssues([port, logLevel, role, trustedProxyHops, cors]);
  if (
    issues.length > 0 ||
    port.value === undefined ||
    logLevel.value === undefined ||
    role.value === undefined ||
    trustedProxyHops.value === undefined ||
    cors.value === undefined
  ) {
    return { issues };
  }
  return {
    issues,
    value: {
      port: port.value,
      logLevel: logLevel.value,
      role: role.value,
      trustedProxyHops: trustedProxyHops.value,
      corsAllowedOrigins: Object.freeze(cors.value),
    },
  };
}

function readDataStores(env: Environment, isProduction: boolean): ConfigSection<DataStores> {
  const localServicesAllowed = readLocalServicesAllowed(env, isProduction);
  const blockLocalHosts = isProduction && localServicesAllowed.value !== true;
  const platformUrl = readUrl(env, platformUrlRule, blockLocalHosts);
  const tenantSharedUrl = readUrl(env, tenantSharedUrlRule, blockLocalHosts);
  const redisUrl = readUrl(env, redisUrlRule, blockLocalHosts);
  const issues = collectIssues([localServicesAllowed, platformUrl, tenantSharedUrl, redisUrl]);
  if (
    issues.length > 0 ||
    platformUrl.value === undefined ||
    tenantSharedUrl.value === undefined ||
    redisUrl.value === undefined
  ) {
    return { issues };
  }
  return {
    issues,
    value: {
      database: Object.freeze({
        platformUrl: platformUrl.value,
        tenantSharedUrl: tenantSharedUrl.value,
      }),
      redisUrl: redisUrl.value,
    },
  };
}

function readBaseConfig(env: Environment): ConfigSection<BaseConfig> {
  const nodeEnv = readField(env, nodeEnvRule);
  // An invalid NODE_ENV is reported on its own; production rules then do not apply.
  const isProduction = nodeEnv.value === "production";
  const server = readServerSettings(env, isProduction);
  const stores = readDataStores(env, isProduction);
  const issues = [...collectIssues([nodeEnv]), ...server.issues, ...stores.issues];
  if (
    issues.length > 0 ||
    nodeEnv.value === undefined ||
    server.value === undefined ||
    stores.value === undefined
  ) {
    return { issues };
  }
  return { issues, value: { nodeEnv: nodeEnv.value, ...server.value, ...stores.value } };
}
/** Validates an environment object. Returns a frozen config or throws ConfigError. Never includes values in messages. */
export function loadConfig(env: Environment): AppConfig {
  const base = readBaseConfig(env);
  const auth = readAuthConfig(env, env["NODE_ENV"]?.trim() === "production");
  const platformAdmin = readPlatformAdmin(env);
  const outboxPollInterval = readOptionalField(env, outboxPollIntervalRule);
  const issues = [
    ...base.issues,
    ...auth.issues,
    ...platformAdmin.issues,
    ...collectIssues([outboxPollInterval]),
  ];
  if (issues.length > 0 || base.value === undefined || auth.value === undefined) {
    throw new ConfigError(issues);
  }
  return Object.freeze({
    ...base.value,
    auth: auth.value,
    ...(outboxPollInterval.value === undefined
      ? {}
      : { outboxPollIntervalMs: outboxPollInterval.value }),
    ...(platformAdmin.value === undefined ? {} : { platformAdmin: platformAdmin.value }),
  });
}
