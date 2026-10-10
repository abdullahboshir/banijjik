import { ConfigError, type AppConfig, type ConfigIssue } from "./app-config.js";
import {
  PRODUCTION_LOCAL_HOST_HINT,
  corsRule,
  isHttpOrigin,
  isLocalHostUrl,
  logLevelRule,
  nodeEnvRule,
  outboxPollIntervalRule,
  platformUrlRule,
  portRule,
  redisUrlRule,
  roleRule,
  splitOrigins,
  tenantSharedUrlRule,
  WILDCARD_ORIGIN_HINT,
  type FieldRule,
} from "./env.schema.js";
import { readAuthConfig, readPlatformAdmin } from "./read-auth-config.js";
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
  isProduction: boolean,
): FieldResult<string> {
  const result = readField(env, rule);
  if (!isProduction || result.value === undefined) return result;
  if (!isLocalHostUrl(result.value)) return result;
  return failure(rule, "INVALID", PRODUCTION_LOCAL_HOST_HINT);
}

type BaseConfig = Omit<AppConfig, "auth" | "platformAdmin">;

interface BaseConfigResult {
  readonly value?: BaseConfig;
  readonly issues: readonly ConfigIssue[];
}

function readBaseConfig(env: Environment): BaseConfigResult {
  const nodeEnv = readField(env, nodeEnvRule);
  // An invalid NODE_ENV is reported on its own; production rules then do not apply.
  const isProduction = nodeEnv.value === "production";
  const port = readField(env, portRule);
  const logLevel = readField(env, logLevelRule);
  const role = readField(env, roleRule);
  const platformUrl = readUrl(env, platformUrlRule, isProduction);
  const tenantSharedUrl = readUrl(env, tenantSharedUrlRule, isProduction);
  const redisUrl = readUrl(env, redisUrlRule, isProduction);
  const cors = readOrigins(env);

  const issues = collectIssues([
    nodeEnv,
    port,
    logLevel,
    role,
    platformUrl,
    tenantSharedUrl,
    redisUrl,
    cors,
  ]);
  const { value: nodeEnvValue } = nodeEnv;
  const { value: portValue } = port;
  const { value: logLevelValue } = logLevel;
  const { value: roleValue } = role;
  const { value: platformUrlValue } = platformUrl;
  const { value: tenantSharedUrlValue } = tenantSharedUrl;
  const { value: redisUrlValue } = redisUrl;
  const { value: originsValue } = cors;
  const isComplete =
    issues.length === 0 &&
    nodeEnvValue !== undefined &&
    portValue !== undefined &&
    logLevelValue !== undefined &&
    roleValue !== undefined &&
    platformUrlValue !== undefined &&
    tenantSharedUrlValue !== undefined &&
    redisUrlValue !== undefined &&
    originsValue !== undefined;
  if (!isComplete) return { issues };

  return {
    issues,
    value: {
      nodeEnv: nodeEnvValue,
      port: portValue,
      logLevel: logLevelValue,
      role: roleValue,
      database: Object.freeze({
        platformUrl: platformUrlValue,
        tenantSharedUrl: tenantSharedUrlValue,
      }),
      redisUrl: redisUrlValue,
      corsAllowedOrigins: Object.freeze(originsValue),
    },
  };
}

/** Validates an environment object. Returns a frozen config or throws ConfigError. Never includes values in messages. */
export function loadConfig(env: Environment): AppConfig {
  const base = readBaseConfig(env);
  const auth = readAuthConfig(env);
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
