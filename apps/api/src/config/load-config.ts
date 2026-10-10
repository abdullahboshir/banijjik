import { ConfigError, type AppConfig, type ConfigIssue } from "./app-config.js";
import {
  PRODUCTION_LOCAL_HOST_HINT,
  PRODUCTION_WILDCARD_HINT,
  corsRule,
  isHttpOrigin,
  isLocalHostUrl,
  logLevelRule,
  nodeEnvRule,
  platformUrlRule,
  portRule,
  redisUrlRule,
  splitOrigins,
  tenantSharedUrlRule,
  type FieldRule,
} from "./env.schema.js";

type Environment = Readonly<Record<string, string | undefined>>;

interface FieldResult<Output> {
  readonly value?: Output;
  readonly issue?: ConfigIssue;
}

function failure(
  rule: FieldRule<unknown>,
  problem: ConfigIssue["problem"],
  hint: string = rule.hint,
): FieldResult<never> {
  return { issue: { key: rule.key, problem, hint } };
}

/** Reads one key. Zod's own messages are ignored because they can echo the value. */
function readField<Output>(env: Environment, rule: FieldRule<Output>): FieldResult<Output> {
  const raw = env[rule.key]?.trim();
  const text = raw === undefined || raw === "" ? rule.defaultValue : raw;
  if (text === undefined) return failure(rule, "MISSING");
  const parsed = rule.schema.safeParse(text);
  if (!parsed.success) return failure(rule, "INVALID");
  return { value: parsed.data };
}

function readOrigins(env: Environment, isProduction: boolean): FieldResult<readonly string[]> {
  const field = readField(env, corsRule);
  if (field.issue) return { issue: field.issue };
  if (field.value === undefined) return failure(corsRule, "MISSING");
  const origins = splitOrigins(field.value);
  if (origins.length === 0) return failure(corsRule, "MISSING");
  if (isProduction && origins.includes("*")) {
    return failure(corsRule, "INVALID", PRODUCTION_WILDCARD_HINT);
  }
  const allValid = origins.every((origin) => origin === "*" || isHttpOrigin(origin));
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

function collectIssues(results: readonly FieldResult<unknown>[]): ConfigIssue[] {
  return results.flatMap((result) => (result.issue ? [result.issue] : []));
}

/** Validates an environment object. Returns a frozen config or throws ConfigError. Never includes values in messages. */
export function loadConfig(env: Environment): AppConfig {
  const nodeEnv = readField(env, nodeEnvRule);
  // An invalid NODE_ENV is reported on its own; production rules then do not apply.
  const isProduction = nodeEnv.value === "production";
  const port = readField(env, portRule);
  const logLevel = readField(env, logLevelRule);
  const platformUrl = readUrl(env, platformUrlRule, isProduction);
  const tenantSharedUrl = readUrl(env, tenantSharedUrlRule, isProduction);
  const redisUrl = readUrl(env, redisUrlRule, isProduction);
  const cors = readOrigins(env, isProduction);

  const issues = collectIssues([nodeEnv, port, logLevel, platformUrl, tenantSharedUrl, redisUrl, cors]);
  if (issues.length > 0) throw new ConfigError(issues);

  return Object.freeze({
    nodeEnv: nodeEnv.value!,
    port: port.value!,
    logLevel: logLevel.value!,
    database: Object.freeze({
      platformUrl: platformUrl.value!,
      tenantSharedUrl: tenantSharedUrl.value!,
    }),
    redisUrl: redisUrl.value!,
    corsAllowedOrigins: Object.freeze(cors.value!),
  });
}
